import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();

// =========================================================
// RUTAS PÚBLICAS
// =========================================================

// POST /api/feedback - Enviar nueva sugerencia/crítica desde la web
router.post('/', async (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  
  try {
    const feedback = await prisma.feedback.create({
      data: {
        name,
        rating: rating ? parseInt(rating) : 5,
        comment,
        approved: false, // Por defecto no están aprobadas
      },
    });
    res.status(201).json({ ok: true, feedbackId: feedback.id });
  } catch (err: any) {
    console.error('[feedback.post]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/feedback/public - Obtener testimonios aprobados para la web
router.get('/public', async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { approved: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(feedbacks);
  } catch (err: any) {
    console.error('[feedback.public]', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// RUTAS PROTEGIDAS (Solo ADMIN / DOCTOR)
// =========================================================

// GET /api/feedback - Listar todos los testimonios (para aprobar)
router.get('/', authRequired, requireRole('ADMIN', 'DOCTOR', 'MASTER'), async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // Limita a los 100 más recientes para evitar tiempos de carga largos
    });
    res.json(feedbacks);
  } catch (err: any) {
    console.error('[feedback.get]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/feedback/:id/approve - Aprobar/Desaprobar testimonio
router.patch('/:id/approve', authRequired, requireRole('ADMIN', 'DOCTOR', 'MASTER'), async (req, res) => {
  const { id } = req.params;
  const { approved } = req.body;
  
  try {
    const feedback = await prisma.feedback.update({
      where: { id },
      data: { approved: Boolean(approved) },
    });
    res.json(feedback);
  } catch (err: any) {
    console.error('[feedback.approve]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/feedback/:id - Eliminar testimonio
router.delete('/:id', authRequired, requireRole('ADMIN', 'DOCTOR', 'MASTER'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.feedback.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[feedback.delete]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
