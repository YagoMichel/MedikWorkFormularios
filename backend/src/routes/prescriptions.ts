import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';
import { extractPrescriptionFromImage } from '../services/ocr.service';

const router = Router();
router.use(authRequired);

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const schema = z.object({
  patientId: z.string(),
  doctorId: z.string().optional(),
  expiresAt: z.string().optional(),
  odSph: z.number().optional().nullable(),
  odCyl: z.number().optional().nullable(),
  odAxis: z.number().optional().nullable(),
  odAdd: z.number().optional().nullable(),
  oiSph: z.number().optional().nullable(),
  oiCyl: z.number().optional().nullable(),
  oiAxis: z.number().optional().nullable(),
  oiAdd: z.number().optional().nullable(),
  dpOd: z.number().optional().nullable(),
  dpOi: z.number().optional().nullable(),
  dpBin: z.number().optional().nullable(),
  type: z.enum(['LEJOS', 'CERCA', 'BIFOCAL', 'PROGRESIVO']).default('LEJOS'),
  diagnosis: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res) => {
  const { patientId } = req.query as any;
  const where: any = {};
  if (patientId) where.patientId = patientId;
  if (req.user!.role === 'DOCTOR') where.doctorId = req.user!.id;
  const list = await prisma.prescription.findMany({
    where,
    include: { patient: true, doctor: { select: { fullName: true } } },
    orderBy: { issuedAt: 'desc' },
  });
  res.json(list);
});

router.post('/', requireRole('DOCTOR', 'ADMIN'), async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const expiresAt = d.expiresAt ? new Date(d.expiresAt) : new Date(Date.now() + 365 * 86400 * 1000);
  const rx = await prisma.prescription.create({
    data: { ...d, doctorId: d.doctorId || req.user!.id, expiresAt } as any,
  });
  emit('prescription:created', rx);
  res.status(201).json(rx);
});

router.put('/:id', requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
  const rx = await prisma.prescription.update({ where: { id: req.params.id }, data });
  emit('prescription:updated', rx);
  res.json(rx);
});

router.delete('/:id', requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  await prisma.prescription.delete({ where: { id: req.params.id } });
  emit('prescription:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// OCR endpoint
router.post('/ocr', requireRole('DOCTOR', 'ADMIN'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image' });
  const filename = `rx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${req.file.mimetype.split('/')[1] || 'jpg'}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, req.file.buffer);
  const base64 = req.file.buffer.toString('base64');
  const extracted = await extractPrescriptionFromImage(base64, req.file.mimetype);
  res.json({ extracted, imageUrl: `/uploads/${filename}` });
});

export default router;
