// =============================================================
// ARCHIVO: src/middleware/surveyAntiBot.ts
// DESCRIPCION: Defensa anti-bots de la encuesta PÚBLICA sin depender de un
//   servicio externo (funciona aunque Turnstile no esté configurado). Dos capas:
//
//   1) Token de tiempo firmado por el servidor: el frontend pide un token al
//      cargar la encuesta (issueSurveyChallenge) y lo devuelve al enviar. Esto
//      corta de raíz a los bots que hacen POST directo al endpoint (no tienen
//      token) y a los envíos instantáneos (la encuesta ocupacional toma minutos,
//      así que menos de MIN_FILL_MS = automatizado).
//   2) Honeypot: un campo trampa oculto que un humano nunca ve ni llena; si
//      llega con valor, es un bot que rellenó todos los campos de la página.
//
//   Al detectar bot se responde un "éxito" falso (200) SIN escribir en la BD,
//   para no darle pistas al atacante de que fue bloqueado. Se combina con el
//   rate limit por IP (publicSurveyLimiter) y con Turnstile si algún día se
//   activan las claves.
// =============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const MIN_FILL_MS = 5000;   // < 5 s desde que cargó el formulario = bot
const TOKEN_TTL = '30m';    // el formulario debe enviarse dentro de este plazo
const HONEYPOT_FIELD = 'hp_extra';

// GET /api/public/survey/challenge — entrega un token firmado con la marca de
// tiempo del servidor. El frontend lo pide al abrir la encuesta.
export function issueSurveyChallenge(_req: Request, res: Response) {
  const token = jwt.sign({ p: 'survey' }, SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token });
}

// Middleware para el POST de la encuesta pública.
export function surveyAntiBot(req: Request, res: Response, next: NextFunction) {
  // 1. Honeypot: campo trampa oculto. Si viene con texto, es un bot.
  const honey = req.body?.[HONEYPOT_FIELD];
  if (typeof honey === 'string' && honey.trim() !== '') {
    return res.status(200).json({ ok: true }); // finge éxito, no crea nada
  }

  // 2. Token de tiempo firmado por el servidor.
  const token = req.body?.formToken;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Recarga la página e intenta de nuevo (verificación de seguridad).' });
  }

  let payload: any;
  try {
    payload = jwt.verify(token, SECRET); // rechaza firmas inválidas y expiradas (30 min)
  } catch {
    return res.status(400).json({ error: 'La página estuvo abierta demasiado tiempo. Recárgala e intenta de nuevo.' });
  }
  if (payload?.p !== 'survey' || typeof payload?.iat !== 'number') {
    return res.status(400).json({ error: 'Verificación de seguridad inválida. Recarga la página.' });
  }

  // Tiempo transcurrido desde que el servidor emitió el token (no se confía en
  // el reloj del cliente). Envío casi instantáneo = automatizado.
  const ageMs = Date.now() - payload.iat * 1000;
  if (ageMs < MIN_FILL_MS) {
    return res.status(200).json({ ok: true }); // demasiado rápido = bot; éxito falso
  }

  next();
}
