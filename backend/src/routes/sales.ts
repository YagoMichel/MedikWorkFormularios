import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired, requireRole('ADMIN'));

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
  paymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'COMBINADO']).default('EFECTIVO'),
  status: z.enum(['PAGADA', 'PENDIENTE_ENTREGA', 'ENTREGADA', 'CANCELADA']).default('PAGADA'),
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

router.get('/:id', async (req, res) => {
  const s = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { patient: true, prescription: true, vendor: { select: { fullName: true } }, items: { include: { product: true } } },
  });
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  res.json(s);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const sale = await prisma.$transaction(async (tx) => {
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
      const folio = 'V-' + Date.now().toString().slice(-8);
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
      // Descuento de stock + movimientos SALIDA si está pagada/entregada
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
    });
    emit('sale:created', sale);
    res.status(201).json(sale);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const s = await prisma.sale.update({ where: { id: req.params.id }, data: { status } });
  emit('sale:updated', s);
  res.json(s);
});

export default router;
