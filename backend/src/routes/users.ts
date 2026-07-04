import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();

// Doctors list available to any authenticated user (needed for appointments)
router.get('/doctors', authRequired, async (_req, res) => {
  const docs = await prisma.user.findMany({ where: { role: 'DOCTOR', active: true }, select: { id: true, fullName: true } });
  res.json(docs);
});

router.use(authRequired, requireRole('ADMIN'));

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(['ADMIN', 'DOCTOR', 'AGENT', 'PACIENTE']),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, ...rest } = parsed.data;
  if (!password) return res.status(400).json({ error: 'Password required' });
  try {
    const u = await prisma.user.create({
      data: { ...rest, passwordHash: await bcrypt.hash(password, 12) },
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });
    res.status(201).json(u);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.password) { data.passwordHash = await bcrypt.hash(data.password, 12); delete data.password; }
  try {
    const u = await prisma.user.update({
      where: { id: req.params.id }, data,
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });
    res.json(u);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (target?.role === 'AGENT') {
      res.status(403).json({ error: 'El usuario de servicio AGENT no puede eliminarse' });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(409).json({ error: 'No se puede eliminar (usuario con datos asociados)' });
  }
});

export default router;
