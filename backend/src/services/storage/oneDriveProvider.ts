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
// NOTA: la subida usa "simple upload" (PUT .../content), que Graph limita a
// 4 MB. Si algún día se necesitan archivos más grandes hay que cambiar a una
// upload session (PUT .../createUploadSession) — no implementado todavía
// porque no hace falta para fotos/PDFs típicos del expediente.
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

export const oneDriveProvider: CloudStorageProvider = {
  async uploadFile(folderPath, filename, buffer, mimeType) {
    const token = await getAccessToken();
    // Graph crea automáticamente las carpetas intermedias que no existan.
    const fullPath = encodePath([...folderPath, filename]);
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
