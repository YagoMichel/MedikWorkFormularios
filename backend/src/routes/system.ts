// =============================================================
// ARCHIVO: src/routes/system.ts
// DESCRIPCION: Panel de estado de integraciones, exclusivo de MASTER (no
//              ADMIN) — pensado para que quien da soporte técnico a la
//              clínica pueda ver de un vistazo qué está fallando sin tener
//              que entrar a los logs del servidor.
// =============================================================

import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth';
import { getCloudStorageProvider } from '../services/storage';
import { prisma } from '../prisma';

const router = Router();

router.use(authRequired, requireRole('MASTER'));

type CheckStatus = true | false | null; // ok / con error / desactivado a propósito

interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

router.get('/status', async (_req, res) => {
  const checks: Check[] = [];

  // Base de datos
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ key: 'database', label: 'Base de datos', status: true });
  } catch (e: any) {
    checks.push({ key: 'database', label: 'Base de datos', status: false, detail: e.message });
  }

  // Sincronización del expediente documental (OneDrive / Google Drive)
  const providerName = (process.env.CLOUD_STORAGE_PROVIDER || 'none').toLowerCase();
  if (providerName === 'none' || providerName === '') {
    checks.push({
      key: 'cloudStorage', label: 'Expediente en la nube', status: null,
      detail: 'Desactivado (CLOUD_STORAGE_PROVIDER=none) — los documentos se guardan solo en disco local',
    });
  } else {
    const provider = getCloudStorageProvider();
    if (!provider) {
      checks.push({
        key: 'cloudStorage', label: `Expediente en la nube (${providerName})`, status: false,
        detail: 'Faltan variables de entorno para este proveedor, o el nombre no es válido — revisa el .env',
      });
    } else {
      try {
        // Carpeta que casi seguro no existe: solo sirve para ejercitar la
        // autenticación real contra el proveedor sin subir ni borrar nada.
        await provider.listFiles(['__mediwork_status_check__']);
        checks.push({ key: 'cloudStorage', label: `Expediente en la nube (${providerName})`, status: true });
      } catch (e: any) {
        checks.push({
          key: 'cloudStorage', label: `Expediente en la nube (${providerName})`, status: false,
          detail: e.message,
        });
      }
    }
  }

  res.json({ checks, checkedAt: new Date().toISOString() });
});

export default router;
