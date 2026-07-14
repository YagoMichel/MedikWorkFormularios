import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';
import { logAudit } from '../services/audit';

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
  companyProfileId: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const SIN_EMPRESA = '__sin_empresa__';

async function companyIdForName(company: unknown): Promise<string | null> {
  if (typeof company !== 'string' || !company.trim() || company === 'Sin empresa') return null;
  const match = await prisma.company.findFirst({
    where: { name: { equals: company.trim(), mode: 'insensitive' } },
    select: { id: true },
  });
  return match?.id ?? null;
}

// Quita acentos/diacríticos para que la búsqueda "Maria" también encuentre "María"
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

router.get('/', async (req, res) => {
  const q = (req.query.q as string) || '';
  const company = (req.query.company as string) || '';
  const filters: any[] = [{ NOT: { fullName: { startsWith: 'Trabajador ', mode: 'insensitive' as const } } }];
  if (company === SIN_EMPRESA) filters.push({ OR: [{ company: null }, { company: '' }] });
  else if (company) filters.push({ company: { equals: company, mode: 'insensitive' as const } });

  if (q) {
    const candidatos = await prisma.patient.findMany({
      where: { AND: filters },
      orderBy: { createdAt: 'desc' },
    });
    const qNorm = normalizar(q);
    const patients = candidatos
      .filter(p => normalizar(p.fullName).includes(qNorm) || (p.phone && p.phone.includes(q)))
      .slice(0, 100);
    return res.json(patients);
  }

  const patients = await prisma.patient.findMany({
    where: { AND: filters },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(patients);
});

router.get('/:id', async (req: AuthRequest, res) => {
  const p = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      appointments: { include: { doctor: { select: { fullName: true } } }, orderBy: { date: 'desc' } },
      prescriptions: { include: { doctor: { select: { fullName: true } } }, orderBy: { issuedAt: 'desc' } },
      sales: { orderBy: { createdAt: 'desc' } },
      companyProfile: { include: { items: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  logAudit(req, 'PATIENT_VIEW', { targetType: 'Patient', targetId: p.id, patientId: p.id });
  res.json(p);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.birthDate === '') data.birthDate = null;
  if (data.birthDate) data.birthDate = new Date(data.birthDate);
  if (data.email === '') data.email = null;
  data.companyId = await companyIdForName(data.company);
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
  if (Object.prototype.hasOwnProperty.call(data, 'company')) data.companyId = await companyIdForName(data.company);
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
