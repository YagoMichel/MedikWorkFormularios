// =============================================================
// ARCHIVO: src/services/storage/folderPath.ts
// DESCRIPCION: Arma la ruta de carpeta que se usa tanto en Google Drive como
//              en OneDrive, replicando EXACTAMENTE la estructura real que ya
//              usan a mano en OneDrive (confirmado con un ejemplo real):
//
//              Attachments / EXPEDIENTES 2026 / ENERO 2026 / 15 ENERO 2026 / Juan Hernández
//
//              Mes en mayúsculas, día con cero a la izquierda, nombre del
//              paciente tal cual (con acentos, sin tocar mayúsculas/minúsculas).
// =============================================================

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// Quita caracteres que no son válidos como nombre de carpeta en OneDrive/Drive
function sanitizeFolderName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim() || 'Sin nombre';
}

export function buildPatientFolderPath(visitDate: Date, patientFullName: string): string[] {
  const mes = MESES[visitDate.getMonth()];
  const anio = visitDate.getFullYear();
  const dia = String(visitDate.getDate()).padStart(2, '0');

  return [
    'Attachments',
    `EXPEDIENTES ${anio}`,
    `${mes} ${anio}`,
    `${dia} ${mes} ${anio}`,
    sanitizeFolderName(patientFullName || 'Sin nombre'),
  ];
}
