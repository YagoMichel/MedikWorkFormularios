import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired);

const patientSchema = z.object({
  fullName: z.string().min(1),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  nss: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const q = (req.query.q as string) || '';
  const baseWhere = { NOT: { fullName: { startsWith: 'Trabajador ', mode: 'insensitive' as const } } };
  const patients = await prisma.patient.findMany({
    where: q
      ? { AND: [baseWhere, { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }] }
      : baseWhere,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(patients);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      appointments: { include: { doctor: { select: { fullName: true } } }, orderBy: { date: 'desc' } },
      prescriptions: { include: { doctor: { select: { fullName: true } } }, orderBy: { issuedAt: 'desc' } },
      sales: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.birthDate === '') data.birthDate = null;
  if (data.birthDate) data.birthDate = new Date(data.birthDate);
  if (data.email === '') data.email = null;
  const p = await prisma.patient.create({ data });
  emit('patient:created', p);
  res.status(201).json(p);
});

router.put('/:id', async (req, res) => {
  const parsed = patientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.birthDate === '') data.birthDate = null;
  if (data.birthDate) data.birthDate = new Date(data.birthDate);
  const p = await prisma.patient.update({ where: { id: req.params.id }, data });
  emit('patient:updated', p);
  res.json(p);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  emit('patient:deleted', { id: req.params.id });
  res.json({ ok: true });
});

export default router;
