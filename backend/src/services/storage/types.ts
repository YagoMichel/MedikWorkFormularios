// =============================================================
// ARCHIVO: src/services/storage/types.ts
// DESCRIPCION: Contrato común para proveedores de almacenamiento en la nube
//              (Google Drive, OneDrive). Todo se expresa en términos de rutas
//              de carpeta (segmentos) para que quien use esto (documents.ts)
//              no necesite saber nada específico de cada proveedor.
// =============================================================

export interface CloudFile {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  modifiedAt?: Date;
}

export interface CloudStorageProvider {
  // Sube un archivo a la carpeta indicada por `folderPath` (creándola si no
  // existe) y regresa la referencia del archivo ya subido.
  uploadFile(folderPath: string[], filename: string, buffer: Buffer, mimeType: string): Promise<CloudFile>;

  // Lista los archivos de la carpeta indicada por `folderPath` — en vivo
  // contra el proveedor, para reflejar también archivos agregados por fuera
  // de la app (directo en OneDrive/Drive).
  listFiles(folderPath: string[]): Promise<CloudFile[]>;

  // Descarga el contenido de un archivo ya subido — se usa cuando la copia
  // local se borró tras sincronizar y hace falta de vuelta (ej. para armar
  // el expediente completo).
  downloadFile(fileId: string): Promise<Buffer>;

  // Borra un archivo ya subido — se usa cuando se borra un Document desde el
  // expediente, para no dejar huérfanos en la carpeta del paciente en la nube.
  deleteFile(fileId: string): Promise<void>;
}
