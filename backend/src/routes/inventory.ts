import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired);

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.string(),
  brand: z.string().optional().nullable(),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  stock: z.number().int().default(0),
  minStock: z.number().int().default(0),
  attributes: z.any().optional(),
  imageUrl: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
});

router.get('/categories', async (_req, res) => {
  const c = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(c);
});

router.post('/categories', requireRole('ADMIN'), async (req, res) => {
  const c = await prisma.category.create({ data: { name: req.body.name, parentId: req.body.parentId || null } });
  res.status(201).json(c);
});

router.delete('/categories/:id', requireRole('ADMIN'), async (req, res) => {
  const hasProducts = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (hasProducts) return res.status(409).json({ error: 'Tiene productos asignados' });
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/products', async (req: AuthRequest, res) => {
  const { q, categoryId, lowStock } = req.query as any;
  const where: any = { active: true };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }];
  if (categoryId) where.categoryId = categoryId;
  let list = await prisma.product.findMany({ where, include: { category: true }, orderBy: { name: 'asc' } });
  if (lowStock === 'true') list = list.filter((p) => p.stock <= p.minStock);
  res.json(list);
});

router.get('/products/:id', async (req: AuthRequest, res) => {
  const p = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true, movements: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 } },
  });
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

router.post('/products', requireRole('ADMIN'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = await prisma.product.create({ data: parsed.data });
  emit('product:created', p);
  res.status(201).json(p);
});

router.put('/products/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
  emit('product:updated', p);
  res.json(p);
});

router.delete('/products/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  emit('product:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// Foto de producto — se guarda en disco (mismo patron que auth.ts /me/photo)
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const PRODUCTS_DIR = path.join(UPLOAD_DIR, 'products');
if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/products/:id/photo', requireRole('ADMIN'), upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'El archivo debe ser una imagen' });

  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `${product.id}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(PRODUCTS_DIR, filename), req.file.buffer);

  if (product.imageUrl) {
    const prevPath = path.join(UPLOAD_DIR, product.imageUrl.replace(/^\/uploads\//, ''));
    if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
  }

  const imageUrl = `/uploads/products/${filename}`;
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { imageUrl },
  });
  emit('product:updated', updated);
  res.json(updated);
});

export default router;
