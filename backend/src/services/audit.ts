// =============================================================
// ARCHIVO: src/services/audit.ts
// DESCRIPCION: Bitácora de auditoría (LFPDPPP / NOM-024-SSA3-2012).
//   Punto único de escritura para registrar accesos y operaciones
//   sobre datos sensibles. Es "fire-and-forget": nunca debe frenar
//   ni romper la petición del usuario — si la escritura falla, solo
//   se registra en consola.
//
//   NUNCA se guardan contraseñas ni tokens en `detail`.
// =============================================================
import { AuditAction, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth';

interface AuditExtra {
  // Actor cuando NO viene del token (ej. login fallido: email del body).
  userId?: string | null;
  userEmail?: string | null;
  userRole?: Role | null;
  // Objetivo de la acción.
  targetType?: 'Document' | 'Patient' | 'User' | string;
  targetId?: string | null;
  patientId?: string | null;
  detail?: string | null;
}

// Registra un evento en la bitácora. Toma el actor y la IP/User-Agent del
// request autenticado; `extra` permite sobrescribir el actor (login fallido) y
// añadir el objetivo. Se llama SIN await en el happy path de las rutas.
export function logAudit(req: AuthRequest, action: AuditAction, extra: AuditExtra = {}) {
  const ua = req.headers['user-agent'];
  prisma.auditLog
    .create({
      data: {
        action,
        userId: extra.userId !== undefined ? extra.userId : req.user?.id ?? null,
        userEmail: extra.userEmail !== undefined ? extra.userEmail : req.user?.email ?? null,
        userRole: extra.userRole !== undefined ? extra.userRole : req.user?.role ?? null,
        targetType: extra.targetType ?? null,
        targetId: extra.targetId ?? null,
        patientId: extra.patientId ?? null,
        detail: extra.detail ?? null,
        ip: req.ip ?? null,
        userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null,
      },
    })
    .catch((err) => console.error('[audit] no se pudo registrar', action, err?.message));
}
