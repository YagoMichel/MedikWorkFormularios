import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired);

const schema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  date: z.string(),
  durationMin: z.number().int().min(5).max(240).default(30),
  type: z.enum(['PRIMERA_VEZ', 'SEGUIMIENTO', 'REVISION_LENTES', 'URGENCIA']).default('PRIMERA_VEZ'),
  status: z.enum(['AGENDADA', 'CONFIRMADA', 'EN_CONSULTA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO']).optional(),
  color: z.string().optional().nullable(),
  preNotes: z.string().optional().nullable(),
  postNotes: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res) => {
  const { from, to, doctorId, mine } = req.query as any;
  const where: any = {};
  if (mine === 'true' || req.user!.role === 'DOCTOR') where.doctorId = req.user!.id;
  if (doctorId) where.doctorId = doctorId;
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(from);
  if (to) where.date.lte = new Date(to);
  const list = await prisma.appointment.findMany({
    where,
    include: { patient: true, doctor: { select: { id: true, fullName: true } }, batch: { include: { company: true } } },
    orderBy: { date: 'asc' },
  });
  res.json(list);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const date = new Date(parsed.data.date);
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  // Cupo personalizado del dia, o default 20
  const cap = await prisma.dayCapacity.findUnique({ where: { date: dayStart } });
  if (cap?.blocked) {
    return res.status(409).json({ error: 'Esa fecha esta bloqueada para citas.' });
  }
  const max = cap?.maxPatients ?? 20;

  const ocupado = await prisma.appointment.count({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELADA', 'NO_ASISTIO'] },
    },
  });
  if (ocupado >= max) {
    return res.status(409).json({ error: `Cupo lleno para ese dia (${max} pacientes).` });
  }

  const data: any = { ...parsed.data, date };
  const a = await prisma.appointment.create({
    data,
    include: { patient: true, doctor: { select: { id: true, fullName: true } } },
  });
  emit('appointment:created', a);
  res.status(201).json(a);
});

router.put('/:id', async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.date) data.date = new Date(data.date);
  const a = await prisma.appointment.update({ where: { id: req.params.id }, data, include: { patient: true, doctor: { select: { id: true, fullName: true } } } });
  emit('appointment:updated', a);
  res.json(a);
});

router.delete('/:id', async (req, res) => {
  await prisma.appointment.delete({ where: { id: req.params.id } });
  emit('appointment:deleted', { id: req.params.id });
  res.json({ ok: true });
});

export default router;
