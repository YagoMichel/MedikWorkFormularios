// =============================================================
// ARCHIVO: src/routes/batches.ts
// SECCION: ADMIN + DOCTOR
// DESCRIPCION: Citas de empresa (batches).
//              El doctor crea batches, el admin los confirma.
//              Las notificaciones al cliente las maneja el bot externo.
// API:
//   POST /api/batches                    — Crear batch (DOCTOR/ADMIN)
//   GET  /api/batches                    — Listar batches (ADMIN)
//   POST /api/batches/:id/confirm-admin  — Confirmar batch (ADMIN)
//   POST /api/batches/:id/cancel-admin   — Cancelar batch (ADMIN)
// =============================================================

import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// POST /api/batches — crear batch (accesible por DOCTOR y ADMIN)
router.post('/', async (req: AuthRequest, res) => {
  const { companyId, date, expectedCount, notes } = req.body;
  if (!companyId || !date || !expectedCount) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  const batch = await prisma.companyBatch.create({
    data: {
      companyId,
      date: new Date(date + 'T08:00:00'),
      expectedCount: Number(expectedCount),
      notes: notes || null,
      status: 'BORRADOR',
    },
    include: { company: true },
  });
  const { emit } = await import('../socket');
  emit('batch:created', batch);
  res.status(201).json(batch);
});

router.use(requireRole('ADMIN'));

// GET /api/batches — listar batches
router.get('/', async (req: AuthRequest, res) => {
  const { status } = req.query as any;
  const where: any = {};
  if (status) where.status = status;
  const batches = await prisma.companyBatch.findMany({
    where,
    include: { company: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(batches);
});

// POST /api/batches/:id/confirm-admin — confirmar batch y crear citas
router.post('/:id/confirm-admin', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const batch = await prisma.companyBatch.findUnique({
    where: { id },
    include: { company: true, appointments: true },
  });
  if (!batch) return res.status(404).json({ error: 'Batch no encontrado' });
  if (batch.status === 'CONFIRMADO') return res.status(400).json({ error: 'Ya confirmado' });

  await prisma.companyBatch.update({ where: { id }, data: { status: 'CONFIRMADO' } });

  // Si ya hay citas, solo actualizar su status
  if (batch.appointments.length > 0) {
    await prisma.appointment.updateMany({ where: { batchId: id }, data: { status: 'CONFIRMADA' } });
    return res.json({ ok: true, created: 0 });
  }

  // Crear citas sin paciente (se asignarán al llegar los trabajadores)
  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR', active: true } });
  if (!doctor) return res.status(400).json({ error: 'No hay doctor activo disponible' });

  const baseDate = new Date(batch.date);
  baseDate.setHours(8, 0, 0, 0);

  const created: any[] = [];
  for (let n = 1; n <= batch.expectedCount; n++) {
    const apptDate = new Date(baseDate.getTime() + (n - 1) * 20 * 60 * 1000);
    const appt = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        date: apptDate,
        durationMin: 20,
        type: 'EMPRESARIAL',
        status: 'CONFIRMADA',
        source: 'AGENT',
        batchId: batch.id,
      },
    });
    created.push(appt);
  }

  const { emit } = await import('../socket');
  emit('batch:confirmed', { id: batch.id, company: batch.company.name, created: created.length });

  res.json({ ok: true, created: created.length });
});

// POST /api/batches/:id/cancel-admin — cancelar batch
router.post('/:id/cancel-admin', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const batch = await prisma.companyBatch.findUnique({ where: { id } });
  if (!batch) return res.status(404).json({ error: 'Batch no encontrado' });

  await prisma.appointment.updateMany({
    where: { batchId: id },
    data: { status: 'CANCELADA' },
  });

  await prisma.companyBatch.update({ where: { id }, data: { status: 'CANCELADO' } });

  res.json({ ok: true });
});

export default router;
