// =============================================================
// ARCHIVO: src/services/storage/index.ts
// DESCRIPCION: Punto único para obtener el proveedor de almacenamiento en la
//              nube configurado (o null si no hay ninguno). Controlado por
//              CLOUD_STORAGE_PROVIDER=none|google|onedrive (default: none).
//              Si falta alguna variable del proveedor elegido, se loguea una
//              advertencia y se regresa null — nunca debe tumbar el server.
// =============================================================

import type { CloudStorageProvider } from './types';
import { googleDriveProvider } from './googleDriveProvider';
import { oneDriveProvider } from './oneDriveProvider';

export type { CloudFile, CloudStorageProvider } from './types';
export { buildPatientFolderPath } from './folderPath';

const REQUIRED_VARS: Record<string, string[]> = {
  google: ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_DRIVE_ROOT_FOLDER_ID'],
  onedrive: ['ONEDRIVE_TENANT_ID', 'ONEDRIVE_CLIENT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_DRIVE_USER'],
};

let warned = false;

export function getCloudStorageProvider(): CloudStorageProvider | null {
  const provider = (process.env.CLOUD_STORAGE_PROVIDER || 'none').toLowerCase();
  if (provider === 'none' || provider === '') return null;

  const required = REQUIRED_VARS[provider];
  if (!required) {
    if (!warned) { console.warn(`[storage] CLOUD_STORAGE_PROVIDER="${provider}" no reconocido (usa "google" u "onedrive")`); warned = true; }
    return null;
  }

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    if (!warned) { console.warn(`[storage] Faltan variables de entorno para "${provider}": ${missing.join(', ')}`); warned = true; }
    return null;
  }

  return provider === 'google' ? googleDriveProvider : oneDriveProvider;
}
