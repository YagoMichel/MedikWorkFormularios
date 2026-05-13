import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const router = Router();
router.use(authRequired, requireRole('ADMIN'));

const schema = z.object({
  type: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
  productId: z.string(),
  quantity: z.number().int(),
  unitCost: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const { from, to, productId, type } = req.query as any;
  const where: any = {};
  if (productId) where.productId = productId;
  if (type) where.type = type;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);
  const list = await prisma.movement.findMany({
    where,
    include: { product: true, user: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(list);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: d.productId } });
    if (!product) throw new Error('Producto no existe');
    let newStock = product.stock;
    if (d.type === 'ENTRADA') newStock += d.quantity;
    else if (d.type === 'SALIDA') newStock -= d.quantity;
    else if (d.type === 'AJUSTE') newStock = d.quantity;
    if (newStock < 0) throw new Error('Stock insuficiente');
    const m = await tx.movement.create({
      data: { ...d, userId: req.user!.id },
      include: { product: true, user: { select: { fullName: true } } },
    });
    await tx.product.update({ where: { id: d.productId }, data: { stock: newStock, lastMovementAt: new Date() } });
    return m;
  }).catch((e) => ({ error: e.message }));
  if ((result as any).error) return res.status(400).json(result);
  emit('movement:created', result);
  res.status(201).json(result);
});

export default router;
