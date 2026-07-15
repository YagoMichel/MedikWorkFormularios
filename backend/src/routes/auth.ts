import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { signToken, authRequired, AuthRequest, AUTH_COOKIE } from '../middleware/auth';
import { loginIpLimiter, loginEmailLimiter, signupLimiter, passwordResetLimiter } from '../middleware/rateLimits';
import { verifyTurnstile } from '../middleware/turnstile';
import { logAudit } from '../services/audit';
import jwt from 'jsonwebtoken';
import { createAuthToken, findValidToken, markTokenUsed } from '../services/authTokens';
import { autoLinkPatientByVerifiedEmail } from '../services/patientLink';
import { sendPatientVerificationEmail, sendPasswordResetEmail, isEmailConfigured, APP_URL } from '../services/email';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Roles de portal externo que exigen correo verificado antes de entrar.
// Los roles internos (ADMIN, DOCTOR, etc.) no pasan por verificación.
const PORTAL_ROLES = ['PACIENTE', 'EMPRESA'] as const;

// Opciones de la cookie de sesión (espejo del JWT del header, ver AUTH_COOKIE)
const cookieOptions = {
  httpOnly: true,               // inaccesible desde JavaScript (mitiga robo por XSS)
  sameSite: 'lax' as const,     // no viaja en peticiones cross-site (mitiga CSRF)
  secure: process.env.NODE_ENV === 'production', // solo HTTPS en producción
  maxAge: 12 * 60 * 60 * 1000, // misma vida que el JWT (12 h, ver SESSION_TTL)
  path: '/',
};

router.post('/login', loginIpLimiter, loginEmailLimiter, verifyTurnstile, async (req: AuthRequest, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    logAudit(req, 'LOGIN_FAILED', { userEmail: email, userId: user?.id ?? null, userRole: user?.role ?? null, detail: user ? 'cuenta inactiva' : 'usuario inexistente' });
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    logAudit(req, 'LOGIN_FAILED', { userEmail: user.email, userId: user.id, userRole: user.role, detail: 'contraseña incorrecta' });
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  // Los portales externos (paciente/empresa) exigen correo verificado / cuenta activada.
  if ((PORTAL_ROLES as readonly string[]).includes(user.role) && !user.emailVerified) {
    logAudit(req, 'LOGIN_FAILED', { userEmail: user.email, userId: user.id, userRole: user.role, detail: 'correo no verificado' });
    return res.status(403).json({ error: 'Tu cuenta aún no está verificada. Revisa tu correo.', code: 'UNVERIFIED' });
  }
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
  logAudit(req, 'LOGIN_SUCCESS', { userId: user.id, userEmail: user.email, userRole: user.role });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, photoUrl: user.photoUrl } });
});

// Cierra sesión: borra la cookie httpOnly (el frontend limpia su localStorage)
router.post('/logout', (req: AuthRequest, res) => {
  // El logout no pasa por authRequired (para que funcione incluso con token ya
  // vencido); identificamos al actor decodificando el token de la cookie/header.
  const raw = (req as any).cookies?.[AUTH_COOKIE]
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (raw) {
    try {
      const d = jwt.decode(raw) as any;
      if (d?.id) logAudit(req, 'LOGOUT', { userId: d.id, userEmail: d.email, userRole: d.role });
    } catch { /* token ilegible — no registramos actor */ }
  }
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// =============================================================
// REGISTRO DE PACIENTE (público) + verificación de correo
// =============================================================
const signupSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /api/auth/signup — crea una cuenta PACIENTE sin verificar y envía el
// correo de verificación. La liga a un expediente la hace luego el personal.
router.post('/signup', signupLimiter, verifyTurnstile, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos (revisa nombre, correo y contraseña de 8+ caracteres)' });
  const { fullName, email, password } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    // No revelamos si el correo ya existe (evita enumeración de cuentas):
    // respondemos igual que en el caso exitoso.
    return res.status(201).json({ ok: true });
  }

  const user = await prisma.user.create({
    data: {
      email: emailNorm,
      fullName,
      role: 'PACIENTE',
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: false,
    },
  });

  const token = await createAuthToken(user.id, 'EMAIL_VERIFICATION', 48);
  await sendPatientVerificationEmail(emailNorm, fullName, token);
  // Sin SMTP devolvemos el enlace para mostrarlo en pantalla (modo dev). Con
  // SMTP configurado NO se devuelve — solo viaja por correo.
  const verificationLink = isEmailConfigured ? undefined : `${APP_URL}/verificar?token=${token}`;
  res.status(201).json({ ok: true, emailSent: isEmailConfigured, verificationLink });
});

// POST /api/auth/verify-email — confirma el correo del paciente con el token
router.post('/verify-email', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const valid = await findValidToken(token, 'EMAIL_VERIFICATION');
  if (!valid) return res.status(400).json({ error: 'Enlace inválido o caducado. Regístrate de nuevo.' });
  const user = await prisma.user.update({
    where: { id: valid.userId },
    data: { emailVerified: true },
    select: { id: true, email: true },
  });
  await markTokenUsed(valid.id);
  // Correo ya verificado → ligar su expediente (si llenó la encuesta con este
  // mismo correo) para que pueda consultar su formulario y resultados.
  const linkedPatientId = await autoLinkPatientByVerifiedEmail(user.id, user.email);
  res.json({ ok: true, linked: !!linkedPatientId });
});

// =============================================================
// RECUPERAR CONTRASEÑA (paciente / empresa / cualquier cuenta)
// =============================================================

// POST /api/auth/forgot-password — envía el enlace de restablecimiento.
// SIEMPRE responde 200 genérico (no revela si el correo existe → evita
// enumeración de cuentas). Rate-limited + captcha.
router.post('/forgot-password', passwordResetLimiter, verifyTurnstile, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  if (!email) return res.status(400).json({ error: 'Correo requerido' });

  const user = await prisma.user.findUnique({ where: { email } });
  let resetLink: string | undefined;
  // Solo se envía si la cuenta existe y está activa; en cualquier caso la
  // respuesta es idéntica para no filtrar qué correos están registrados.
  if (user && user.active) {
    const token = await createAuthToken(user.id, 'PASSWORD_RESET', 1); // 1h de vida
    await sendPasswordResetEmail(email, user.fullName, token);
    // Sin SMTP (dev) devolvemos el enlace para mostrarlo en pantalla.
    if (!isEmailConfigured) resetLink = `${APP_URL}/restablecer?token=${token}`;
  }
  res.json({ ok: true, emailSent: isEmailConfigured, resetLink });
});

// POST /api/auth/reset-password — fija la contraseña nueva con el token del correo.
const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
router.post('/reset-password', async (req: AuthRequest, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  const valid = await findValidToken(parsed.data.token, 'PASSWORD_RESET');
  if (!valid) return res.status(400).json({ error: 'Enlace inválido o caducado. Solicita uno nuevo.' });
  // Restablecer la contraseña prueba la posesión del correo → se marca verificado.
  await prisma.user.update({
    where: { id: valid.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), emailVerified: true },
  });
  await markTokenUsed(valid.id);
  logAudit(req, 'PASSWORD_CHANGE', { targetType: 'User', targetId: valid.userId, detail: 'restablecer contraseña' });
  res.json({ ok: true });
});

// POST /api/auth/activate — la EMPRESA define su contraseña por primera vez.
// El token de activación lo generó el personal al crear la cuenta.
const activateSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
router.post('/activate', async (req, res) => {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  const valid = await findValidToken(parsed.data.token, 'ACTIVATION');
  if (!valid) return res.status(400).json({ error: 'Enlace inválido o caducado. Pide a la clínica uno nuevo.' });
  await prisma.user.update({
    where: { id: valid.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), emailVerified: true, active: true },
  });
  await markTokenUsed(valid.id);
  res.json({ ok: true });
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
  logAudit(req, 'PASSWORD_CHANGE', { targetType: 'User', targetId: user.id });
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
