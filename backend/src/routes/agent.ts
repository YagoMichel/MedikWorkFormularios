// backend/src/routes/agent.ts
// Endpoints del agente. Auth: JWT con role AGENT o ADMIN.

import { Router } from 'express';
import { z } from 'zod';
import { processMessage } from '../services/agentService';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { emit } from '../socket';

const DEFAULT_CAP = parseInt(process.env.DEFAULT_DAILY_CAPACITY || '20', 10);

const router = Router();
router.use(authRequired, requireRole('AGENT', 'ADMIN'));

// ============================================================
// GET /api/agent/info?tema=...
// Datos de la clinica que el agente comunica al usuario
// ============================================================
router.get('/info', (_req, res) => {
  const tema = (_req.query.tema as string) || 'general';
  const data = {
    nombre: process.env.CLINIC_NAME || 'Clinica Visual',
    direccion: process.env.CLINIC_ADDRESS || 'Pendiente',
    telefono: process.env.CLINIC_PHONE || 'Pendiente',
    horario_lv: process.env.CLINIC_HOURS_WEEKDAY || '09:00-18:00',
    horario_sab: process.env.CLINIC_HOURS_SATURDAY || '09:00-14:00',
  };
  switch (tema) {
    case 'ubicacion':
      return res.json({ ubicacion: data.direccion, telefono: data.telefono });
    case 'horarios':
      return res.json({ lunes_viernes: data.horario_lv, sabado: data.horario_sab, domingo: 'Cerrado' });
    case 'requisitos':
      return res.json({
        requisitos: [
          'Identificacion oficial vigente',
          'NSS si aplica seguro social',
          'Lentes actuales si los usan',
          'Llegar 10 min antes de su hora',
        ],
      });
    case 'estacionamiento':
      return res.json({ info: 'Consulta a la clinica directamente sobre estacionamiento.' });
    default:
      return res.json(data);
  }
});

// ============================================================
// POST /api/agent/companies/find  { nombre }
// Busca empresa por nombre parcial. Devuelve { encontrada, empresa }
// ============================================================
const findSchema = z.object({ nombre: z.string().min(1) });
router.post('/companies/find', async (req, res) => {
  const parsed = findSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const empresa = await prisma.company.findFirst({
    where: { name: { contains: parsed.data.nombre, mode: 'insensitive' } },
  });
  if (!empresa) return res.json({ encontrada: false });
  res.json({
    encontrada: true,
    empresa: {
      id: empresa.id,
      nombre: empresa.name,
      contacto: empresa.contactName,
      telefono: empresa.phone,
      email: empresa.email,
    },
  });
});

// ============================================================
// POST /api/agent/companies  { nombre, contactName?, phone?, email?, address? }
// Registra empresa nueva
// ============================================================
const createCompanySchema = z.object({
  nombre: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
});
router.post('/companies', async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nombre, ...rest } = parsed.data;
  const existing = await prisma.company.findUnique({ where: { name: nombre } });
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Ya existe', empresa_id: existing.id });
  }
  const empresa = await prisma.company.create({
    data: { name: nombre, ...rest, email: rest.email || null },
  });
  res.status(201).json({ ok: true, empresa_id: empresa.id, nombre: empresa.name });
});

// ============================================================
// GET /api/agent/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD&required=N
// Devuelve dias con cupo en el rango (excluye domingos y bloqueados)
// ============================================================
router.get('/capacity', async (req, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const required = parseInt((req.query.required as string) || '1', 10);
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD)' });

  let desde = new Date(from + 'T00:00:00');
  const hasta = new Date(to + 'T23:59:59');
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return res.status(400).json({ error: 'Fechas invalidas' });
  }
  // No permitir consultar fechas pasadas
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (desde < hoy) desde = hoy;

  // Días ya tomados por batch activo (un batch por día)
  const batchesActivos = await prisma.companyBatch.findMany({
    where: { date: { gte: desde, lte: hasta }, status: { notIn: ['CANCELADO'] } },
    select: { date: true },
  });
  const diasConBatch = new Set(batchesActivos.map((b) => b.date.toISOString().slice(0, 10)));

  const overrides = await prisma.dayCapacity.findMany({
    where: { date: { gte: desde, lte: hasta } },
  });
  const overrideMap = new Map<string, { max: number; blocked: boolean }>();
  for (const o of overrides) {
    overrideMap.set(o.date.toISOString().slice(0, 10), { max: o.maxPatients, blocked: o.blocked });
  }

  const dias: any[] = [];
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // domingo cerrado
    const key = d.toISOString().slice(0, 10);
    const ov = overrideMap.get(key);
    if (ov?.blocked) continue;
    if (diasConBatch.has(key)) continue; // día ya tomado por otra empresa
    dias.push({ fecha: key, disponible: true });
  }
  res.json({
    dias_disponibles: dias.map((d) => d.fecha),
    sugerencias: dias.slice(0, 5).map((d) => d.fecha),
  });
});

// ============================================================
// POST /api/agent/agendar  { nombre_empresa, telefono, fecha, trabajadores, sessionId? }
// Todo en uno: busca/registra empresa + verifica disponibilidad + crea batch en BORRADOR
// ============================================================
const agendarSchema = z.object({
  nombre_empresa: z.string().min(1),
  telefono: z.string().min(1),
  fecha: z.string(),
  trabajadores: z.number().int().min(1).max(20),
  sessionId: z.string().optional(),
});
router.post('/agendar', async (req, res) => {
  const parsed = agendarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nombre_empresa, telefono, fecha, trabajadores, sessionId } = parsed.data;

  if (trabajadores > DEFAULT_CAP) {
    return res.status(400).json({ ok: false, error: `Máximo ${DEFAULT_CAP} trabajadores por día.` });
  }

  // Buscar o registrar empresa
  let empresa = await prisma.company.findFirst({
    where: { name: { equals: nombre_empresa, mode: 'insensitive' } },
  });
  if (!empresa) {
    empresa = await prisma.company.create({
      data: { name: nombre_empresa, phone: telefono },
    });
  } else if (!empresa.phone && telefono) {
    empresa = await prisma.company.update({ where: { id: empresa.id }, data: { phone: telefono } });
  }

  // Verificar disponibilidad
  const fechaDate = new Date(fecha + 'T00:00:00');
  if (isNaN(fechaDate.getTime())) return res.status(400).json({ ok: false, error: 'Fecha inválida' });
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (fechaDate < hoy) return res.status(400).json({ ok: false, error: 'No se puede agendar en fecha pasada.' });
  if (fechaDate.getDay() === 0) return res.status(400).json({ ok: false, error: 'Los domingos la clínica está cerrada.' });

  const dayStart = new Date(fechaDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(fechaDate); dayEnd.setHours(23, 59, 59, 999);
  const cap = await prisma.dayCapacity.findUnique({ where: { date: dayStart } });
  if (cap?.blocked) return res.status(409).json({ ok: false, error: 'Esa fecha está bloqueada.' });

  // Un solo batch por día — si ya existe uno activo, el día está tomado
  const batchExistente = await prisma.companyBatch.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['CANCELADO'] } },
    include: { company: true },
  });
  if (batchExistente) {
    return res.status(409).json({ ok: false, error: 'Ese día ya no está disponible. Por favor elige otra fecha.' });
  }

  // Crear batch en BORRADOR
  const batch = await prisma.companyBatch.create({
    data: {
      companyId: empresa.id,
      date: fechaDate,
      expectedCount: trabajadores,
      status: 'BORRADOR',
      contactPhone: telefono,
      sessionId,
    },
  });
  emit('batch:created', batch);
  res.status(201).json({
    ok: true,
    mensaje: 'Solicitud registrada en BORRADOR. El personal administrativo confirmará a la brevedad.',
    batch_id: batch.id,
    empresa: empresa.name,
    fecha: fechaDate.toISOString().slice(0, 10),
    trabajadores,
  });
});

// ============================================================
// POST /api/agent/batches  { empresa_id, fecha, expected_count, contacto*, notas?, sessionId? }
// Crea batch en BORRADOR
// ============================================================
const createBatchSchema = z.object({
  empresa_id: z.string().min(1),
  fecha: z.string(),
  expected_count: z.number().int().min(1).max(20),
  contacto_nombre: z.string().optional(),
  contacto_telefono: z.string().optional(),
  contacto_email: z.string().email().optional().or(z.literal('')),
  notas: z.string().optional(),
  sessionId: z.string().optional(),
});
router.post('/batches', async (req, res) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  if (d.expected_count > DEFAULT_CAP) {
    return res.status(400).json({ ok: false, error: `Maximo ${DEFAULT_CAP} pacientes por dia.` });
  }
  const empresa = await prisma.company.findUnique({ where: { id: d.empresa_id } });
  if (!empresa) return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });

  const fecha = new Date(d.fecha + 'T00:00:00');
  if (isNaN(fecha.getTime())) return res.status(400).json({ ok: false, error: 'Fecha invalida' });
  const hoyBatch = new Date(); hoyBatch.setHours(0, 0, 0, 0);
  if (fecha < hoyBatch) return res.status(400).json({ ok: false, error: 'No se puede agendar en una fecha pasada.' });

  const dayStart = new Date(fecha); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(fecha); dayEnd.setHours(23, 59, 59, 999);
  const cap = await prisma.dayCapacity.findUnique({ where: { date: dayStart } });
  if (cap?.blocked) return res.status(409).json({ ok: false, error: 'Esa fecha esta bloqueada' });
  const max = cap?.maxPatients ?? DEFAULT_CAP;
  const ocupado = await prisma.appointment.count({
    where: { date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['CANCELADA', 'NO_ASISTIO'] } },
  });
  if (ocupado + d.expected_count > max) {
    return res.status(409).json({ ok: false, error: `Cupo insuficiente. Disponible: ${max - ocupado}` });
  }

  const batch = await prisma.companyBatch.create({
    data: {
      companyId: d.empresa_id,
      date: fecha,
      expectedCount: d.expected_count,
      status: 'BORRADOR',
      contactName: d.contacto_nombre,
      contactPhone: d.contacto_telefono,
      contactEmail: d.contacto_email || null,
      notes: d.notas,
      sessionId: d.sessionId,
    },
  });
  emit('batch:created', batch);
  res.status(201).json({
    ok: true,
    batch_id: batch.id,
    empresa: empresa.name,
    fecha: fecha.toISOString().slice(0, 10),
    expected_count: d.expected_count,
    status: 'BORRADOR',
  });
});

// ============================================================
// POST /api/agent/batches/:id/workers  { trabajadores: [...] }
// Crea pacientes y citas dentro del batch
// ============================================================
const workerSchema = z.object({
  nombre_completo: z.string().min(3),
  fecha_nacimiento: z.string().optional(),
  nss: z.string().optional(),
  telefono: z.string().optional(),
  genero: z.enum(['M', 'F', 'O']).optional(),
  notas: z.string().optional(),
});
const workersSchema = z.object({ trabajadores: z.array(workerSchema).min(1) });

router.post('/batches/:id/workers', async (req, res) => {
  const parsed = workersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const batch = await prisma.companyBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ ok: false, error: 'Batch no encontrado' });
  if (batch.status !== 'BORRADOR') {
    return res.status(409).json({ ok: false, error: `Batch en estado ${batch.status}, no se puede modificar` });
  }

  const doctor = await prisma.user.findFirst({
    where: { role: 'DOCTOR', active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!doctor) return res.status(500).json({ ok: false, error: 'No hay doctores activos' });

  // Continua despues de las citas existentes en el batch
  const existentes = await prisma.appointment.count({ where: { batchId: batch.id } });
  let cursor = new Date(batch.date);
  cursor.setHours(9, 0, 0, 0);
  cursor = new Date(cursor.getTime() + existentes * 20 * 60 * 1000);

  const created: string[] = [];
  const skipped: any[] = [];

  for (const t of parsed.data.trabajadores) {
    const appt = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        date: new Date(cursor),
        durationMin: 20,
        type: 'EMPRESARIAL',
        status: 'AGENDADA',
        source: 'AGENT',
        batchId: batch.id,
        preNotes: t.notas || null,
      },
    });
    emit('appointment:created', appt);
    cursor = new Date(cursor.getTime() + 20 * 60 * 1000);
    created.push(appt.id);
  }

  res.json({
    ok: true,
    agregados: created.length,
    omitidos: skipped,
    total_en_batch: existentes + created.length,
  });
});

// ============================================================
// POST /api/agent/batches/:id/confirm
// Cierra batch en CONFIRMADO + marca citas como CONFIRMADA
// ============================================================
router.post('/batches/:id/confirm', async (req, res) => {
  const batch = await prisma.companyBatch.findUnique({
    where: { id: req.params.id },
    include: { appointments: true, company: true },
  });
  if (!batch) return res.status(404).json({ ok: false, error: 'Batch no encontrado' });
  if (batch.status !== 'BORRADOR') {
    return res.status(409).json({ ok: false, error: `Batch en estado ${batch.status}` });
  }
  if (batch.appointments.length === 0) {
    return res.status(400).json({ ok: false, error: 'No hay trabajadores en el batch' });
  }
  const updated = await prisma.companyBatch.update({
    where: { id: batch.id },
    data: { status: 'CONFIRMADO' },
  });
  await prisma.appointment.updateMany({
    where: { batchId: batch.id },
    data: { status: 'CONFIRMADA' },
  });
  emit('batch:confirmed', updated);
  res.json({
    ok: true,
    batch_id: updated.id,
    empresa: batch.company.name,
    fecha: batch.date.toISOString().slice(0, 10),
    pacientes: batch.appointments.length,
    status: 'CONFIRMADO',
  });
});

// ============================================================
// POST /api/agent/batches/:id/cancel  { motivo? }
// ============================================================
router.post('/batches/:id/cancel', async (req, res) => {
  const motivo = (req.body?.motivo as string) || undefined;
  const batch = await prisma.companyBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ ok: false, error: 'Batch no encontrado' });
  await prisma.companyBatch.update({
    where: { id: batch.id },
    data: { status: 'CANCELADO', notes: motivo },
  });
  await prisma.appointment.updateMany({
    where: { batchId: batch.id },
    data: { status: 'CANCELADA' },
  });
  emit('batch:cancelled', { id: batch.id });
  res.json({ ok: true });
});

// ============================================================
// GET /api/agent/batches/:id
// Detalle de batch (para resumen al usuario)
// ============================================================
router.get('/batches/:id', async (req, res) => {
  const batch = await prisma.companyBatch.findUnique({
    where: { id: req.params.id },
    include: {
      company: true,
      appointments: { include: { patient: true }, orderBy: { date: 'asc' } },
    },
  });
  if (!batch) return res.status(404).json({ ok: false, error: 'Batch no encontrado' });
  res.json({
    ok: true,
    batch_id: batch.id,
    empresa: batch.company.name,
    fecha: batch.date.toISOString().slice(0, 10),
    status: batch.status,
    expected_count: batch.expectedCount,
    actual_count: batch.appointments.length,
    contacto: batch.contactName,
    telefono: batch.contactPhone,
    trabajadores: batch.appointments.map((a) => ({
      paciente_id: a.patientId,
      nombre: a.patient.fullName,
      hora: a.date.toISOString().slice(11, 16),
      status: a.status,
    })),
  });
});

// DELETE /api/agent/chat/history — reinicia la conversacion web del usuario actual
router.delete('/chat/history', async (req: any, res) => {
  const id = req.user?.id || 'web-admin';
  await prisma.conversation.deleteMany({ where: { channel: 'web', externalId: id } });
  res.json({ ok: true });
});

// GET /api/agent/chat/history — historial de la conversacion web del usuario actual
router.get('/chat/history', async (req: any, res) => {
  const id = req.user?.id || 'web-admin';
  const convo = await prisma.conversation.findUnique({
    where: { channel_externalId: { channel: 'web', externalId: id } },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
  });
  if (!convo) return res.json({ messages: [] });
  const messages = convo.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'agent',
      text: m.role === 'assistant'
        ? (Array.isArray(m.content) ? (m.content as any[]).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') : String(m.content))
        : String(m.content),
    }))
    .filter((m) => m.text.trim());
  res.json({ messages });
});

// POST /api/agent/chat — chat web desde el panel admin
router.post('/chat', async (req: any, res) => {
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message requerido' });
  const id = sessionId || req.user?.id || 'web-admin';
  try {
    const reply = await processMessage('web', id, message.trim());
    res.json({ reply });
  } catch (err: any) {
    console.error('[agent/chat]', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

export default router;
