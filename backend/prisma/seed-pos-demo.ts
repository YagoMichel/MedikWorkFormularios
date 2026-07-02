/**
 * Datos de demostración para el POS.
 * Crea: empresas, pacientes (particulares y empresariales) y ventas
 * (algunas LIQUIDADAS, otras PENDIENTES con saldo).
 *
 * Idempotente: si ya existen las empresas o pacientes por nombre/teléfono,
 * los reutiliza. Las ventas siempre se crean nuevas (folio único por timestamp).
 *
 * Uso:
 *   docker compose exec backend npx tsx prisma/seed-pos-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureCompany(name: string, data: { phone?: string; contactName?: string; email?: string }) {
  return prisma.company.upsert({
    where: { name },
    update: {},
    create: { name, ...data },
  });
}

async function ensurePatient(fullName: string, phone: string, opts: { companyId?: string; nss?: string }) {
  const existing = await prisma.patient.findFirst({ where: { fullName, phone } });
  if (existing) return existing;
  return prisma.patient.create({
    data: {
      fullName,
      phone,
      companyId: opts.companyId ?? null,
      nss: opts.nss ?? null,
    },
  });
}

async function pickProducts() {
  const armazones = await prisma.product.findMany({
    where: { attributes: { path: ['tipo'], equals: 'armazon' } },
    take: 30,
  });
  const lentesSeg = await prisma.product.findMany({
    where: { attributes: { path: ['grupo'], equals: 'lente-seguridad' } },
    take: 30,
  });
  const micas = await prisma.product.findMany({
    where: { attributes: { path: ['grupo'], equals: 'mica-hx' } },
    take: 30,
  });
  return { armazones, lentesSeg, micas };
}

type ItemSpec = { productId: string; quantity: number; unitPrice: number; discount: number };

async function createSale(opts: {
  patientId: string | null;
  vendorId: string;
  items: ItemSpec[];
  discountPct: number; // porcentaje 0-100
  depositPct: number; // 0 = sin anticipo, 1 = total. 0.3 = 30%
  depositMethod?: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
  lensType?: string;
  notes?: string;
}) {
  const subtotal = opts.items.reduce(
    (s, it) => s + it.unitPrice * it.quantity - it.discount,
    0,
  );
  const discount = +(subtotal * opts.discountPct / 100).toFixed(2);
  const total = subtotal - discount;
  const depositAmt = +(total * opts.depositPct).toFixed(2);
  const balance = Math.round((total - depositAmt) * 100) / 100;
  const status = balance <= 0 ? 'LIQUIDADA' : 'PENDIENTE';
  // folio único: V-XXXXXXXX + sufijo random para evitar colisión en lote
  const folio = 'V-' + (Date.now().toString().slice(-7)) + Math.floor(Math.random() * 10);

  const itemData = opts.items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discount: it.discount,
    subtotal: it.unitPrice * it.quantity - it.discount,
  }));

  const created = await prisma.sale.create({
    data: {
      folio,
      patientId: opts.patientId,
      vendorId: opts.vendorId,
      subtotal,
      discount,
      tax: 0,
      total,
      deposit: depositAmt,
      balance,
      paymentMethod: opts.depositMethod ?? 'EFECTIVO',
      depositMethod: depositAmt > 0 ? (opts.depositMethod ?? 'EFECTIVO') : null,
      lensType: opts.lensType ?? null,
      status: status as any,
      notes: opts.notes ?? null,
      items: { create: itemData },
    },
  });

  if (depositAmt > 0) {
    await prisma.abono.create({
      data: {
        saleId: created.id,
        amount: depositAmt,
        method: opts.depositMethod ?? 'EFECTIVO',
        notes: 'Anticipo inicial (demo)',
        userId: opts.vendorId,
      },
    });
  }

  return { folio, status, total, deposit: depositAmt, balance };
}

async function main() {
  console.log('› Buscando vendedor admin…');
  const vendor = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!vendor) throw new Error('No hay usuario ADMIN. Corre primero el seed principal.');

  console.log('› Creando empresas…');
  const construMex = await ensureCompany('Constructora ConstruMex SA', {
    phone: '555-100-2030',
    contactName: 'Lic. Patricia Robles',
    email: 'rh@construmex.mx',
  });
  const minerosNorte = await ensureCompany('Mineros del Norte', {
    phone: '555-440-7711',
    contactName: 'Ing. Raúl Téllez',
    email: 'seguridad@minerosnorte.mx',
  });
  const industrialAcero = await ensureCompany('Industrial Acero & Soldadura', {
    phone: '555-882-9090',
    contactName: 'Lic. Mónica Vargas',
    email: 'compras@aceroysold.mx',
  });

  console.log('› Creando pacientes…');
  const pa1 = await ensurePatient('Juan Pérez Hernández', '555-101-0001', { companyId: construMex.id, nss: '11223344556' });
  const pa2 = await ensurePatient('María López Sánchez', '555-101-0002', { companyId: minerosNorte.id, nss: '22334455667' });
  const pa3 = await ensurePatient('Carlos Ramírez Díaz', '555-101-0003', { companyId: industrialAcero.id, nss: '33445566778' });
  const pa4 = await ensurePatient('Ana Torres Mejía', '555-101-0004', {}); // particular
  const pa5 = await ensurePatient('Roberto Castillo Vega', '555-101-0005', { companyId: construMex.id, nss: '44556677889' });
  const pa6 = await ensurePatient('Lucía Fernández Ortiz', '555-101-0006', {}); // particular
  const pa7 = await ensurePatient('Miguel Ángel Soto', '555-101-0007', { companyId: minerosNorte.id, nss: '55667788990' });

  console.log('› Tomando productos del catálogo…');
  const { armazones, lentesSeg, micas } = await pickProducts();
  if (armazones.length === 0 && lentesSeg.length === 0) {
    throw new Error('No hay productos en catálogo. Corre los scripts add-* primero.');
  }
  const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];

  console.log('› Creando ventas de ejemplo…');
  const results: any[] = [];

  // 1) Liquidada · armazón + mica (particular)
  results.push(await createSale({
    patientId: pa4.id,
    vendorId: vendor.id,
    items: [
      { productId: pick(armazones, 0).id, quantity: 1, unitPrice: pick(armazones, 0).salePrice, discount: 0 },
      ...(micas[0] ? [{ productId: micas[0].id, quantity: 1, unitPrice: micas[0].salePrice, discount: 0 }] : []),
    ],
    discountPct: 0,
    depositPct: 1, // 100% → liquidada
    depositMethod: 'EFECTIVO',
    lensType: 'Monofocal',
    notes: 'Venta de mostrador · pagada en efectivo',
  }));

  // 2) Liquidada · lente seguridad (empresarial ConstruMex)
  if (lentesSeg.length > 0) {
    results.push(await createSale({
      patientId: pa1.id,
      vendorId: vendor.id,
      items: [
        { productId: pick(lentesSeg, 0).id, quantity: 1, unitPrice: pick(lentesSeg, 0).salePrice, discount: 0 },
      ],
      discountPct: 10,
      depositPct: 1,
      depositMethod: 'TRANSFERENCIA',
      lensType: 'Seguridad industrial',
      notes: 'Liquidada · descuento por empresa',
    }));
  }

  // 3) Pendiente · armazón + mica con anticipo 30% (mínimo encargo)
  results.push(await createSale({
    patientId: pa2.id,
    vendorId: vendor.id,
    items: [
      { productId: pick(armazones, 1).id, quantity: 1, unitPrice: pick(armazones, 1).salePrice, discount: 0 },
      ...(micas[1] ? [{ productId: micas[1].id, quantity: 1, unitPrice: micas[1].salePrice, discount: 0 }] : []),
    ],
    discountPct: 5,
    depositPct: 0.30,
    depositMethod: 'EFECTIVO',
    lensType: 'Bifocal',
    notes: 'Anticipo del 30% · encargo en proceso',
  }));

  // 4) Pendiente · armazón solo con anticipo 50%
  results.push(await createSale({
    patientId: pa3.id,
    vendorId: vendor.id,
    items: [
      { productId: pick(armazones, 2).id, quantity: 1, unitPrice: pick(armazones, 2).salePrice, discount: 0 },
    ],
    discountPct: 0,
    depositPct: 0.5,
    depositMethod: 'TARJETA',
    lensType: 'Monofocal',
    notes: 'Anticipo del 50% · saldo al entregar',
  }));

  // 5) Pendiente · sin anticipo (caso "no debería haberse aceptado")
  results.push(await createSale({
    patientId: pa5.id,
    vendorId: vendor.id,
    items: [
      { productId: pick(armazones, 3).id, quantity: 1, unitPrice: pick(armazones, 3).salePrice, discount: 0 },
      ...(micas[2] ? [{ productId: micas[2].id, quantity: 1, unitPrice: micas[2].salePrice, discount: 0 }] : []),
    ],
    discountPct: 0,
    depositPct: 0,
    lensType: 'Progresivo',
    notes: 'Cliente regresa después por anticipo',
  }));

  // 6) Liquidada · 2 lentes seguridad (lote pequeño)
  if (lentesSeg.length >= 2) {
    results.push(await createSale({
      patientId: pa7.id,
      vendorId: vendor.id,
      items: [
        { productId: pick(lentesSeg, 1).id, quantity: 2, unitPrice: pick(lentesSeg, 1).salePrice, discount: 0 },
      ],
      discountPct: 15,
      depositPct: 1,
      depositMethod: 'TRANSFERENCIA',
      lensType: 'Seguridad industrial',
      notes: 'Compra para 2 empleados',
    }));
  }

  // 7) Pendiente · venta grande para particular con anticipo 30%
  results.push(await createSale({
    patientId: pa6.id,
    vendorId: vendor.id,
    items: [
      { productId: pick(armazones, 4).id, quantity: 1, unitPrice: pick(armazones, 4).salePrice, discount: 0 },
      ...(micas[3] ? [{ productId: micas[3].id, quantity: 1, unitPrice: micas[3].salePrice, discount: 100 }] : []),
    ],
    discountPct: 8,
    depositPct: 0.30,
    depositMethod: 'EFECTIVO',
    lensType: 'Progresivo',
    notes: 'Cliente VIP · descuento por temporada',
  }));

  console.log('\n✓ Ventas creadas:');
  for (const r of results) {
    console.log(`  ${r.folio}  ${r.status.padEnd(10)}  total=$${r.total.toFixed(2)}  anticipo=$${r.deposit.toFixed(2)}  saldo=$${r.balance.toFixed(2)}`);
  }
  console.log(`\nResumen: ${results.length} ventas · empresas: 3 · pacientes nuevos: 7`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
