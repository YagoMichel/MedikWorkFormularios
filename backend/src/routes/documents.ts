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

const router = Router();
router.use(authRequired, requireRole('ADMIN', 'DOCTOR'));

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const DOCS_DIR = path.join(UPLOAD_DIR, 'documents');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Orden en el que se acomodan los documentos dentro del "expediente completo"
const ORDEN_TIPOS: Record<string, number> = { CUESTIONARIO: 0, RESULTADOS: 1, CONSENTIMIENTO: 2, OTRO: 3 };

// GET /api/documents — listar, filtrable por patientId / companyId / type
router.get('/', async (req, res) => {
  const { patientId, companyId, type } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (patientId) where.patientId = patientId;
  if (type) where.type = type;
  if (companyId) where.patient = { companyId };

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

// POST /api/documents/upload — subir un archivo (encuesta/resultados generados
// desde el sistema, o la hoja de consentimiento escaneada/foto)
router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const { patientId, type, visitDate } = req.body;
  if (!patientId || !type) return res.status(400).json({ error: 'patientId y type son requeridos' });

  const ext = path.extname(req.file.originalname) || '.pdf';
  const filename = `${patientId}_${type}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(DOCS_DIR, filename), req.file.buffer);

  const doc = await prisma.document.create({
    data: {
      patientId,
      type,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      fileName: req.file.originalname,
      fileUrl: `/uploads/documents/${filename}`,
      uploadedById: req.user!.id,
    },
  });
  res.status(201).json(doc);
});

// DELETE /api/documents/:id — borra un documento duplicado/obsoleto (registro + archivo en disco)
router.delete('/:id', async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

  const filePath = path.join(UPLOAD_DIR, doc.fileUrl.replace(/^\/uploads\//, ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.document.delete({ where: { id: doc.id } });
  res.json({ ok: true });
});

// GET /api/documents/:patientId/completo — junta Cuestionario + Resultados +
// Consentimiento de la visita más reciente en un solo PDF descargable
router.get('/:patientId/completo', async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query as { date?: string };
  const docs = await prisma.document.findMany({ where: { patientId }, orderBy: { visitDate: 'desc' } });
  if (!docs.length) return res.status(404).json({ error: 'Este paciente no tiene documentos' });

  // Sin "date" se usa la visita más reciente = todos los documentos del mismo día que el más nuevo
  const fechaObjetivo = date || docs[0].visitDate.toISOString().slice(0, 10);
  const deLaVisita = docs
    .filter((d) => d.visitDate.toISOString().slice(0, 10) === fechaObjetivo)
    .sort((a, b) => (ORDEN_TIPOS[a.type] ?? 9) - (ORDEN_TIPOS[b.type] ?? 9));
  if (!deLaVisita.length) return res.status(404).json({ error: 'No hay documentos para esa fecha' });

  const merged = await PDFDocument.create();
  for (const doc of deLaVisita) {
    const filePath = path.join(UPLOAD_DIR, doc.fileUrl.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(filePath)) continue;
    const bytes = fs.readFileSync(filePath);
    const ext = path.extname(doc.fileName).toLowerCase();
    try {
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        const img = ext === '.png' ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
        const page = merged.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else {
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
    } catch (err) {
      console.error('[documents/completo] no se pudo combinar', doc.fileName, err);
    }
  }

  const pdfBytes = await merged.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Expediente_${fechaObjetivo}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

export default router;
