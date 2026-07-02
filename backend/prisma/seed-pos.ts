// =============================================================
// seed-pos.ts — Datos de ejemplo para el módulo POS
// Categorías, productos, pacientes y ventas de demostración
// =============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No hay usuario ADMIN. Crea uno primero.');

  // ── 1. Categorías ──────────────────────────────────────────
  const cats = await Promise.all([
    prisma.category.upsert({ where: { name: 'Armazones' },   update: {}, create: { name: 'Armazones' } }),
    prisma.category.upsert({ where: { name: 'Lentes' },      update: {}, create: { name: 'Lentes' } }),
    prisma.category.upsert({ where: { name: 'Accesorios' },  update: {}, create: { name: 'Accesorios' } }),
    prisma.category.upsert({ where: { name: 'Servicios' },   update: {}, create: { name: 'Servicios' } }),
  ]);
  const [catArmazones, catLentes, catAccesorios, catServicios] = cats;
  console.log('✓ Categorías creadas');

  // ── 2. Productos ───────────────────────────────────────────
  const productSeed = [
    // Armazones
    { sku: 'ARM-001', name: 'Armazón Titanio Delgado',        categoryId: catArmazones.id, costPrice: 450,  salePrice: 1200, stock: 18, brand: 'Silhouette'  },
    { sku: 'ARM-002', name: 'Armazón Acetato Cuadrado Negro', categoryId: catArmazones.id, costPrice: 280,  salePrice:  850, stock: 25, brand: 'Ray-Ban'      },
    { sku: 'ARM-003', name: 'Armazón Deportivo TR90',         categoryId: catArmazones.id, costPrice: 200,  salePrice:  650, stock: 12, brand: 'Nike Vision'  },
    { sku: 'ARM-004', name: 'Armazón Carey Clásico',          categoryId: catArmazones.id, costPrice: 320,  salePrice:  980, stock: 10, brand: 'Oakley'       },
    { sku: 'ARM-005', name: 'Armazón Metalico Ovalado',       categoryId: catArmazones.id, costPrice: 260,  salePrice:  780, stock: 15, brand: 'Prada'        },
    // Lentes
    { sku: 'LEN-001', name: 'Lente Monofocal Básico',         categoryId: catLentes.id,    costPrice: 180,  salePrice:  550, stock: 50, brand: 'Essilor'      },
    { sku: 'LEN-002', name: 'Lente Progresivo Premium',       categoryId: catLentes.id,    costPrice: 680,  salePrice: 2200, stock: 30, brand: 'Varilux'      },
    { sku: 'LEN-003', name: 'Lente Bifocal CR-39',            categoryId: catLentes.id,    costPrice: 320,  salePrice:  950, stock: 20, brand: 'Essilor'      },
    { sku: 'LEN-004', name: 'Lente Antirreflejante UV400',    categoryId: catLentes.id,    costPrice: 240,  salePrice:  720, stock: 40, brand: 'Hoya'         },
    { sku: 'LEN-005', name: 'Lente Fotocromático Transitions',categoryId: catLentes.id,    costPrice: 520,  salePrice: 1650, stock: 22, brand: 'Transitions'  },
    // Accesorios
    { sku: 'ACC-001', name: 'Estuche Rígido Premium',         categoryId: catAccesorios.id, costPrice:  45,  salePrice:  120, stock: 60, brand: 'Mediwork'    },
    { sku: 'ACC-002', name: 'Paño de Microfibra',             categoryId: catAccesorios.id, costPrice:  10,  salePrice:   35, stock: 100,brand: 'Mediwork'    },
    { sku: 'ACC-003', name: 'Líquido Limpiador 60 ml',        categoryId: catAccesorios.id, costPrice:  28,  salePrice:   80, stock: 45, brand: 'Zeiss'       },
    { sku: 'ACC-004', name: 'Cadena para Lentes Dorada',      categoryId: catAccesorios.id, costPrice:  20,  salePrice:   65, stock: 30, brand: 'Genérico'    },
    // Servicios
    { sku: 'SRV-001', name: 'Consulta Optométrica',           categoryId: catServicios.id,  costPrice:   0,  salePrice:  350, stock: 9999, brand: 'Mediwork'  },
    { sku: 'SRV-002', name: 'Ajuste y Mantenimiento',         categoryId: catServicios.id,  costPrice:   0,  salePrice:  150, stock: 9999, brand: 'Mediwork'  },
    { sku: 'SRV-003', name: 'Taller de Soldadura de Armazón', categoryId: catServicios.id,  costPrice:   0,  salePrice:  200, stock: 9999, brand: 'Mediwork'  },
    { sku: 'SRV-004', name: 'Cambio de Nosepads',             categoryId: catServicios.id,  costPrice:   0,  salePrice:   80, stock: 9999, brand: 'Mediwork'  },
  ];

  const products: Record<string, string> = {};
  for (const p of productSeed) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, active: true },
    });
    products[p.sku] = prod.id;
  }
  console.log('✓ Productos creados:', productSeed.length);

  // ── 3. Pacientes ───────────────────────────────────────────
  const patientSeed = [
    { fullName: 'María González Ruiz',    phone: '4921234567', email: 'maria@email.com',    gender: 'F' },
    { fullName: 'Carlos Hernández López', phone: '4929876543', email: 'carlos@email.com',   gender: 'M' },
    { fullName: 'Ana Martínez Flores',    phone: '4924561234', email: 'ana.mtz@email.com',  gender: 'F' },
    { fullName: 'Roberto Jiménez Vera',   phone: '4927890123', email: 'roberto@email.com',  gender: 'M' },
    { fullName: 'Laura Sánchez Moreno',   phone: '4923456789', email: 'laura.s@email.com',  gender: 'F' },
  ];

  const patientIds: string[] = [];
  for (const pt of patientSeed) {
    const existing = await prisma.patient.findFirst({ where: { phone: pt.phone } });
    if (existing) {
      patientIds.push(existing.id);
    } else {
      const created = await prisma.patient.create({ data: pt });
      patientIds.push(created.id);
    }
  }
  console.log('✓ Pacientes creados:', patientSeed.length);

  // ── 4. Ventas POS de ejemplo ───────────────────────────────
  // Función auxiliar para crear folio único
  let folioCounter = Date.now();
  const nextFolio = () => 'V-' + (folioCounter++).toString().slice(-8);

  const salesSeed = [
    // ---- LIQUIDADAS (pagadas al 100%) ----
    {
      label: 'Armazón + Lente Progresivo — LIQUIDADA',
      patientId: patientIds[0],
      lensType: 'Progresivo', lensEye: 'AMBOS',
      items: [
        { sku: 'ARM-001', qty: 1, price: 1200 },
        { sku: 'LEN-002', qty: 2, price: 2200 }, // ambos ojos
      ],
      deposit: null, depositMethod: null,
      status: 'LIQUIDADA',
    },
    {
      label: 'Lente Monofocal + Accesorios — LIQUIDADA',
      patientId: patientIds[1],
      lensType: 'Monofocal', lensEye: 'OD',
      items: [
        { sku: 'LEN-001', qty: 1, price: 550 },
        { sku: 'ACC-001', qty: 1, price: 120 },
        { sku: 'ACC-002', qty: 1, price: 35  },
      ],
      deposit: null, depositMethod: null,
      status: 'LIQUIDADA',
    },
    {
      label: 'Consulta + Armazón Deportivo — LIQUIDADA',
      patientId: patientIds[2],
      lensType: null, lensEye: null,
      items: [
        { sku: 'SRV-001', qty: 1, price: 350 },
        { sku: 'ARM-003', qty: 1, price: 650 },
      ],
      deposit: null, depositMethod: null,
      status: 'LIQUIDADA',
    },
    // ---- PENDIENTES (anticipo recibido, saldo por cobrar) ----
    {
      label: 'Lentes Fotocromáticos + Armazón — anticipo 50% PENDIENTE',
      patientId: patientIds[3],
      lensType: 'Fotocromático', lensEye: 'AMBOS',
      items: [
        { sku: 'ARM-002', qty: 1, price: 850  },
        { sku: 'LEN-005', qty: 2, price: 1650 }, // ambos ojos
      ],
      depositPct: 0.5, depositMethod: 'EFECTIVO',
      status: 'PENDIENTE',
    },
    {
      label: 'Progresivo Premium — anticipo $1,000 PENDIENTE',
      patientId: patientIds[4],
      lensType: 'Progresivo', lensEye: 'AMBOS',
      items: [
        { sku: 'ARM-004', qty: 1, price: 980  },
        { sku: 'LEN-002', qty: 2, price: 2200 },
      ],
      depositFixed: 1000, depositMethod: 'DEPOSITO',
      status: 'PENDIENTE',
    },
    {
      label: 'Bifocal OI + Antirreflejante — anticipo 30% PENDIENTE',
      patientId: patientIds[0],
      lensType: 'Bifocal', lensEye: 'OI',
      items: [
        { sku: 'ARM-005', qty: 1, price: 780 },
        { sku: 'LEN-003', qty: 1, price: 950 },
        { sku: 'LEN-004', qty: 1, price: 720 },
      ],
      depositPct: 0.3, depositMethod: 'EFECTIVO',
      status: 'PENDIENTE',
    },
    {
      label: 'Taller + Nosepads — mostrador LIQUIDADA',
      patientId: null,
      lensType: null, lensEye: null,
      items: [
        { sku: 'SRV-003', qty: 1, price: 200 },
        { sku: 'SRV-004', qty: 1, price:  80 },
      ],
      deposit: null, depositMethod: null,
      status: 'LIQUIDADA',
    },
    {
      label: 'Antirreflejante OD — anticipo efectivo PENDIENTE',
      patientId: patientIds[1],
      lensType: 'Antirreflejante', lensEye: 'OD',
      items: [
        { sku: 'LEN-004', qty: 1, price: 720 },
        { sku: 'ACC-003', qty: 1, price:  80 },
      ],
      depositFixed: 400, depositMethod: 'EFECTIVO',
      status: 'PENDIENTE',
    },
  ];

  let created = 0;
  for (const s of salesSeed) {
    // Calcular totales
    let subtotal = 0;
    const itemData: any[] = [];
    for (const it of s.items) {
      const pid = products[it.sku];
      if (!pid) { console.warn(`  ! SKU no encontrado: ${it.sku}`); continue; }
      const itSub = it.price * it.qty;
      subtotal += itSub;
      itemData.push({ productId: pid, quantity: it.qty, unitPrice: it.price, discount: 0, subtotal: itSub });
    }
    if (itemData.length === 0) continue;

    const tax = subtotal * 0.16;
    const total = subtotal + tax;
    let depositAmt = 0;
    if ((s as any).depositPct) depositAmt = Math.round(total * (s as any).depositPct * 100) / 100;
    if ((s as any).depositFixed) depositAmt = Math.min((s as any).depositFixed, total);
    const balance = Math.round((total - depositAmt) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      const folio = nextFolio();
      await tx.sale.create({
        data: {
          folio,
          patientId: s.patientId,
          vendorId: adminUser.id,
          subtotal,
          discount: 0,
          tax,
          total,
          deposit: depositAmt,
          balance,
          paymentMethod: (s.depositMethod as any) || 'EFECTIVO',
          depositMethod: (s.depositMethod as any) || null,
          lensType: s.lensType,
          lensEye: s.lensEye,
          status: s.status as any,
          notes: null,
          items: { create: itemData },
        },
      });
      // Descontar stock (solo productos físicos, no servicios con stock 9999)
      for (const it of s.items) {
        const pid = products[it.sku];
        if (!pid) continue;
        const prod = await tx.product.findUnique({ where: { id: pid }, select: { stock: true } });
        if (prod && prod.stock < 9000) {
          await tx.product.update({
            where: { id: pid },
            data: { stock: { decrement: it.qty }, lastMovementAt: new Date() },
          });
        }
      }
    });
    created++;
    console.log(`  + ${s.label} [${s.status}]`);
  }
  console.log(`✓ Ventas POS creadas: ${created}`);
  console.log('\n✅ Seed POS completado.');
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
