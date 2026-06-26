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

// Leer el secreto desde variables de entorno (definido en .env)
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Genera un token JWT con duracion de 30 dias
export function signToken(payload: { id: string; role: Role; email: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
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

// Middleware: rechaza si el usuario no tiene alguno de los roles permitidos
// Ejemplo: requireRole('ADMIN') o requireRole('ADMIN', 'DOCTOR')
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
