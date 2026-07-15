// =============================================================
// ARCHIVO: src/routes/documents.ts
// DESCRIPCION: Expediente documental del paciente (cuestionario,
//              resultados del examen, hoja de consentimiento, etc.)
//              Hoy los archivos se guardan en disco local
//              (UPLOAD_DIR/documents); a futuro se conectará a
//              OneDrive sin cambiar esta API.
// =============================================================
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { getCloudStorageProvider, buildPatientFolderPath } from '../services/storage';
import { logAudit } from '../services/audit';

const router = Router();
router.use(authRequired, requireRole('ADMIN', 'DOCTOR'));

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const DOCS_DIR = path.join(UPLOAD_DIR, 'documents');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// GET /api/documents — listar, filtrable por patientId / companyId / type
router.get('/', async (req: AuthRequest, res) => {
  const { patientId, companyId, type } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (patientId) where.patientId = patientId;
  if (type) where.type = type;
  if (companyId) where.patient = { companyId };

  // Consulta del expediente documental de un paciente = acceso a datos sensibles.
  if (patientId) logAudit(req, 'EXPEDIENTE_VIEW', { targetType: 'Patient', targetId: patientId, patientId });

  const docs = await prisma.document.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, companyId: true, companyRel: { select: { name: true } } } },
      uploadedBy: { select: { fullName: true } },
    },
    orderBy: { visitDate: 'desc' },
  });
  res.json(docs);
});

// GET /api/documents/company-review — bandeja central para que DOCTOR/ADMIN
// revisen archivos de pacientes vinculados a empresas y decidan su visibilidad.
router.get('/company-review', requireRole('DOCTOR', 'ADMIN', 'MASTER'), async (_req, res) => {
  const patients = await prisma.patient.findMany({
    where: {
      AND: [
        { OR: [{ companyId: { not: null } }, { company: { not: null } }] },
        { documents: { some: {} } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      nss: true,
      company: true,
      companyRel: { select: { id: true, name: true } },
      documents: {
        select: {
          id: true,
          type: true,
          fileName: true,
          visitDate: true,
          companyVisible: true,
          companyApprovedAt: true,
        },
        orderBy: { visitDate: 'desc' },
      },
    },
    orderBy: { fullName: 'asc' },
  });
  res.json(patients);
});

// POST /api/documents/upload — sube un archivo directo a la nube (OneDrive/
// Drive), sin guardar copia en disco local. Solo si no hay proveedor
// configurado, o la subida a la nube falla, se guarda en disco como
// respaldo — nunca se pierde un archivo, pero el disco local deja de ser
// donde vive el expediente cuando la nube está disponible.
router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const { patientId, type, visitDate } = req.body;
  if (!patientId || !type) return res.status(400).json({ error: 'patientId y type son requeridos' });

  const visitDateParsed = visitDate ? new Date(visitDate) : new Date();
  const provider = getCloudStorageProvider();

  let fileUrl: string | undefined;
  let cloudProvider: string | null = null;
  let cloudFileId: string | null = null;
  let cloudWebUrl: string | null = null;

  if (provider) {
    try {
      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } });
      const folderPath = buildPatientFolderPath(visitDateParsed, patient?.fullName || 'Sin nombre');
      const cloudFile = await provider.uploadFile(folderPath, req.file.originalname, req.file.buffer, req.file.mimetype);
      cloudProvider = (process.env.CLOUD_STORAGE_PROVIDER || '').toLowerCase();
      cloudFileId = cloudFile.id;
      cloudWebUrl = cloudFile.webUrl || null;
      fileUrl = cloudWebUrl || undefined;
    } catch (err: any) {
      console.error('[documents/upload] fallo al subir a la nube, se guarda en disco como respaldo', err.message);
    }
  }

  // Respaldo local: solo cuando no hay nube configurada o la subida falló
  if (!cloudFileId) {
    const ext = path.extname(req.file.originalname) || '.pdf';
    const filename = `${patientId}_${type}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(DOCS_DIR, filename), req.file.buffer);
    fileUrl = `/uploads/documents/${filename}`;
  }

  const doc = await prisma.document.create({
    data: {
      patientId,
      type,
      visitDate: visitDateParsed,
      fileName: req.file.originalname,
      fileUrl: fileUrl!,
      uploadedById: req.user!.id,
      cloudProvider,
      cloudFileId,
      cloudWebUrl,
    },
  });
  logAudit(req, 'DOCUMENT_UPLOAD', { targetType: 'Document', targetId: doc.id, patientId, detail: `${type}: ${req.file.originalname}` });
  res.status(201).json(doc);
});

// GET /api/documents/:id/preview — vista previa autenticada para DOCTOR/ADMIN.
// Permite revisar el archivo antes de decidir si se autoriza para la empresa.
router.get('/:id/preview', requireRole('DOCTOR', 'ADMIN', 'MASTER'), async (req: AuthRequest, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Documento no encontrado' });
  logAudit(req, 'DOCUMENT_DOWNLOAD', { targetType: 'Document', targetId: document.id, patientId: document.patientId, detail: `preview: ${document.fileName}` });

  const extension = path.extname(document.fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif',
    '.txt': 'text/plain; charset=utf-8',
  };
  const setPreviewHeaders = () => {
    res.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
  };

  if (document.cloudFileId) {
    const provider = getCloudStorageProvider();
    if (!provider) return res.status(503).json({ error: 'Proveedor de nube no disponible' });
    const bytes = await provider.downloadFile(document.cloudFileId);
    setPreviewHeaders();
    return res.send(Buffer.from(bytes));
  }

  const relativePath = document.fileUrl.replace(/^\/uploads\//, '');
  const localPath = path.resolve(UPLOAD_DIR, relativePath);
  const uploadsRoot = `${path.resolve(UPLOAD_DIR)}${path.sep}`;
  if (!localPath.startsWith(uploadsRoot) || !fs.existsSync(localPath)) {
    return res.status(404).json({ error: 'Archivo no disponible' });
  }
  setPreviewHeaders();
  return res.sendFile(localPath);
});

// PATCH /api/documents/:id/company-visibility — un DOCTOR o ADMIN decide qué
// archivo específico puede consultar la empresa del paciente.
router.patch('/:id/company-visibility', requireRole('DOCTOR', 'ADMIN', 'MASTER'), async (req: AuthRequest, res) => {
  if (typeof req.body?.visible !== 'boolean') return res.status(400).json({ error: 'visible debe ser booleano' });
  const existing = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { patient: { select: { companyId: true, company: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Documento no encontrado' });
  if (!existing.patient.companyId && !existing.patient.company) {
    return res.status(400).json({ error: 'El paciente no tiene una empresa vinculada' });
  }

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: {
      companyVisible: req.body.visible,
      companyApprovedById: req.body.visible ? req.user!.id : null,
      companyApprovedAt: req.body.visible ? new Date() : null,
    },
  });
  res.json(document);
});

// PATCH /api/documents/:id/patient-visibility — un DOCTOR o ADMIN decide qué
// documento puede ver el paciente en su portal. En salud ocupacional los
// resultados se liberan tras validación médica (NOM-004): privado por defecto.
router.patch('/:id/patient-visibility', requireRole('DOCTOR', 'ADMIN', 'MASTER'), async (req: AuthRequest, res) => {
  if (typeof req.body?.visible !== 'boolean') return res.status(400).json({ error: 'visible debe ser booleano' });
  const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Documento no encontrado' });

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: {
      patientVisible: req.body.visible,
      patientApprovedById: req.body.visible ? req.user!.id : null,
      patientApprovedAt: req.body.visible ? new Date() : null,
    },
  });
  // Liberar/revocar resultados al paciente es un evento de acceso a datos
  // sensibles → queda en la bitácora.
  logAudit(req, 'EXPEDIENTE_VIEW', {
    targetType: 'Document', targetId: existing.id, patientId: existing.patientId,
    detail: req.body.visible ? `liberar al paciente: ${existing.fileName}` : `revocar al paciente: ${existing.fileName}`,
  });
  res.json(document);
});

// DELETE /api/documents/:id — borra un documento duplicado/obsoleto (registro
// + archivo, en disco local o en la nube según donde viva)
router.delete('/:id', async (req: AuthRequest, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

  if (doc.cloudFileId) {
    const provider = getCloudStorageProvider();
    const activeCloudProvider = (process.env.CLOUD_STORAGE_PROVIDER || '').toLowerCase();
    if (provider && doc.cloudProvider === activeCloudProvider) {
      try {
        await provider.deleteFile(doc.cloudFileId);
      } catch (err: any) {
        console.error('[documents/delete] no se pudo borrar de la nube', doc.fileName, err.message);
      }
    }
  } else {
    const filePath = path.join(UPLOAD_DIR, doc.fileUrl.replace(/^\/uploads\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await prisma.document.delete({ where: { id: doc.id } });
  logAudit(req, 'DOCUMENT_DELETE', { targetType: 'Document', targetId: doc.id, patientId: doc.patientId, detail: doc.fileName });
  res.json({ ok: true });
});

// GET /api/documents/:patientId/cloud-files?date=YYYY-MM-DD — lista en vivo los
// archivos de la carpeta de ese paciente en la nube (Google Drive/OneDrive,
// según CLOUD_STORAGE_PROVIDER), incluyendo los que alguien haya subido ahí
// directo, por fuera de esta app. Sin fecha, usa la visita más reciente.
router.get('/:patientId/cloud-files', async (req: AuthRequest, res) => {
  const provider = getCloudStorageProvider();
  if (!provider) return res.json({ configured: false, files: [] });

  const { patientId } = req.params;
  const { date } = req.query as { date?: string };
  logAudit(req, 'EXPEDIENTE_VIEW', { targetType: 'Patient', targetId: patientId, patientId, detail: 'listado carpeta nube' });

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } });
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  let fecha: Date;
  if (date) {
    fecha = new Date(`${date}T12:00:00`);
  } else {
    const ultimo = await prisma.document.findFirst({ where: { patientId }, orderBy: { visitDate: 'desc' } });
    if (!ultimo) return res.json({ configured: true, files: [] });
    fecha = ultimo.visitDate;
  }

  try {
    const folderPath = buildPatientFolderPath(fecha, patient.fullName);
    const files = await provider.listFiles(folderPath);
    res.json({ configured: true, files });
  } catch (err: any) {
    console.error('[documents/cloud-files]', err.message);
    res.status(502).json({ error: 'No se pudo consultar la carpeta en la nube' });
  }
});

// DELETE /api/documents/cloud-file/:fileId — borra un archivo directo de la
// carpeta en la nube por su id, sin necesitar que exista un registro
// `Document` (cubre archivos que alguien subió directo a Drive/OneDrive, por
// fuera de esta app, que es justo lo que lista GET /cloud-files). Si además
// hay un `Document` apuntando a ese mismo archivo, se borra también para no
// dejar un registro huérfano.
router.delete('/cloud-file/:fileId', async (req: AuthRequest, res) => {
  const provider = getCloudStorageProvider();
  if (!provider) return res.status(400).json({ error: 'La nube no está configurada' });

  const { fileId } = req.params;
  const linked = await prisma.document.findFirst({ where: { cloudFileId: fileId }, select: { patientId: true, fileName: true } });
  try {
    await provider.deleteFile(fileId);
  } catch (err: any) {
    console.error('[documents/cloud-file delete]', fileId, err.message);
    return res.status(502).json({ error: 'No se pudo borrar el archivo de la nube' });
  }
  await prisma.document.deleteMany({ where: { cloudFileId: fileId } });
  logAudit(req, 'DOCUMENT_DELETE', { targetType: 'Document', targetId: fileId, patientId: linked?.patientId ?? null, detail: linked?.fileName ?? 'archivo en nube' });
  res.json({ ok: true });
});

// Heurística de orden para el merge cuando la fuente son los nombres de
// archivo en la nube (sin el campo "type" de la BD): Encuesta primero,
// Resultados después, Consentimiento, y el resto (laboratorios, rayos X,
// optometría, etc.) al final, en el orden en que aparecen en la carpeta.
const ORDEN_PREFIJOS: [string, number][] = [
  ['encuesta', 0],
  ['resultados', 1],
  ['consentimiento', 2],
];
const ordenPorNombre = (name: string) => {
  const n = name.toLowerCase();
  const match = ORDEN_PREFIJOS.find(([prefijo]) => n.startsWith(prefijo));
  return match ? match[1] : 3;
};

// GET /api/documents/:patientId/completo — arma un solo PDF descargable
// juntando lo que de verdad está en la carpeta del paciente en la nube
// (Drive/OneDrive) para esa fecha — no lo que la BD local cree que subió.
// Así también incluye archivos que alguien haya puesto ahí directo, por
// fuera de la app. El PDF combinado nunca toca disco: se arma en memoria y
// se manda tanto a la respuesta como de vuelta a la misma carpeta en la nube.
router.get('/:patientId/completo', async (req: AuthRequest, res) => {
  const { patientId } = req.params;
  const { date, force } = req.query as { date?: string; force?: string };
  const forzarReconstruccion = force === '1' || force === 'true';

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } });
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
  logAudit(req, 'DOCUMENT_DOWNLOAD', { targetType: 'Patient', targetId: patientId, patientId, detail: `expediente completo${date ? ` ${date}` : ''}` });

  const provider = getCloudStorageProvider();

  let fuentes: { name: string; bytes: Buffer }[] = [];
  let fechaObjetivo = date;

  if (provider) {
    // Sin "date" se usa la fecha de la visita más reciente registrada, solo
    // como referencia para saber qué carpeta abrir en la nube.
    if (!fechaObjetivo) {
      const ultimo = await prisma.document.findFirst({ where: { patientId }, orderBy: { visitDate: 'desc' } });
      if (!ultimo) return res.status(404).json({ error: 'Este paciente no tiene documentos' });
      fechaObjetivo = ultimo.visitDate.toISOString().slice(0, 10);
    }
    const folderPath = buildPatientFolderPath(new Date(`${fechaObjetivo}T12:00:00`), patient.fullName);
    let listado: { id: string; name: string }[] = [];
    try {
      listado = await provider.listFiles(folderPath);
    } catch (err: any) {
      console.error('[documents/completo] no se pudo listar la carpeta en la nube', err.message);
      return res.status(502).json({ error: 'No se pudo consultar la carpeta en la nube' });
    }

    // Si ya se generó y guardó un expediente para esta fecha, se consulta esa
    // copia directo en vez de reconstruirla — más rápido, y es justo lo que
    // "Ver expediente completo" (Resultados/Historial) espera encontrar. El
    // botón "Generar expediente del día" manda force=1 para siempre rearmarlo
    // con lo que haya en la carpeta en ese momento y guardar la copia nueva.
    const nombreGuardado = `expediente_completo_${fechaObjetivo}.pdf`;
    const yaGuardado = listado.find((f) => f.name.toLowerCase() === nombreGuardado);
    if (!forzarReconstruccion && yaGuardado) {
      try {
        const bytes = await provider.downloadFile(yaGuardado.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Expediente_${fechaObjetivo}.pdf"`);
        return res.send(bytes);
      } catch (err: any) {
        console.error('[documents/completo] no se pudo descargar la copia guardada, se reconstruye', err.message);
      }
    }

    // No reincluir un expediente combinado generado antes — si no, cada
    // reconstrucción mergea el merge anterior dentro de sí mismo.
    const archivos = listado.filter((f) => !f.name.toLowerCase().startsWith('expediente_completo'));
    if (!archivos.length) return res.status(404).json({ error: 'No hay documentos para esa fecha' });

    for (const archivo of archivos) {
      try {
        const bytes = await provider.downloadFile(archivo.id);
        fuentes.push({ name: archivo.name, bytes });
      } catch (err: any) {
        console.error('[documents/completo] no se pudo descargar de la nube', archivo.name, err.message);
      }
    }
  } else {
    // Sin nube configurada: modo local de siempre, leyendo del disco.
    const docs = await prisma.document.findMany({ where: { patientId }, orderBy: { visitDate: 'desc' } });
    if (!docs.length) return res.status(404).json({ error: 'Este paciente no tiene documentos' });
    fechaObjetivo = fechaObjetivo || docs[0].visitDate.toISOString().slice(0, 10);
    const deLaVisita = docs.filter((d) => d.visitDate.toISOString().slice(0, 10) === fechaObjetivo);
    if (!deLaVisita.length) return res.status(404).json({ error: 'No hay documentos para esa fecha' });

    for (const doc of deLaVisita) {
      const filePath = path.join(UPLOAD_DIR, doc.fileUrl.replace(/^\/uploads\//, ''));
      if (fs.existsSync(filePath)) fuentes.push({ name: doc.fileName, bytes: fs.readFileSync(filePath) });
    }
  }

  fuentes.sort((a, b) => ordenPorNombre(a.name) - ordenPorNombre(b.name));

  const merged = await PDFDocument.create();
  for (const { name, bytes } of fuentes) {
    const ext = path.extname(name).toLowerCase();
    try {
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        const img = ext === '.png' ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else if (ext === '.pdf') {
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
    } catch (err) {
      console.error('[documents/completo] no se pudo combinar', name, err);
    }
  }

  const pdfBytes = await merged.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Expediente_${fechaObjetivo}.pdf"`);
  res.send(Buffer.from(pdfBytes));

  // Guarda también una copia del expediente combinado en la carpeta de esa
  // fecha en la nube — best-effort, no afecta la descarga ya enviada. El
  // proveedor de Drive sobrescribe si ya existe un archivo con ese nombre en
  // vez de duplicarlo.
  if (provider) {
    try {
      const folderPath = buildPatientFolderPath(new Date(`${fechaObjetivo}T12:00:00`), patient.fullName);
      await provider.uploadFile(folderPath, `Expediente_completo_${fechaObjetivo}.pdf`, Buffer.from(pdfBytes), 'application/pdf');
    } catch (err: any) {
      console.error('[documents/completo] fallo al sincronizar con la nube', err.message);
    }
  }
});

export default router;
