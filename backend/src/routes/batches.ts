import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from '../services/whatsappService';

const router = Router();
router.use(authRequired);

// POST /api/batches — create a new company batch (accessible by DOCTOR and ADMIN)
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

// GET /api/batches
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

// POST /api/batches/:id/confirm-admin
router.post('/:id/confirm-admin', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const batch = await prisma.companyBatch.findUnique({
    where: { id },
    include: { company: true, appointments: true },
  });
  if (!batch) return res.status(404).json({ error: 'Batch no encontrado' });
  if (batch.status === 'CONFIRMADO') return res.status(400).json({ error: 'Ya confirmado' });

  // Update batch status
  await prisma.companyBatch.update({ where: { id }, data: { status: 'CONFIRMADO' } });

  // Si ya hay citas, solo actualizar su status a CONFIRMADA
  if (batch.appointments.length > 0) {
    await prisma.appointment.updateMany({ where: { batchId: id }, data: { status: 'CONFIRMADA' } });
    // Notificar por WhatsApp si hay teléfono
    const fechaExist = new Date(batch.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const phoneExist = batch.contactPhone;
    if (phoneExist) {
      const msgExist = `¡Hola! Te confirmamos que la cita de exámenes médicos para ${batch.company.name} quedó agendada para el ${fechaExist} 😊 Recuerda que inicia a las 8:00 AM. ¡Cualquier duda, aquí estamos! 🙌`;
      sendWhatsAppMessage(phoneExist, msgExist).catch((e) => console.warn('[confirm-admin] WhatsApp no enviado:', e.message));
    }
    // Notificar al cliente por web chat si hay sessionId
    const { sessionId: sessionIdExist } = batch as any;
    if (sessionIdExist) {
      const confirmMsgExist = `¡Hola! Te confirmamos que la cita de exámenes médicos para ${batch.company.name} quedó agendada para el ${fechaExist} 😊 Recuerda que inicia a las 8:00 AM. ¡Cualquier duda, aquí estamos! 🙌`;
      try {
        const convo = await prisma.conversation.findUnique({
          where: { channel_externalId: { channel: 'web', externalId: sessionIdExist } },
        });
        if (convo) {
          await prisma.conversationMessage.create({
            data: { conversationId: convo.id, role: 'assistant', content: confirmMsgExist as any },
          });
          const { emit } = await import('../socket');
          emit('agent:message', { sessionId: sessionIdExist, text: confirmMsgExist });
        }
      } catch (e: any) {
        console.warn('[confirm-admin] Web notification failed:', e.message);
      }
    }
    return res.json({ ok: true, created: 0 });
  }

  // Find first active doctor
  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR', active: true } });
  if (!doctor) return res.status(400).json({ error: 'No hay doctor activo disponible' });

  // Crear citas sin paciente (se asignarán después con los datos reales)
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

  // Notificar al cliente por WhatsApp si tiene teléfono
  const phone = batch.contactPhone;
  if (phone) {
    const fecha = new Date(batch.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const msg = `¡Hola! Te confirmamos que la cita de exámenes médicos para ${batch.company.name} quedó agendada para el ${fecha} 😊 Recuerda que inicia a las 8:00 AM. ¡Cualquier duda, aquí estamos! 🙌`;
    sendWhatsAppMessage(phone, msg).catch((e) => console.warn('[confirm-admin] WhatsApp no enviado:', e.message));
  }

  // Notificar al cliente por web chat si hay sessionId
  const { sessionId } = batch as any;
  if (sessionId) {
    const confirmMsg = `¡Hola! Te confirmamos que la cita de exámenes médicos para ${batch.company.name} quedó agendada para el ${fecha} 😊 Recuerda que inicia a las 8:00 AM. ¡Cualquier duda, aquí estamos! 🙌`;
    try {
      const convo = await prisma.conversation.findUnique({
        where: { channel_externalId: { channel: 'web', externalId: sessionId } },
      });
      if (convo) {
        await prisma.conversationMessage.create({
          data: { conversationId: convo.id, role: 'assistant', content: confirmMsg as any },
        });
        const { emit } = await import('../socket');
        emit('agent:message', { sessionId, text: confirmMsg });
      }
    } catch (e: any) {
      console.warn('[confirm-admin] Web notification failed:', e.message);
    }
  }

  res.json({ ok: true, created: created.length });
});

// POST /api/batches/:id/cancel-admin
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
