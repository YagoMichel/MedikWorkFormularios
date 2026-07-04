import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { signToken, authRequired, AuthRequest } from '../middleware/auth';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, photoUrl: user.photoUrl } });
});

router.get('/me', authRequired, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, photoUrl: user.photoUrl });
});

// Autoedición del perfil (nombre / correo) — cualquier usuario autenticado
// solo puede editarse a sí mismo (req.user.id viene del token, no del body)
const updateMeSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

router.put('/me', authRequired, async (req: AuthRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: parsed.data,
      select: { id: true, email: true, fullName: true, role: true, photoUrl: true },
    });
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

// Cambio de contraseña propio — exige la contraseña actual para autorizar el cambio
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put('/me/password', authRequired, async (req: AuthRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
  });
  res.json({ ok: true });
});

// Foto de perfil — se guarda en disco (mismo patron que documents.ts) y se
// referencia por URL en el campo User.photoUrl
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const AVATARS_DIR = path.join(UPLOAD_DIR, 'avatars');
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/me/photo', authRequired, upload.single('photo'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'El archivo debe ser una imagen' });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `${user.id}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(AVATARS_DIR, filename), req.file.buffer);

  // Borra la foto anterior para no acumular archivos huérfanos
  if (user.photoUrl) {
    const prevPath = path.join(UPLOAD_DIR, user.photoUrl.replace(/^\/uploads\//, ''));
    if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
  }

  const photoUrl = `/uploads/avatars/${filename}`;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { photoUrl },
    select: { id: true, email: true, fullName: true, role: true, photoUrl: true },
  });
  res.json(updated);
});

export default router;
