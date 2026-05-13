import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authRequired);

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

router.get('/admin', requireRole('ADMIN'), async (_req, res) => {
  const today = startOfDay();
  const yesterday = new Date(today.getTime() - 86400000);
  const monthStart = startOfMonth();
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const [salesToday, salesYesterday, salesMonth, salesLastMonth, patientsToday, patientsYesterday, lowStock, last30, top5, lastSales, todaysAppointments, lowStockList, empresasCount] = await Promise.all([
    prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: today }, status: { not: 'CANCELADA' } } }),
    prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: yesterday, lt: today }, status: { not: 'CANCELADA' } } }),
    prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: monthStart }, status: { not: 'CANCELADA' } } }),
    prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: lastMonthStart, lt: monthStart }, status: { not: 'CANCELADA' } } }),
    prisma.appointment.count({ where: { date: { gte: today }, status: 'ATENDIDA' } }),
    prisma.appointment.count({ where: { date: { gte: yesterday, lt: today }, status: 'ATENDIDA' } }),
    prisma.product.count({ where: { active: true } }),
    prisma.$queryRawUnsafe<any[]>(`
      SELECT date_trunc('day', "createdAt")::date as day, COALESCE(SUM(total),0)::float as total
      FROM "Sale" WHERE "createdAt" >= $1 AND status != 'CANCELADA'
      GROUP BY day ORDER BY day ASC`, new Date(today.getTime() - 30 * 86400000)),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: monthStart }, status: { not: 'CANCELADA' } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { patient: true, vendor: { select: { fullName: true } } } }),
    prisma.appointment.findMany({ where: { date: { gte: today, lt: new Date(today.getTime() + 86400000) } }, include: { patient: true, doctor: { select: { fullName: true } } }, orderBy: { date: 'asc' } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { stock: 'asc' }, take: 20 }),
    prisma.company.count(),
  ]);

  // Stock crítico
  const allProducts = await prisma.product.findMany({ where: { active: true } });
  const lowStockCount = allProducts.filter((p) => p.stock <= p.minStock).length;
  const lowStockProducts = allProducts.filter((p) => p.stock <= p.minStock).slice(0, 10);

  // Top 5 product details
  const topIds = top5.map((t) => t.productId);
  const topProducts = await prisma.product.findMany({ where: { id: { in: topIds } } });
  const top5Full = top5.map((t) => {
    const p = topProducts.find((pp) => pp.id === t.productId);
    return { product: p, units: t._sum.quantity || 0, revenue: t._sum.subtotal || 0 };
  });

  // Inventario semanal últimas 4
  const weeks: any[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(today.getTime() - (i + 1) * 7 * 86400000);
    const end = new Date(today.getTime() - i * 7 * 86400000);
    const [ent, sal] = await Promise.all([
      prisma.movement.aggregate({ _sum: { quantity: true }, where: { type: 'ENTRADA', createdAt: { gte: start, lt: end } } }),
      prisma.movement.aggregate({ _sum: { quantity: true }, where: { type: 'SALIDA', createdAt: { gte: start, lt: end } } }),
    ]);
    weeks.push({ week: `Sem ${4 - i}`, entradas: ent._sum.quantity || 0, salidas: sal._sum.quantity || 0 });
  }

  res.json({
    kpis: {
      salesToday: { total: salesToday._sum.total || 0, count: salesToday._count, prevTotal: salesYesterday._sum.total || 0 },
      salesMonth: { total: salesMonth._sum.total || 0, count: salesMonth._count, prevTotal: salesLastMonth._sum.total || 0 },
      patientsToday: { count: patientsToday, prev: patientsYesterday },
      lowStock: { count: lowStockCount },
      empresas: { count: empresasCount },
    },
    revenue30d: last30,
    movementsByWeek: weeks,
    top5: top5Full,
    lastSales,
    todaysAppointments,
    lowStockProducts,
  });
});

router.get('/doctor', requireRole('DOCTOR', 'ADMIN'), async (req: AuthRequest, res) => {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 2 * 86400000);
  const doctorId = req.user!.id;

  const monthStart = startOfMonth();
  const [todays, tomorrows, lastRx, stats, citasMes, totalPacientes, proximaCita] = await Promise.all([
    prisma.appointment.findMany({ where: { doctorId, date: { gte: today, lt: tomorrow }, source: 'MANUAL' }, include: { patient: true }, orderBy: { date: 'asc' } }),
    prisma.appointment.findMany({ where: { doctorId, date: { gte: tomorrow, lt: dayAfter }, source: 'MANUAL' }, include: { patient: true }, orderBy: { date: 'asc' }, take: 3 }),
    prisma.prescription.findMany({ where: { doctorId }, include: { patient: true }, orderBy: { issuedAt: 'desc' }, take: 5 }),
    prisma.appointment.groupBy({ by: ['status'], where: { doctorId, date: { gte: today, lt: tomorrow }, source: 'MANUAL' }, _count: true }),
    Promise.all([
      prisma.appointment.count({ where: { doctorId, date: { gte: monthStart }, status: { not: 'CANCELADA' }, source: 'MANUAL' } }),
      prisma.companyBatch.count({ where: { date: { gte: monthStart }, status: { not: 'CANCELADO' }, appointments: { some: { doctorId } } } }),
    ]).then(([manual, batches]) => manual + batches),
    prisma.patient.count(),
    prisma.appointment.findFirst({ where: { doctorId, date: { gte: new Date() }, status: { notIn: ['CANCELADA', 'NO_ASISTIO'] } }, orderBy: { date: 'asc' }, include: { patient: true, batch: { include: { company: true } } } }),
  ]);

  const counts = { AGENDADA: 0, CONFIRMADA: 0, EN_CONSULTA: 0, ATENDIDA: 0, CANCELADA: 0, NO_ASISTIO: 0 };
  stats.forEach((s) => { (counts as any)[s.status] = s._count; });

  res.json({
    todays,
    tomorrows,
    lastPrescriptions: lastRx,
    stats: {
      total: todays.length,
      atendidas: counts.ATENDIDA,
      pendientes: counts.AGENDADA + counts.CONFIRMADA + counts.EN_CONSULTA,
      canceladas: counts.CANCELADA + counts.NO_ASISTIO,
    },
    citasMes,
    totalPacientes,
    proximaCita,
  });
});

export default router;
