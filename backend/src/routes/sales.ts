import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired, requireRole('ADMIN'));

async function nextFolio(tx: any): Promise<string> {
  const rows: { folio: string }[] = await tx.$queryRaw`
    SELECT folio FROM "Sale"
    WHERE folio LIKE 'V-%' AND LENGTH(folio) = 8 AND folio ~ '^V-[0-9]{6}$'
    ORDER BY folio DESC
    LIMIT 1
  `;
  let n = 0;
  if (rows[0]) {
    const m = /^V-(\d{6})$/.exec(rows[0].folio);
    if (m) n = parseInt(m[1], 10);
  }
  return 'V-' + String(n + 1).padStart(6, '0');
}

async function withFolioRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX = 5;
  for (let i = 0; i < MAX; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isDup = e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('folio');
      if (!isDup || i === MAX - 1) throw e;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
    }
  }
  throw new Error('No se pudo generar folio único');
}

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

const schema = z.object({
  patientId: z.string().optional().nullable(),
  prescriptionId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(1).default(0.16),
  paymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'COMBINADO', 'DEPOSITO']).default('EFECTIVO'),
  status: z.enum(['PAGADA', 'PENDIENTE_ENTREGA', 'ENTREGADA', 'CANCELADA', 'PENDIENTE', 'LIQUIDADA']).default('PAGADA'),
  notes: z.string().optional().nullable(),
});

const posSchema = z.object({
  patientId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(1).default(0.16),
  deposit: z.number().min(0).default(0),
  depositMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'COMBINADO', 'DEPOSITO']).optional(),
  lensType: z.string().optional().nullable(),
  lensEye: z.string().optional().nullable(),
  pd: z.string().optional().nullable(),
  odEsf: z.string().optional().nullable(),
  odCil: z.string().optional().nullable(),
  odEje: z.string().optional().nullable(),
  odAdd: z.string().optional().nullable(),
  oiEsf: z.string().optional().nullable(),
  oiCil: z.string().optional().nullable(),
  oiEje: z.string().optional().nullable(),
  oiAdd: z.string().optional().nullable(),
  referralHospital: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res) => {
  const { from, to, status, mine, patientId } = req.query as any;
  const where: any = {};
  if (mine === 'true') where.vendorId = req.user!.id;
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);
  const list = await prisma.sale.findMany({
    where,
    include: { patient: true, vendor: { select: { fullName: true } }, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(list);
});

router.get('/referral-sources', async (_req, res) => {
  const rows = await prisma.sale.findMany({
    where: { referralHospital: { not: null } },
    select: { referralHospital: true },
    distinct: ['referralHospital'],
    orderBy: { referralHospital: 'asc' },
  });
  res.json(rows.map((r) => r.referralHospital as string));
});

router.get('/:id', async (req, res) => {
  const s = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      prescription: true,
      vendor: { select: { fullName: true } },
      items: { include: { product: true } },
      abonos: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  res.json(s);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const sale = await withFolioRetry(() => prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const itemData: any[] = [];
      for (const it of d.items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product) throw new Error(`Producto ${it.productId} no existe`);
        if (product.stock < it.quantity) throw new Error(`Stock insuficiente: ${product.name}`);
        const itSub = it.unitPrice * it.quantity - it.discount;
        subtotal += itSub;
        itemData.push({ ...it, subtotal: itSub });
      }
      const taxable = subtotal - d.discount;
      const tax = taxable * d.taxRate;
      const total = taxable + tax;
      const folio = await nextFolio(tx);
      const created = await tx.sale.create({
        data: {
          folio,
          patientId: d.patientId || null,
          prescriptionId: d.prescriptionId || null,
          vendorId: req.user!.id,
          subtotal, discount: d.discount, tax, total,
          paymentMethod: d.paymentMethod, status: d.status, notes: d.notes,
          items: { create: itemData },
        },
        include: { items: { include: { product: true } }, patient: true, vendor: { select: { fullName: true } } },
      });
      if (d.status !== 'CANCELADA') {
        for (const it of d.items) {
          await tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity }, lastMovementAt: new Date() } });
          await tx.movement.create({
            data: { type: 'SALIDA', productId: it.productId, quantity: it.quantity, userId: req.user!.id, reason: 'Venta ' + folio, reference: folio },
          });
        }
      }
      if (d.prescriptionId) {
        await tx.prescription.update({ where: { id: d.prescriptionId }, data: { status: 'USADA' } });
      }
      return created;
    }));
    emit('sale:created', sale);
    res.status(201).json(sale);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── POS: crear cuenta con anticipo ────────────────────────────────────────────
router.post('/pos', async (req: AuthRequest, res) => {
  const parsed = posSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const sale = await withFolioRetry(() => prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const itemData: any[] = [];
      for (const it of d.items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product) throw new Error(`Producto ${it.productId} no existe`);
        if (product.stock < it.quantity) throw new Error(`Stock insuficiente: ${product.name}`);
        const itSub = it.unitPrice * it.quantity - it.discount;
        subtotal += itSub;
        itemData.push({ ...it, subtotal: itSub });
      }
      const taxable = subtotal - d.discount;
      const tax = taxable * d.taxRate;
      const total = taxable + tax;
      const depositAmt = Math.min(d.deposit || 0, total);
      const balance = Math.round((total - depositAmt) * 100) / 100;
      const status = balance <= 0 ? 'LIQUIDADA' : 'PENDIENTE';
      const folio = await nextFolio(tx);

      const created = await tx.sale.create({
        data: {
          folio,
          patientId: d.patientId || null,
          vendorId: req.user!.id,
          subtotal,
          discount: d.discount,
          tax,
          total,
          deposit: depositAmt,
          balance,
          paymentMethod: (d.depositMethod as any) || 'EFECTIVO',
          depositMethod: (d.depositMethod as any) || null,
          lensType: d.lensType || null,
          lensEye: d.lensEye || null,
          pd: d.pd || null,
          odEsf: d.odEsf || null,
          odCil: d.odCil || null,
          odEje: d.odEje || null,
          odAdd: d.odAdd || null,
          oiEsf: d.oiEsf || null,
          oiCil: d.oiCil || null,
          oiEje: d.oiEje || null,
          oiAdd: d.oiAdd || null,
          referralHospital: d.referralHospital || null,
          status: status as any,
          notes: d.notes || null,
          items: { create: itemData },
        },
        include: {
          items: { include: { product: true } },
          patient: true,
          vendor: { select: { fullName: true } },
        },
      });

      for (const it of d.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity }, lastMovementAt: new Date() },
        });
        await tx.movement.create({
          data: {
            type: 'SALIDA',
            productId: it.productId,
            quantity: it.quantity,
            userId: req.user!.id,
            reason: `POS ${folio}`,
            reference: folio,
          },
        });
      }

      if (depositAmt > 0) {
        await tx.abono.create({
          data: {
            saleId: created.id,
            amount: depositAmt,
            method: (d.depositMethod as any) || 'EFECTIVO',
            notes: 'Anticipo inicial',
            userId: req.user!.id,
          },
        });
      }

      return created;
    }));
    emit('sale:created', sale);
    res.status(201).json(sale);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Registrar abono parcial ───────────────────────────────────────────────────
router.post('/:id/abono', async (req: AuthRequest, res) => {
  const { amount, method, notes } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Monto inválido' });
  try {
    const sale = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new Error('Venta no encontrada');
      if (existing.status === 'LIQUIDADA') throw new Error('Esta cuenta ya está liquidada');
      const abonoAmt = Math.min(amt, existing.balance);
      await tx.abono.create({
        data: {
          saleId: existing.id,
          amount: abonoAmt,
          method: method || 'EFECTIVO',
          notes: notes || null,
          userId: req.user!.id,
        },
      });
      const newDeposit = Math.round((existing.deposit + abonoAmt) * 100) / 100;
      const newBalance = Math.round((existing.balance - abonoAmt) * 100) / 100;
      const newStatus = newBalance <= 0 ? 'LIQUIDADA' : 'PENDIENTE';
      return tx.sale.update({
        where: { id: existing.id },
        data: { deposit: newDeposit, balance: newBalance, status: newStatus as any },
        include: {
          items: { include: { product: true } },
          patient: true,
          vendor: { select: { fullName: true } },
          abonos: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
        },
      });
    });
    emit('sale:updated', sale);
    res.json(sale);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── POS: registrar pago final (legacy) ───────────────────────────────────────
router.patch('/:id/finalPayment', async (req, res) => {
  const { finalPaymentMethod } = req.body;
  const existing = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Venta no encontrada' });
  if (existing.status !== 'PENDIENTE') {
    return res.status(400).json({ error: 'Solo se puede liquidar una cuenta en estado PENDIENTE' });
  }
  const sale = await prisma.sale.update({
    where: { id: req.params.id },
    data: {
      finalPaymentMethod: (finalPaymentMethod as any) || 'EFECTIVO',
      balance: 0,
      status: 'LIQUIDADA',
    },
  });
  emit('sale:updated', sale);
  res.json(sale);
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const s = await prisma.sale.update({ where: { id: req.params.id }, data: { status } });
  emit('sale:updated', s);
  res.json(s);
});

export default router;
