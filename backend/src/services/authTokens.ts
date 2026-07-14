// =============================================================
// ARCHIVO: src/services/authTokens.ts
// DESCRIPCION: Genera y valida tokens de un solo uso (activación de
//              empresa, verificación de correo). En la BD solo se guarda
//              el hash SHA-256 del token; el token en claro solo viaja en
//              el enlace del correo. Así una fuga de BD no da tokens usables.
// =============================================================

import crypto from 'crypto';
import { prisma } from '../prisma';
import { AuthTokenType } from '@prisma/client';

const hash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

// Crea un token nuevo, invalidando los anteriores del mismo tipo para ese
// usuario (para que un enlace viejo deje de servir). Devuelve el token EN CLARO.
export async function createAuthToken(userId: string, type: AuthTokenType, ttlHours: number): Promise<string> {
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const raw = crypto.randomBytes(32).toString('hex');
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  });
  return raw;
}

// Valida un token en claro: devuelve el userId si es válido (existe, tipo
// correcto, no usado, no caducado). No lo marca como usado todavía.
export async function findValidToken(raw: string, type: AuthTokenType): Promise<{ id: string; userId: string } | null> {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!record || record.type !== type) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;
  return { id: record.id, userId: record.userId };
}

export async function markTokenUsed(id: string) {
  await prisma.authToken.update({ where: { id }, data: { usedAt: new Date() } });
}
