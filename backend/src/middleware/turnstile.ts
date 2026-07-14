// =============================================================
// ARCHIVO: src/middleware/turnstile.ts
// DESCRIPCION: Verificación de captcha Cloudflare Turnstile.
//              Protege login y encuesta pública contra bots.
//
// ACTIVACION: solo actúa si TURNSTILE_SECRET_KEY está definida en
// el .env — sin ella el middleware deja pasar todo (modo dev).
// El frontend necesita la clave pública en VITE_TURNSTILE_SITE_KEY.
// Ambas claves se crean gratis en https://dash.cloudflare.com → Turnstile.
// =============================================================

import { Request, Response, NextFunction } from 'express';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return next(); // captcha no configurado — no bloquear

  const token = req.body?.turnstileToken;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Completa la verificación de seguridad (captcha)' });
  }

  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await r.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('[turnstile] verificación fallida:', data['error-codes']);
      return res.status(400).json({ error: 'Verificación de seguridad fallida. Recarga la página e intenta de nuevo.' });
    }
    next();
  } catch (err: any) {
    // Si Cloudflare no responde, no dejamos fuera a usuarios legítimos:
    // el rate limiting sigue activo como segunda barrera.
    console.error('[turnstile] error verificando (se permite pasar):', err.message);
    next();
  }
}
