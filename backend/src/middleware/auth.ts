// =============================================================
// ARCHIVO: src/middleware/auth.ts
// DESCRIPCION: Middleware de autenticacion JWT.
//              - authRequired: verifica que el token sea valido
//              - requireRole:  verifica que el usuario tenga el rol correcto
//              - signToken:    genera un token JWT al hacer login
// USO: app.use('/api/ruta', authRequired, requireRole('ADMIN'), handler)
// =============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

// Extiende Request para incluir el usuario decodificado del token
export interface AuthRequest extends Request {
  user?: { id: string; role: Role; email: string };
}

// Leer el secreto desde variables de entorno (definido en .env).
// En producción es obligatorio: un secreto por defecto permitiría a cualquiera
// firmar sus propios tokens y entrar como ADMIN.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET no está definido — es obligatorio en producción');
}
if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET no definido — usando secreto de desarrollo (NO usar en producción)');
}
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Nombre de la cookie httpOnly que acompaña al token del header. Existe para
// que recursos cargados sin JavaScript (ej. <img src="/uploads/...">) puedan
// autenticarse: el navegador la manda solo porque todo va por el mismo origen.
export const AUTH_COOKIE = 'mw_token';

// Duración de la sesión. Se acorta a 12h (antes 30 días) por ser un sistema con
// datos sensibles de salud: sesiones acotadas según LFPDPPP/NOM-024. Ajustable
// con SESSION_TTL (formato de `jsonwebtoken`, ej. '12h', '8h', '1d').
export const SESSION_TTL = process.env.SESSION_TTL || '12h';

// Genera un token JWT con la duración de SESSION_TTL
export function signToken(payload: { id: string; role: Role; email: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: SESSION_TTL as any });
}

// Middleware: rechaza peticiones sin token valido en el header Authorization
export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(auth.slice(7), SECRET) as any;
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Variante para archivos estáticos (/uploads): acepta el token del header
// Authorization O de la cookie httpOnly (los <img src> del navegador no pueden
// mandar headers, pero la cookie viaja sola al ser el mismo origen).
export function authRequiredCookieOrHeader(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : (req as any).cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET) as any;
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: rechaza si el usuario no tiene alguno de los roles permitidos
// Ejemplo: requireRole('ADMIN') o requireRole('ADMIN', 'DOCTOR')
// MASTER es un super-admin: cualquier ruta que acepte 'ADMIN' también la puede
// usar MASTER, sin tener que listar 'MASTER' en cada llamada a requireRole.
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const ok = roles.includes(req.user.role) || (req.user.role === 'MASTER' && roles.includes('ADMIN'));
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// MASTER u ADMIN — usar en checks inline (fuera de requireRole) que necesiten
// tratar a MASTER como admin con todos sus permisos.
export const isAdminLike = (role: Role) => role === 'ADMIN' || role === 'MASTER';
