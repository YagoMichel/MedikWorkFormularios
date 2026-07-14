import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole, isAdminLike, AuthRequest } from '../middleware/auth';
import { createAuthToken } from '../services/authTokens';
import { sendCompanyActivationEmail, isEmailConfigured, APP_URL } from '../services/email';
import { logAudit } from '../services/audit';

const router = Router();

// Doctors list available to any authenticated user (needed for appointments)
router.get('/doctors', authRequired, async (_req, res) => {
  const docs = await prisma.user.findMany({ where: { role: 'DOCTOR', active: true }, select: { id: true, fullName: true } });
  res.json(docs);
});

router.use(authRequired, requireRole('ADMIN'));

// Solo MASTER puede crear/editar/eliminar cuentas ADMIN o MASTER; un ADMIN
// normal no puede tocar cuentas de su mismo nivel o superiores.
const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(['ADMIN', 'DOCTOR', 'AGENT', 'PACIENTE_TABLET', 'PACIENTE', 'EMPRESA', 'MASTER']),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

// -------- Cuenta de EMPRESA (portal) — la crea el personal --------
// No se envía contraseña por correo: se manda un enlace de activación con el
// que la empresa define su propia contraseña. Ver services/email.ts.
const companyAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  companyId: z.string().min(1),
});

router.post('/company-account', async (req: AuthRequest, res) => {
  const parsed = companyAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos (correo, nombre de contacto y empresa son requeridos)' });
  const { email, fullName, companyId } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

  try {
    // Contraseña aleatoria inutilizable: la real se define al activar.
    const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        fullName,
        role: 'EMPRESA',
        companyId,
        passwordHash: placeholder,
        emailVerified: false,
        active: true,
      },
      select: { id: true, email: true, fullName: true },
    });

    const token = await createAuthToken(user.id, 'ACTIVATION', 48);
    await sendCompanyActivationEmail(emailNorm, fullName, token);
    logAudit(req, 'USER_CREATE', { targetType: 'User', targetId: user.id, detail: `cuenta empresa: ${emailNorm} (${company.name})` });

    // En dev (sin SMTP) devolvemos el enlace para que el personal lo comparta a mano.
    const activationLink = isEmailConfigured ? undefined : `${APP_URL}/activar?token=${token}`;
    res.status(201).json({ id: user.id, email: user.email, company: company.name, emailSent: isEmailConfigured, activationLink });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

// PATCH /users/:id/link-patient — liga (o desliga con patientId=null) una
// cuenta PACIENTE a su expediente. Lo hace el personal (ADMIN).
router.patch('/:id/link-patient', async (req: AuthRequest, res) => {
  const patientId = req.body?.patientId ?? null;
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.role !== 'PACIENTE') return res.status(400).json({ error: 'Solo se pueden ligar cuentas de tipo Paciente' });

  if (patientId) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return res.status(404).json({ error: 'Expediente no encontrado' });
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { patientId },
      select: { id: true, patientId: true },
    });
    logAudit(req, 'USER_UPDATE', { targetType: 'User', targetId: req.params.id, detail: patientId ? `ligar expediente ${patientId}` : 'desligar expediente' });
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese expediente ya está ligado a otra cuenta' });
    throw err;
  }
});

router.get('/', async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, fullName: true, role: true, active: true, emailVerified: true, createdAt: true,
      company: { select: { id: true, name: true } },
      patient: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  // El rol MASTER es privado: solo otra cuenta MASTER puede saber que existe.
  const visible = req.user!.role === 'MASTER' ? users : users.filter((u) => u.role !== 'MASTER');
  res.json(visible);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (isAdminLike(parsed.data.role) && req.user!.role !== 'MASTER') {
    return res.status(403).json({ error: 'Solo un Master puede crear cuentas Admin o Master' });
  }
  const { password, ...rest } = parsed.data;
  if (!password) return res.status(400).json({ error: 'Password required' });
  try {
    const u = await prisma.user.create({
      data: { ...rest, passwordHash: await bcrypt.hash(password, 12) },
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });
    logAudit(req, 'USER_CREATE', { targetType: 'User', targetId: u.id, detail: `${u.email} rol=${u.role}` });
    res.status(201).json(u);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (req.user!.role !== 'MASTER') {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    const targetIsAdminLike = target ? isAdminLike(target.role) : false;
    const nextRoleIsAdminLike = parsed.data.role ? isAdminLike(parsed.data.role) : false;
    if (targetIsAdminLike || nextRoleIsAdminLike) {
      return res.status(403).json({ error: 'Solo un Master puede editar cuentas Admin o Master' });
    }
  }
  const data: any = { ...parsed.data };
  const passwordChanged = !!data.password;
  if (data.password) { data.passwordHash = await bcrypt.hash(data.password, 12); delete data.password; }
  const prev = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
  try {
    const u = await prisma.user.update({
      where: { id: req.params.id }, data,
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });
    // Cambio de rol/permisos: se registra aparte por ser sensible.
    if (parsed.data.role && prev && parsed.data.role !== prev.role) {
      logAudit(req, 'ROLE_CHANGE', { targetType: 'User', targetId: u.id, detail: `${prev.role} → ${u.role}` });
    }
    logAudit(req, 'USER_UPDATE', { targetType: 'User', targetId: u.id, detail: passwordChanged ? `${u.email} (incluye contraseña)` : u.email });
    res.json(u);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw err;
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (target?.role === 'AGENT') {
      res.status(403).json({ error: 'El usuario de servicio AGENT no puede eliminarse' });
      return;
    }
    if (target && isAdminLike(target.role) && req.user!.role !== 'MASTER') {
      res.status(403).json({ error: 'Solo un Master puede eliminar cuentas Admin o Master' });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    logAudit(req, 'USER_DELETE', { targetType: 'User', targetId: req.params.id, detail: `rol=${target?.role ?? '?'}` });
    res.status(204).end();
  } catch {
    res.status(409).json({ error: 'No se puede eliminar (usuario con datos asociados)' });
  }
});

export default router;
