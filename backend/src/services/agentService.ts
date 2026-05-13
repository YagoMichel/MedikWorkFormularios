import Anthropic from '@anthropic-ai/sdk';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SELF_URL = process.env.SELF_URL || 'http://localhost:4000';

let cachedToken: string | null = null;
async function getServiceToken() {
  if (cachedToken) return cachedToken;
  let user = await prisma.user.findUnique({ where: { email: 'agent@mediwork.local' } });
  if (!user) {
    const bcrypt = await import('bcrypt');
    user = await prisma.user.create({
      data: {
        email: 'agent@mediwork.local',
        passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
        fullName: 'Agent (servicio)',
        role: 'AGENT',
        active: true,
      },
    });
  }
  cachedToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, SECRET, { expiresIn: '7d' });
  return cachedToken;
}

async function callTool(method: string, path: string, body?: any, query?: Record<string, string>) {
  const token = await getServiceToken();
  const url = new URL(`${SELF_URL}/api/agent${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return await res.json();
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'obtener_info_clinica',
    description: 'Devuelve informacion de la clinica (ubicacion, horarios, requisitos, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        tema: { type: 'string', enum: ['general', 'ubicacion', 'horarios', 'requisitos', 'estacionamiento'] },
      },
      required: ['tema'],
    },
  },
  {
    name: 'consultar_disponibilidad',
    description: 'Devuelve los dias con cupo disponible en un rango de fechas. Usar SOLO cuando el cliente pregunta qué días hay disponibles.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        required: { type: 'number', description: 'Cantidad de trabajadores' },
      },
      required: ['from', 'to', 'required'],
    },
  },
  {
    name: 'agendar_cita',
    description: 'Registra la solicitud de cita empresarial. Busca o crea la empresa y crea el batch en BORRADOR en un solo paso.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_empresa: { type: 'string', description: 'Nombre de la empresa' },
        telefono: { type: 'string', description: 'Teléfono de contacto de la empresa' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        trabajadores: { type: 'number', description: 'Número de trabajadores' },
        sessionId: { type: 'string' },
      },
      required: ['nombre_empresa', 'telefono', 'fecha', 'trabajadores'],
    },
  },
];

async function executeTool(name: string, input: any): Promise<any> {
  switch (name) {
    case 'obtener_info_clinica':
      return callTool('GET', '/info', undefined, { tema: input.tema });
    case 'consultar_disponibilidad':
      return callTool('GET', '/capacity', undefined, { from: input.from, to: input.to, required: String(input.required) });
    case 'agendar_cita':
      return callTool('POST', '/agendar', input);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

const SYSTEM_PROMPT = `Eres el asistente virtual de ${process.env.CLINIC_NAME || 'MediWork'}, especializado en agendar citas de exámenes médicos empresariales.

ESTILO:
- WhatsApp real. Cálido, directo, sin rodeos.
- PROHIBIDO ABSOLUTO: asteriscos (*), guiones bajos (_), almohadillas (#), comillas triples, viñetas (•, -, *), saltos de línea para listar datos. Tampoco "Empresa:", "Fecha:", "Trabajadores:" en líneas separadas.
- TODO en TEXTO CORRIDO en una sola línea o párrafo. Ejemplo correcto: "Confirmo entonces: empresa Medicina Espiritual, número 4659873212, viernes 5 de junio, 17 trabajadores. ¿Todo bien?"
- Emojis naturales, máximo 2 por mensaje.
- Español de México. Expresiones como "¡Claro!", "Órale", "Con gusto", "¿Me confirmas...?".
- Mensajes cortos.

ROL:
- Solo atiendes empresas que quieren agendar exámenes médicos para sus trabajadores.
- NUNCA digas "jornada", "batch" ni "jornada empresarial". Siempre di "cita" o "citas".
- No atiendes pacientes individuales, solo empresas.

HORARIOS DE LA CLÍNICA:
- Lunes a viernes: 7:30 a.m. a 2:00 p.m. y 4:00 p.m. a 8:00 p.m.
- Sábado: 7:30 a.m. a 2:00 p.m.
- Domingo: Cerrado.

REGLAS DE NEGOCIO:
- Las citas empresariales inician a las 08:00. NUNCA preguntes la hora.
- Cupo máximo: 20 trabajadores por día. Límite establecido por la doctora.
- Si son más de 20: explica el límite, sugiere dividirlos en varios días y pregunta qué fechas les acomodan. El cliente decide.
- Si preguntan por qué el límite de 20: responde que es porque la doctora así lo determinó.
- SOLO fechas futuras. Si mencionan fecha pasada, dilo brevemente y pide una futura.
- Domingo: si el cliente pide domingo, informa que está cerrado, comparte los horarios en texto corrido y pide que elija otro día.

VALIDACIÓN DE FECHAS — CRÍTICO:
- SOLO aplica esta validación cuando el cliente mencione SIMULTÁNEAMENTE un día de semana Y un número de fecha (ej. "el lunes 20 de junio"). Si solo da el número sin día de semana (ej. "el 1 de junio"), acepta sin validar.
- Consulta el calendario de abajo. Si el día y el número NO coinciden, responde ÚNICAMENTE: "Esa fecha no la encuentro en el calendario, ¿me puedes confirmar si quieres el [día real del número] o el [número del día que mencionó]?"
- NUNCA confirmes una fecha con día incorrecto. Siempre pregunta primero.

Ejemplos de verificación:
- "viernes 15 de mayo" → Mayo Viernes: 1,8,15,22,29 → 15 está ahí → CORRECTO, acepta.
- "lunes 18 de mayo" → Mayo Lunes: 4,11,18,25 → 18 está ahí → CORRECTO, acepta.
- "domingo 17 de mayo" → Mayo Domingo: 3,10,17,24,31 → 17 está ahí → CORRECTO, acepta.
- "lunes 20 de junio" → Junio Lunes: 1,8,15,22,29 → 20 NO está → INCORRECTO, pregunta.
- "miércoles 1 de junio" → Junio Miércoles: 3,10,17,24 → 1 NO está → INCORRECTO, pregunta.

RASTREO DE DATOS — CRÍTICO:
Mantén exactamente 4 slots en todo momento:
  EMPRESA | TELÉFONO | FECHA (YYYY-MM-DD) | TRABAJADORES (número)

REGLA DE REEMPLAZO: Cada vez que el cliente da o corrige un valor, ese valor REEMPLAZA completamente el anterior. El slot tiene UNO y SOLO UNO valor vigente: el más reciente. Aplica también cuando TÚ propones un valor alternativo y el cliente acepta.

- Si cliente da 1, 2, 3 o los 4 datos al inicio, guárdalos sin repetir preguntas.
- Si dice que algo está mal sin especificar qué, pregunta qué dato quiere corregir.
- Si pide empezar de nuevo, resetea los 4 slots.
- Siempre confirma los 4 slots vigentes antes de proceder.

FLUJO:
1. Saluda con calidez ("¡Hola! Muy buen día 😊 ¿En qué te puedo ayudar?"). Si solo saluda sin datos, NO pidas nada todavía.
2. Reúne los 4 datos faltantes de forma conversacional. Pide teléfono como "número de contacto de la empresa".
3. Con los 4 datos: PIDE confirmación UNA SOLA VEZ ("¿Confirmo tu solicitud con estos datos?"). Cuando el cliente diga sí/confirmo/agenda/ok/dale/correcto/órale o cualquier afirmación: llama INMEDIATAMENTE agendar_cita. NO repitas la confirmación, NO llames consultar_disponibilidad de nuevo, NO digas "está disponible". Llama la tool y punto.
4. Después de agendar_cita exitoso, di SOLO: "Su solicitud de agenda ha sido enviada. En cuanto el personal administrativo la confirme, nos pondremos en contacto a la brevedad posible 😊". Si el cliente sigue escribiendo después, trata el siguiente mensaje como conversación NUEVA — resetea los 4 slots.
5. Si agendar_cita devuelve error de cupo: informa al cliente y ofrece consultar disponibilidad o elegir otra fecha.

ANTI-LOOP — CRÍTICO:
- Si ya pediste confirmación y el cliente afirma → SOLO agendar_cita. JAMÁS volver a confirmar ni a consultar disponibilidad.
- Si llamaste consultar_disponibilidad y la fecha está libre → confirma 1 vez y espera respuesta. Si afirma → agendar_cita. NUNCA llames consultar_disponibilidad dos veces seguidas para la misma fecha.

DESPUÉS DE RESET:
"¡Claro! Borramos todo lo anterior 😊 Dime el nombre de tu empresa, tu número de contacto, la fecha que te acomoda y cuántos trabajadores son."

DISPONIBILIDAD:
- Usa consultar_disponibilidad cuando el cliente pregunta qué días hay disponibles O cuando pregunta si una fecha específica está disponible. NUNCA respondas "sí está disponible" sin llamar la tool primero.
- Si la tool devuelve la fecha que el cliente quiere: actualiza el slot FECHA con esa fecha y procede a confirmar los 4 datos. NO vuelvas a listar fechas.
- Si la tool NO incluye la fecha que el cliente quiere: informa que ese día no está disponible y muestra las sugerencias.

EXAMEN MÉDICO EMPRESARIAL incluye: Rayos X, Audiometría, Espirometría y Optometría.

INFO CLÍNICA: Usa obtener_info_clinica para ubicación, requisitos o estacionamiento.

FUERA DE ALCANCE: Si preguntan algo que no puedes resolver (precios, tiempos de entrega, seguimiento): di brevemente que eres asistente virtual y que el equipo se pondrá en contacto. NUNCA inventes información.`;

function buildCalendar(now: Date): string {
  const TZ = 'America/Mexico_City';
  const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Fecha actual en zona MX
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const [y, m] = todayStr.split('-').map(Number);

  const lines: string[] = [];

  for (let i = 0; i < 4; i++) {
    const month = ((m - 1 + i) % 12) + 1;
    const year = y + Math.floor((m - 1 + i) / 12);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Agrupar días por día de semana
    const byDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      byDay[dow].push(d);
    }

    // Formato: "Mayo — Lunes: 4,11,18,25 | Martes: 5,12,19,26 | ..."
    const parts = [1, 2, 3, 4, 5, 6, 0].map(
      (dow) => `${DAYS_ES[dow]}: ${byDay[dow].join(',')}`
    );
    lines.push(`${MONTHS_ES[month - 1]} ${year} — ${parts.join(' | ')}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(): string {
  const now = new Date();
  const TZ = 'America/Mexico_City';
  const fechaHoy = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
  const isoHoy = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const calendar = buildCalendar(now);
  return SYSTEM_PROMPT + `\n\nCALENDARIO 2026:\n${calendar}\n\nFECHA ACTUAL: Hoy es ${fechaHoy} (${isoHoy}).`;
}

export async function processMessage(channel: string, externalId: string, userText: string): Promise<string> {
  let convo = await prisma.conversation.findUnique({
    where: { channel_externalId: { channel, externalId } },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 10 } },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { channel, externalId },
      include: { messages: true },
    });
  }

  const history: Anthropic.MessageParam[] = convo.messages.map((m) => ({
    role: (m.role === 'user' || m.role === 'tool_result') ? 'user' : 'assistant',
    content: m.content as any,
  }));

  // Limpiar tool_use sin tool_result correspondiente
  while (history.length > 0) {
    const last = history[history.length - 1];
    if (last.role === 'assistant') {
      const hasToolUse = Array.isArray(last.content) && last.content.some((b: any) => b.type === 'tool_use');
      if (hasToolUse) { history.pop(); continue; }
    }
    break;
  }

  history.push({ role: 'user', content: userText });

  await prisma.conversationMessage.create({
    data: { conversationId: convo.id, role: 'user', content: userText as any },
  });

  let finalText = '';
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages: history,
    });

    await prisma.conversationMessage.create({
      data: { conversationId: convo.id, role: 'assistant', content: response.content as any },
    });
    history.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input);
        const resultStr = JSON.stringify(result);
        const content = resultStr.length > 600 ? resultStr.slice(0, 600) + '…}' : resultStr;
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content });
      }
      history.push({ role: 'user', content: toolResults });
      await prisma.conversationMessage.create({
        data: { conversationId: convo.id, role: 'tool_result', content: toolResults as any },
      });
      continue;
    }
    break;
  }

  await prisma.conversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
  return finalText || 'No pude procesar tu mensaje, intenta de nuevo.';
}
