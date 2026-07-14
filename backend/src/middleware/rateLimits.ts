// =============================================================
// ARCHIVO: src/middleware/rateLimits.ts
// DESCRIPCION: Límites de peticiones (express-rate-limit) para
//              frenar fuerza bruta y bots en las rutas sensibles.
// NOTA: requiere app.set('trust proxy', 1) en index.ts para que
//       req.ip sea la IP real del cliente detrás de nginx.
// =============================================================

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Límite global de la API: tope alto pensado solo para frenar scraping o
// scripts descontrolados; el uso normal de la clínica (varios equipos tras la
// misma IP) queda muy por debajo.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
});

// Login por IP: solo cuentan los intentos FALLIDOS (skipSuccessfulRequests),
// así una tablet o consultorio compartiendo IP no se bloquea por uso normal.
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Espera 15 minutos.' },
});

// Login por cuenta (email): frena ataques dirigidos a un usuario concreto
// aunque vengan de muchas IPs distintas.
export const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Demasiados intentos fallidos para esta cuenta. Espera 15 minutos.' },
});

// Registro de pacientes: evita creación masiva de cuentas por bots.
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta red. Intenta más tarde.' },
});

// Recuperar contraseña: frena el envío masivo de correos de restablecimiento
// (abuso para spamear a un buzón o enumerar cuentas).
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});

// Encuesta pública: evita que un bot llene la BD de pacientes basura.
export const publicSurveyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos desde esta red. Intenta más tarde.' },
});

// Consulta de código postal (hace fetch a APIs externas — protegerla evita
// que usen nuestro servidor como proxy gratuito).
export const publicCpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas, intenta más tarde' },
});
