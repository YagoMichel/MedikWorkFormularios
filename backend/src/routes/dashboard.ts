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

  const [salesToday, salesYesterday, salesMonth, salesLastMonth, patientsToday, patientsYesterday, lowStock, last30, top5, lastSales, todaysAppointments, lowStockList, empresasCount, pendingBatches, todaysBatches] = await Promise.all([
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
    prisma.companyBatch.count({ where: { status: 'BORRADOR' } }),
    prisma.companyBatch.findMany({ where: { date: { gte: today, lt: new Date(today.getTime() + 86400000) }, status: { not: 'CANCELADO' } }, include: { company: true }, orderBy: { date: 'asc' } }),
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
      pendingBatches: pendingBatches,
    },
    revenue30d: last30,
    movementsByWeek: weeks,
    top5: top5Full,
    lastSales,
    todaysAppointments,
    todaysBatches,
    lowStockProducts,
  });
});

router.get('/reportes', requireRole('ADMIN'), async (_req, res) => {
  const now = new Date();
  const TZ = 'America/Mexico_City';

  // Últimos 12 meses
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: TZ });
    months.push({ label, start, end });
  }

  const now2 = new Date();
  const [ventasMes, citasMes, top5Companies, top5Products, batchesByStatus, usuariosPorRol, totalPacientes, totalEmpresas, citasPendientes, citasConfirmadas, proximaCita] = await Promise.all([
    // Ventas mensuales
    Promise.all(months.map(async ({ label, start, end }) => {
      const r = await prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELADA' } } });
      return { mes: label, total: r._sum.total || 0, count: r._count };
    })),

    // Citas empresariales por mes
    Promise.all(months.map(async ({ label, start, end }) => {
      const count = await prisma.companyBatch.count({ where: { date: { gte: start, lt: end }, status: { not: 'CANCELADO' } } });
      const workers = await prisma.companyBatch.aggregate({ _sum: { expectedCount: true }, where: { date: { gte: start, lt: end }, status: { not: 'CANCELADO' } } });
      return { mes: label, citas: count, trabajadores: workers._sum.expectedCount || 0 };
    })),

    // Top 5 empresas por trabajadores atendidos
    prisma.companyBatch.groupBy({
      by: ['companyId'],
      _sum: { expectedCount: true },
      _count: true,
      where: { status: 'CONFIRMADO' },
      orderBy: { _sum: { expectedCount: 'desc' } },
      take: 5,
    }).then(async (rows) => {
      const ids = rows.map((r) => r.companyId);
      const companies = await prisma.company.findMany({ where: { id: { in: ids } } });
      return rows.map((r) => {
        const c = companies.find((c) => c.id === r.companyId);
        return { empresa: c?.name || '?', trabajadores: r._sum.expectedCount || 0, citas: r._count };
      });
    }),

    // Top 5 productos más vendidos (unidades) este año
    prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, subtotal: true },
      where: { sale: { createdAt: { gte: new Date(now.getFullYear(), 0, 1) }, status: { not: 'CANCELADA' } } },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }).then(async (rows) => {
      const ids = rows.map((r) => r.productId);
      const products = await prisma.product.findMany({ where: { id: { in: ids } } });
      return rows.map((r) => {
        const p = products.find((p) => p.id === r.productId);
        return { producto: p?.name || '?', unidades: r._sum.quantity || 0, ingresos: r._sum.subtotal || 0 };
      });
    }),

    // Distribución de batches por status
    prisma.companyBatch.groupBy({ by: ['status'], _count: true }),

    // Usuarios por rol (para pastel)
    prisma.user.groupBy({ by: ['role'], _count: true, where: { active: true } }),

    // Totales generales
    prisma.patient.count(),
    prisma.company.count(),

    // Citas por confirmar y confirmadas (futuras)
    prisma.appointment.count({ where: { date: { gte: now2 }, status: 'AGENDADA' } }),
    prisma.appointment.count({ where: { date: { gte: now2 }, status: 'CONFIRMADA' } }),
    prisma.appointment.findFirst({ where: { date: { gte: now2 }, status: { notIn: ['CANCELADA', 'NO_ASISTIO'] } }, orderBy: { date: 'asc' } }),
  ]);

  // KPIs derivados
  const citasConDatos = citasMes.filter((c: any) => c.citas > 0);
  const promedioCitasMes = citasConDatos.length > 0
    ? Math.round(citasMes.reduce((sum: number, c: any) => sum + c.citas, 0) / citasConDatos.length)
    : 0;
  const promedioTrabajadoresMes = citasConDatos.length > 0
    ? Math.round(citasMes.reduce((sum: number, c: any) => sum + c.trabajadores, 0) / citasConDatos.length)
    : 0;
  const totalCitasAnio = citasMes.reduce((sum: number, c: any) => sum + c.citas, 0);
  const totalTrabajadoresAnio = citasMes.reduce((sum: number, c: any) => sum + c.trabajadores, 0);

  const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', DOCTOR: 'Doctor', PACIENTE: 'Paciente', AGENT: 'Agente' };
  // AGENT es cuenta de servicio y MASTER es un rol privado: ninguno debe
  // aparecer en la gráfica de usuarios por rol.
  const usuariosPastel = usuariosPorRol
    .filter((u: any) => u.role !== 'AGENT' && u.role !== 'MASTER')
    .map((u: any) => ({ name: ROLE_LABELS[u.role] || u.role, value: u._count }));

  res.json({
    ventasMes, citasMes, top5Companies, top5Products, batchesByStatus,
    usuariosPastel,
    kpis: { promedioCitasMes, promedioTrabajadoresMes, totalCitasAnio, totalTrabajadoresAnio, totalPacientes, totalEmpresas },
    citasPendientes,
    citasConfirmadas,
    proximaCita: proximaCita ? proximaCita.date : null,
  });
});

router.get('/doctor', requireRole('DOCTOR', 'ADMIN'), async (req: AuthRequest, res) => {
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 2 * 86400000);
  const doctorId = req.user!.id;

  const monthStart = startOfMonth();
  const [todays, todaysBatches, tomorrows, lastRx, stats, citasMes, totalPacientes, proximaCita, recentPatients, recentAppointments, recentBatches] = await Promise.all([
    prisma.appointment.findMany({ where: { doctorId, date: { gte: today, lt: tomorrow }, batchId: null }, include: { patient: true }, orderBy: { date: 'asc' } }),
    prisma.companyBatch.findMany({ where: { date: { gte: today, lt: tomorrow }, status: { not: 'CANCELADO' } }, include: { company: true }, orderBy: { date: 'asc' } }),
    prisma.appointment.findMany({ where: { doctorId, date: { gte: tomorrow, lt: dayAfter }, batchId: null }, include: { patient: true }, orderBy: { date: 'asc' }, take: 3 }),
    prisma.prescription.findMany({ where: { doctorId }, include: { patient: true }, orderBy: { issuedAt: 'desc' }, take: 5 }),
    prisma.appointment.groupBy({ by: ['status'], where: { doctorId, date: { gte: today, lt: tomorrow }, batchId: null }, _count: true }),
    Promise.all([
      prisma.appointment.count({ where: { doctorId, date: { gte: monthStart }, status: { not: 'CANCELADA' }, batchId: null } }),
      prisma.companyBatch.count({ where: { date: { gte: monthStart }, status: { not: 'CANCELADO' }, appointments: { some: { doctorId } } } }),
    ]).then(([manual, batches]) => manual + batches),
    prisma.patient.count(),
    prisma.appointment.findFirst({ where: { doctorId, date: { gte: new Date() }, status: { notIn: ['CANCELADA', 'NO_ASISTIO'] } }, orderBy: { date: 'asc' }, include: { patient: true, batch: { include: { company: true } } } }),
    prisma.patient.findMany({ where: { createdAt: { gte: today, lt: tomorrow } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.appointment.findMany({ where: { doctorId, createdAt: { gte: today, lt: tomorrow }, batchId: null }, include: { patient: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.companyBatch.findMany({ where: { createdAt: { gte: today, lt: tomorrow } }, include: { company: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const counts = { AGENDADA: 0, CONFIRMADA: 0, EN_CONSULTA: 0, ATENDIDA: 0, CANCELADA: 0, NO_ASISTIO: 0 };
  stats.forEach((s) => { (counts as any)[s.status] = s._count; });

  const activities = [
    ...recentPatients.map((p: any) => ({ type: 'NEW_PATIENT', date: p.createdAt, title: 'Nuevo paciente registrado', subtitle: p.fullName })),
    ...recentAppointments.map((a: any) => {
      let subtitle = a.patient?.fullName;
      if (!subtitle) {
          if (a.batch?.company?.name === 'Sin Empresa') subtitle = 'Cita individual (Sin paciente)';
          else if (a.batch?.company?.name) subtitle = `Paciente de ${a.batch.company.name}`;
          else subtitle = 'Paciente empresarial';
      }
      return { type: 'NEW_APPOINTMENT', date: a.createdAt, title: 'Cita agendada', subtitle };
    }),
    ...recentBatches.map((b: any) => ({
      type: 'NEW_BATCH',
      date: b.createdAt,
      title: 'Jornada agendada',
      subtitle: b.company?.name === 'Sin Empresa' ? 'Jornada individual' : `Empresa: ${b.company?.name}`
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  res.json({
    todays,
    todaysBatches,
    tomorrows,
    lastPrescriptions: lastRx,
    stats: {
      total: todays.length + todaysBatches.length,
      atendidas: counts.ATENDIDA + todaysBatches.filter((b: any) => b.status === 'CERRADO').length,
      pendientes: counts.AGENDADA + counts.CONFIRMADA + counts.EN_CONSULTA + todaysBatches.filter((b: any) => b.status !== 'CERRADO' && b.status !== 'CANCELADO').length,
      canceladas: counts.CANCELADA + counts.NO_ASISTIO + todaysBatches.filter((b: any) => b.status === 'CANCELADO').length,
    },
    citasMes,
    totalPacientes,
    proximaCita,
    activities,
  });
});

export default router;
