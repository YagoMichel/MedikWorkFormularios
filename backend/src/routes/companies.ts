import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();
router.use(authRequired);

const schema = z.object({
  name:        z.string().min(1),
  contactName: z.string().optional().nullable(),
  phone:       z.string().optional().nullable(),
  email:       z.string().email().optional().nullable().or(z.literal('')),
  address:     z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

router.get('/', async (_req, res) => {
  const list = await prisma.company.findMany({ orderBy: { name: 'asc' } });
  res.json(list);
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const company = await prisma.company.create({ data: parsed.data as any });
  res.status(201).json(company);
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const company = await prisma.company.update({ where: { id: req.params.id }, data: parsed.data as any });
  res.json(company);
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  // Eliminar citas y batches asociados primero
  const batches = await prisma.companyBatch.findMany({ where: { companyId: id }, select: { id: true } });
  for (const b of batches) {
    await prisma.appointment.deleteMany({ where: { batchId: b.id } });
  }
  await prisma.companyBatch.deleteMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
