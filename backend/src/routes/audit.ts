// =============================================================
// ARCHIVO: src/routes/audit.ts
// DESCRIPCION: Consulta de la bitácora de auditoría (solo ADMIN/MASTER).
//   Solo lectura: la pista de auditoría no se edita ni se borra desde
//   la app (integridad — requisito LFPDPPP/NOM-024). El registro de
//   eventos lo hace services/audit.ts desde cada ruta.
// =============================================================
import { Router } from 'express';
import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
// requireRole('ADMIN') ya deja pasar a MASTER (regla MASTER→ADMIN en el middleware).
router.use(authRequired, requireRole('ADMIN'));

const ACTIONS = new Set(Object.values(AuditAction));

// GET /api/audit — lista paginada con filtros por usuario, paciente, acción y
// rango de fechas. Devuelve { items, total } para paginar en el frontend.
router.get('/', async (req: AuthRequest, res) => {
  const { userId, patientId, action, from, to } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt((req.query.take as string) || '100'), 500);
  const skip = Math.max(parseInt((req.query.skip as string) || '0'), 0);

  const where: Prisma.AuditLogWhereInput = {};
  if (userId) where.userId = userId;
  if (patientId) where.patientId = patientId;
  if (action && ACTIONS.has(action as AuditAction)) where.action = action as AuditAction;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(`${from}T00:00:00`);
    if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(`${to}T23:59:59`);
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // El actor puede haberse borrado; adjuntamos su nombre actual si sigue existiendo.
  const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean) as string[])];
  const patientIds = [...new Set(items.map((i) => i.patientId).filter(Boolean) as string[])];
  const [users, patients] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [],
    patientIds.length ? prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const userName = new Map(users.map((u) => [u.id, u.fullName]));
  const patientName = new Map(patients.map((p) => [p.id, p.fullName]));

  res.json({
    total,
    take,
    skip,
    items: items.map((i) => ({
      ...i,
      userName: i.userId ? userName.get(i.userId) ?? null : null,
      patientName: i.patientId ? patientName.get(i.patientId) ?? null : null,
    })),
  });
});

// GET /api/audit/actions — catálogo de acciones para el filtro del frontend
router.get('/actions', (_req, res) => {
  res.json(Object.values(AuditAction));
});

export default router;
