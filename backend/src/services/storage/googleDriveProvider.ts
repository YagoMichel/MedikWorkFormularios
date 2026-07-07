// =============================================================
// ARCHIVO: src/services/storage/googleDriveProvider.ts
// DESCRIPCION: Implementación de CloudStorageProvider contra Google Drive.
//              Usa OAuth2 actuando como el dueño real de la cuenta (no una
//              cuenta de servicio): las cuentas de servicio no tienen cuota
//              de almacenamiento propia y no pueden crear archivos en una
//              carpeta de Drive personal ("Service Accounts do not have
//              storage quota"), solo funcionan con Shared Drives de Google
//              Workspace de paga. Con OAuth + refresh token, el espacio se
//              descuenta de la cuenta de Gmail normal del usuario.
// ENV:
//   GOOGLE_DRIVE_CLIENT_ID       — OAuth Client ID (tipo "Web application")
//   GOOGLE_DRIVE_CLIENT_SECRET   — OAuth Client Secret
//   GOOGLE_DRIVE_REFRESH_TOKEN   — obtenido una vez vía OAuth Playground
//   GOOGLE_DRIVE_ROOT_FOLDER_ID  — carpeta raíz dentro del Drive del usuario
// =============================================================

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import type { CloudFile, CloudStorageProvider } from './types';

// Cache en memoria de rutas ya resueltas (padre + nombre → id) — evita
// repetir búsquedas en cada subida/listado dentro del mismo proceso.
const folderIdCache = new Map<string, string>();

function getDrive(): drive_v3.Drive {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

// Busca una subcarpeta por nombre dentro de `parentId`. No crea nada.
async function findFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string | undefined> {
  const cacheKey = `${parentId}/${name}`;
  if (folderIdCache.has(cacheKey)) return folderIdCache.get(cacheKey);

  const nameEscaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${nameEscaped}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const id = res.data.files?.[0]?.id;
  if (id) folderIdCache.set(cacheKey, id);
  return id ?? undefined;
}

// Busca un archivo (no carpeta) por nombre dentro de `parentId` — usado para
// sobrescribir en vez de duplicar cuando ya existe un archivo con ese nombre
// (Drive, a diferencia de OneDrive, permite nombres repetidos en la misma
// carpeta, así que sin esto cada re-subida del mismo nombre iba acumulando
// copias, ej. al regenerar el expediente completo varias veces el mismo día).
async function findFile(drive: drive_v3.Drive, name: string, parentId: string): Promise<string | undefined> {
  const nameEscaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${nameEscaped}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files?.[0]?.id ?? undefined;
}

// Busca una subcarpeta, y la crea si no existe (usado al subir un archivo).
async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  const id = created.data.id!;
  folderIdCache.set(`${parentId}/${name}`, id);
  return id;
}

// Recorre la ruta creando las carpetas que falten — usado antes de subir.
async function resolveFolderIdForWrite(drive: drive_v3.Drive, folderPath: string[]): Promise<string> {
  const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  let currentId = root;
  for (const segment of folderPath) {
    currentId = await findOrCreateFolder(drive, segment, currentId);
  }
  return currentId;
}

// Recorre la ruta solo buscando — usado al listar, para no crear carpetas
// vacías nada más por consultar si un paciente tiene archivos.
async function resolveFolderIdReadonly(drive: drive_v3.Drive, folderPath: string[]): Promise<string | undefined> {
  let currentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  for (const segment of folderPath) {
    const found = await findFolder(drive, segment, currentId);
    if (!found) return undefined;
    currentId = found;
  }
  return currentId;
}

function toCloudFile(f: drive_v3.Schema$File): CloudFile {
  return {
    id: f.id!,
    name: f.name || 'archivo',
    webUrl: f.webViewLink || undefined,
    size: f.size ? Number(f.size) : undefined,
    modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
  };
}

export const googleDriveProvider: CloudStorageProvider = {
  async uploadFile(folderPath, filename, buffer, mimeType) {
    const drive = getDrive();
    const folderId = await resolveFolderIdForWrite(drive, folderPath);
    const existingId = await findFile(drive, filename, folderId);
    if (existingId) {
      const res = await drive.files.update({
        fileId: existingId,
        media: { mimeType, body: Readable.from(buffer) },
        fields: 'id, name, webViewLink, size, modifiedTime',
      });
      return toCloudFile(res.data);
    }
    const res = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: 'id, name, webViewLink, size, modifiedTime',
    });
    return toCloudFile(res.data);
  },

  async listFiles(folderPath) {
    const drive = getDrive();
    const folderId = await resolveFolderIdReadonly(drive, folderPath);
    if (!folderId) return [];
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, webViewLink, size, modifiedTime)',
      orderBy: 'name',
    });
    return (res.data.files || []).map(toCloudFile);
  },

  async downloadFile(fileId) {
    const drive = getDrive();
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  },

  async deleteFile(fileId) {
    const drive = getDrive();
    await drive.files.delete({ fileId });
  },
};
