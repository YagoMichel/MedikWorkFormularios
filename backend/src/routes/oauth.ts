// =============================================================
// ARCHIVO: src/routes/oauth.ts
// DESCRIPCION: Endpoints del login social (Google/Microsoft), montados
//   en /api/auth/oauth. Config-gated: si un proveedor no tiene
//   credenciales, sus rutas responden 404 y el botón no aparece.
//
//   Reglas de cuenta (confirmadas):
//     - correo existe y es rol de portal (PACIENTE/EMPRESA) → inicia sesión
//     - correo existe pero es rol interno (ADMIN/DOCTOR/…) → se rechaza
//       (el personal entra con contraseña, no por social)
//     - correo NO existe → se crea una cuenta PACIENTE ya verificada
// =============================================================
import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { autoLinkPatientByVerifiedEmail } from '../services/patientLink';
import { signToken, AUTH_COOKIE } from '../middleware/auth';
import { APP_URL } from '../services/email';
import { getProvider, enabledProviders, buildAuthUrl, exchangeCode, signState, verifyState } from '../services/oauth';
import { logAudit } from '../services/audit';

const router = Router();
const PORTAL_ROLES = ['PACIENTE', 'EMPRESA'];

// Mismas opciones que la cookie de sesión del login normal (ver routes/auth.ts).
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000,
  path: '/',
};

// Qué proveedores están activos (para el frontend).
router.get('/config', (_req, res) => res.json(enabledProviders()));

// Inicio: redirige al consentimiento del proveedor con un state firmado (CSRF).
router.get('/:provider/start', (req, res) => {
  const cfg = getProvider(req.params.provider);
  if (!cfg) return res.status(404).send('Proveedor de inicio de sesión no disponible');
  const state = signState(cfg.id);
  res.redirect(buildAuthUrl(cfg, state));
});

// Callback: el proveedor regresa aquí con ?code&state.
router.get('/:provider/callback', async (req, res) => {
  const cfg = getProvider(req.params.provider);
  if (!cfg) return res.status(404).send('Proveedor de inicio de sesión no disponible');

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !verifyState(state, cfg.id)) {
    return res.redirect(`${APP_URL}/login?error=oauth_state`);
  }

  try {
    const { email, emailVerified, name } = await exchangeCode(cfg, code);
    if (!email || !emailVerified) return res.redirect(`${APP_URL}/login?error=oauth_email`);

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // El personal interno no entra por social.
      if (!PORTAL_ROLES.includes(user.role)) return res.redirect(`${APP_URL}/login?error=oauth_staff`);
      if (!user.active) return res.redirect(`${APP_URL}/login?error=oauth_inactive`);
      // El login social prueba la posesión del correo → verificarlo si faltaba.
      if (!user.emailVerified) {
        user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      }
    } else {
      // Correo nuevo → cuenta PACIENTE con contraseña inservible (solo entra por
      // social hasta que use "recuperar contraseña" para fijar una).
      const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
      user = await prisma.user.create({
        data: { email, fullName: name || email, role: 'PACIENTE', passwordHash: placeholder, emailVerified: true, active: true },
      });
    }

    // Correo verificado por el proveedor → ligar su expediente por correo (si
    // llenó la encuesta con este mismo correo) para que consulte sus resultados.
    if (user.role === 'PACIENTE') await autoLinkPatientByVerifiedEmail(user.id, user.email);

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    res.cookie(AUTH_COOKIE, token, cookieOptions);
    logAudit(req, 'LOGIN_SUCCESS', { userId: user.id, userEmail: user.email, userRole: user.role, detail: `via ${cfg.id}` });
    // El token viaja en el fragmento (#): no se manda al servidor ni en el referer.
    return res.redirect(`${APP_URL}/oauth/callback#token=${token}`);
  } catch (err: any) {
    console.error('[oauth callback]', cfg.id, err.message);
    return res.redirect(`${APP_URL}/login?error=oauth_failed`);
  }
});

export default router;
