// =============================================================
// ARCHIVO: src/services/storage/oneDriveProvider.ts
// DESCRIPCION: Implementación de CloudStorageProvider contra OneDrive
//              (Microsoft Graph), usando client-credentials (app-only, sin
//              usuario interactivo) contra el OneDrive de ONEDRIVE_DRIVE_USER.
//              Usa fetch nativo en vez de un SDK de Microsoft — mismo patrón
//              que ya usa el proyecto para las APIs de código postal
//              (backend/src/index.ts).
// ENV:
//   ONEDRIVE_TENANT_ID     — Directory (tenant) ID de la app en Entra ID
//   ONEDRIVE_CLIENT_ID     — Application (client) ID
//   ONEDRIVE_CLIENT_SECRET — Client secret
//   ONEDRIVE_DRIVE_USER    — correo del dueño del OneDrive a usar
//
// NOTA: Graph limita el "simple upload" (PUT .../content) a 4 MB. Los
// archivos más grandes que eso se suben con una upload session (createUploadSession
// + PUT por partes de 10 MB) — ver uploadLarge() abajo.
// =============================================================

import type { CloudFile, CloudStorageProvider } from './types';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const tenant = process.env.ONEDRIVE_TENANT_ID;
  const params = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID || '',
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET || '',
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`No se pudo autenticar con Microsoft Graph (${res.status})`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// Codifica cada segmento de la ruta (pero no las diagonales que los separan)
function encodePath(segments: string[]): string {
  return segments.map((s) => encodeURIComponent(s)).join('/');
}

function driveBaseUrl(): string {
  const user = encodeURIComponent(process.env.ONEDRIVE_DRIVE_USER || '');
  return `https://graph.microsoft.com/v1.0/users/${user}/drive`;
}

function toCloudFile(item: any): CloudFile {
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    size: item.size,
    modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
  };
}

// Límite real de Graph para "simple upload" (PUT .../content). Por encima de
// esto hay que usar una upload session con el archivo partido en pedazos.
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024; // 4 MB
// Graph exige que cada pedazo sea múltiplo de 320 KiB (excepto el último);
// 10 MB = 32 × 320 KiB, cumple exacto.
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

// Sube un archivo grande (> SIMPLE_UPLOAD_MAX) por partes: primero se abre
// una "upload session" (URL temporal, ya autorizada — no lleva el header
// Authorization) y luego se manda el archivo en pedazos de CHUNK_SIZE con el
// header Content-Range. El último pedazo devuelve el archivo ya creado.
async function uploadLarge(fullPath: string, buffer: Buffer): Promise<CloudFile> {
  const token = await getAccessToken();
  const sessionRes = await fetch(`${driveBaseUrl()}/root:/${fullPath}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
  });
  if (!sessionRes.ok) throw new Error(`No se pudo iniciar la subida grande a OneDrive (${sessionRes.status}: ${await sessionRes.text()})`);
  const { uploadUrl } = await sessionRes.json() as { uploadUrl: string };

  const total = buffer.length;
  let start = 0;
  let completed: any = null;
  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = buffer.subarray(start, end);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end - 1}/${total}`,
      },
      body: new Uint8Array(chunk),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`No se pudo subir el archivo grande a OneDrive (${res.status}: ${await res.text()})`);
    }
    if (res.status !== 202) completed = await res.json(); // 200/201 solo en el último pedazo
    start = end;
  }
  return toCloudFile(completed);
}

export const oneDriveProvider: CloudStorageProvider = {
  async uploadFile(folderPath, filename, buffer, mimeType) {
    // Graph crea automáticamente las carpetas intermedias que no existan.
    const fullPath = encodePath([...folderPath, filename]);

    if (buffer.length > SIMPLE_UPLOAD_MAX) {
      return uploadLarge(fullPath, buffer);
    }

    const token = await getAccessToken();
    const res = await fetch(`${driveBaseUrl()}/root:/${fullPath}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`No se pudo subir el archivo a OneDrive (${res.status}: ${await res.text()})`);
    return toCloudFile(await res.json());
  },

  async listFiles(folderPath) {
    const token = await getAccessToken();
    const path = encodePath(folderPath);
    const res = await fetch(`${driveBaseUrl()}/root:/${path}:/children`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return []; // la carpeta todavía no existe (nunca se subió nada)
    if (!res.ok) throw new Error(`No se pudo listar la carpeta en OneDrive (${res.status})`);
    const data = await res.json() as { value: any[] };
    return (data.value || []).filter((i) => !i.folder).map(toCloudFile);
  },

  async downloadFile(fileId) {
    const token = await getAccessToken();
    const res = await fetch(`${driveBaseUrl()}/items/${encodeURIComponent(fileId)}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`No se pudo descargar el archivo de OneDrive (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  },

  async deleteFile(fileId) {
    const token = await getAccessToken();
    const res = await fetch(`${driveBaseUrl()}/items/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`No se pudo borrar el archivo de OneDrive (${res.status})`);
  },
};
