// =============================================================
// ARCHIVO: src/routes/batches.ts
// SECCION: ADMIN + DOCTOR
// DESCRIPCION: Citas de empresa (batches).
//              El doctor crea batches, el admin los confirma.
//              Las notificaciones al cliente las maneja el bot externo.
// API:
//   POST   /api/batches                    — Crear batch (DOCTOR/ADMIN)
//   GET    /api/batches                    — Listar batches (ADMIN)
//   PUT    /api/batches/:id                — DOCTOR solo puede cerrar (CERRADO);
//                                             ADMIN puede editar cualquier campo
//   DELETE /api/batches/:id                — Borrar batch y sus citas (ADMIN)
//   POST   /api/batches/:id/confirm-admin  — Confirmar batch (ADMIN)
//   POST   /api/batches/:id/cancel-admin   — Cancelar batch (ADMIN)
// =============================================================

import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// Valida que el día tenga cupo disponible (o no esté bloqueado) para `cantidad`
// pacientes más. Devuelve un mensaje de error si no hay cupo, o null si está OK.
async function checkCupoDia(fecha: Date, cantidad: number): Promise<string | null> {
  const dayStart = new Date(fecha); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(fecha); dayEnd.setHours(23, 59, 59, 999);

  const cap = await prisma.dayCapacity.findUnique({ where: { date: dayStart } });
  if (cap?.blocked) return 'Esa fecha está bloqueada.';
  const max = cap?.maxPatients ?? 20;

  const ocupado = await prisma.appointment.count({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELADA', 'NO_ASISTIO'] },
    },
  });

  if (ocupado + cantidad > max) {
    return `Cupo lleno para ese día (${max} pacientes máximo). Ya hay ${ocupado} citas.`;
  }
  return null;
}

// POST /api/batches — crear batch (accesible por DOCTOR y ADMIN)
router.post('/', async (req: AuthRequest, res) => {
  let { companyId, date, expectedCount, notes } = req.body;
  if (!companyId || !date || !expectedCount) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const cupoError = await checkCupoDia(new Date(date + 'T08:00:00'), Number(expectedCount));
  if (cupoError) return res.status(409).json({ error: cupoError });

  if (companyId === 'SIN_EMPRESA') {
    let dummy = await prisma.company.findFirst({ where: { name: 'Sin Empresa' } });
    if (!dummy) {
      dummy = await prisma.company.create({ data: { name: 'Sin Empresa', notes: 'Para citas individuales.' } });
    }
    companyId = dummy.id;
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

// GET /api/batches — listar batches (ADMIN)
router.get('/', requireRole('ADMIN'), async (req: AuthRequest, res) => {
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

// PUT /api/batches/:id — DOCTOR solo puede cerrar (status: 'CERRADO', sin nada más
// en el body); ADMIN puede editar fecha/empresa/cupo esperado/notas/status libremente.
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, date, expectedCount, notes, companyId } = req.body;

  if (req.user!.role !== 'ADMIN') {
    const soloCierre = status === 'CERRADO' && date === undefined && expectedCount === undefined
      && notes === undefined && companyId === undefined;
    if (!soloCierre) {
      return res.status(403).json({ error: 'Solo se puede actualizar a CERRADO desde este endpoint' });
    }
    const updated = await prisma.companyBatch.update({ where: { id }, data: { status: 'CERRADO' } });
    return res.json(updated);
  }

  const data: any = {};
  if (status) data.status = status;
  if (date) data.date = new Date(date);
  if (expectedCount) data.expectedCount = Number(expectedCount);
  if (notes !== undefined) data.notes = notes;
  if (companyId) data.companyId = companyId;
  const updated = await prisma.companyBatch.update({ where: { id }, data });
  res.json(updated);
});

router.use(requireRole('ADMIN'));

// DELETE /api/batches/:id — borra el batch y sus citas asociadas (ADMIN)
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const batch = await prisma.companyBatch.findUnique({ where: { id } });
  if (!batch) return res.status(404).json({ error: 'Batch no encontrado' });

  await prisma.appointment.deleteMany({ where: { batchId: id } });
  await prisma.companyBatch.delete({ where: { id } });
  res.json({ ok: true });
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

  // El cupo pudo llenarse entre que se creó el batch en borrador y esta confirmación
  if (batch.appointments.length === 0) {
    const cupoError = await checkCupoDia(batch.date, batch.expectedCount);
    if (cupoError) return res.status(409).json({ error: cupoError });
  }

  await prisma.companyBatch.update({ where: { id }, data: { status: 'CONFIRMADO' } });

  // Si ya hay citas, solo actualizar su status
  if (batch.appointments.length > 0) {
    await prisma.appointment.updateMany({ where: { batchId: id }, data: { status: 'CONFIRMADA' } });
    const { emit } = await import('../socket');
    emit('batch:confirmed', { id: batch.id, company: batch.company.name, created: 0 });
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
