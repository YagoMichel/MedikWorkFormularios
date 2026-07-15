// =============================================================
// ARCHIVO: src/index.ts
// DESCRIPCION: Punto de entrada del servidor Express.
//              Registra middlewares, rutas y arranca el servidor.
// PUERTO: 4000 (configurable via env PORT)
// =============================================================

import 'dotenv/config';
import dns from 'dns';
// La red de Docker Desktop expone rutas IPv6 que no son alcanzables desde el
// contenedor (ENETUNREACH) hacia hosts que sí resuelven AAAA, como
// login.microsoftonline.com — sin esto, las llamadas a Microsoft Graph
// (sincronización OneDrive) fallan aunque la IPv4 funcione perfecto.
// `dns.setDefaultResultOrder('ipv4first')` no es suficiente en este entorno
// (Alpine/musl sigue devolviendo AAAA primero), así que se fuerza `family: 4`
// directo en dns.lookup, del que dependen net/tls/undici por debajo.
const originalLookup = dns.lookup;
// @ts-ignore — dns.lookup tiene varias sobrecargas; solo nos interesa forzar family: 4
dns.lookup = (hostname: string, options: any, callback?: any) => {
  if (typeof options === 'function') { callback = options; options = {}; }
  return originalLookup(hostname, { ...options, family: 4 }, callback);
};
import 'express-async-errors'; // hace que los errores de handlers async lleguen al middleware de error de abajo, en vez de tumbar el proceso
import express from 'express';
import { prisma } from './prisma';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { initSocket } from './socket';
import { authRequiredCookieOrHeader, AuthRequest } from './middleware/auth';
import { apiLimiter, publicSurveyLimiter, publicCpLimiter } from './middleware/rateLimits';
import { verifyTurnstile } from './middleware/turnstile';
import { issueSurveyChallenge, surveyAntiBot } from './middleware/surveyAntiBot';

// ---- Rutas protegidas (requieren token JWT) ----
import auth         from './routes/auth';
import oauth        from './routes/oauth';
import patients     from './routes/patients';
import appointments from './routes/appointments';
import prescriptions from './routes/prescriptions';
import inventory    from './routes/inventory';
import movements    from './routes/movements';
import sales        from './routes/sales';
import dashboard    from './routes/dashboard';
import users        from './routes/users';
import companies    from './routes/companies';
import companyProfiles from './routes/companyProfiles';
import agent        from './routes/agent';
import batches      from './routes/batches';
import surveys      from './routes/surveys';
import medicalExams from './routes/medicalExams';
import documents    from './routes/documents';
import portal       from './routes/portal';
import system       from './routes/system';
import audit        from './routes/audit';

const app = express();

// Detrás de nginx: confiar en los proxies delante para que req.ip sea la IP
// real del cliente (necesario para rate limits y la IP de la bitácora).
//
// TRUST_PROXY_HOPS = número EXACTO de proxies confiables entre el cliente e
// internet y este backend. Debe coincidir con la topología real:
//   1 → solo el nginx del contenedor es el borde (default, local/dev)
//   2 → hay UN reverse proxy del host (nginx/Caddy) delante del nginx del contenedor
//   …  → un salto más por cada proxy adicional
// OJO: poner un número MAYOR al real es un hueco de seguridad — deja que un
// cliente falsee su IP con un X-Forwarded-For inventado. Con CDN (Cloudflare)
// no se usa esto: se lee CF-Connecting-IP y se restringe a las IPs del CDN.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

// ---- Middlewares globales ----
app.use(helmet()); // cabeceras de seguridad estándar (X-Content-Type-Options, HSTS, etc.)

// CORS: en producción definir CORS_ORIGIN (lista separada por comas, ej.
// "https://clinica.mediworkzac.com") — sin definirla se permite cualquier
// origen, aceptable solo en desarrollo.
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins, credentials: true } : {}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // limite para imagenes en base64

// Límite global de peticiones a la API (los límites finos por ruta —
// login, encuesta pública, CP — se aplican abajo por separado)
app.use('/api', apiLimiter);

// ---- Archivos subidos (fotos de pacientes, documentos) ----
// Protegidos: aceptan el JWT por header o por la cookie httpOnly (los <img> del
// navegador no mandan headers, pero la cookie viaja sola).
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
// Los documentos del expediente (/uploads/documents) solo se sirven DIRECTO al
// personal interno. Los portales (PACIENTE/EMPRESA) NUNCA acceden por ruta:
// usan sus endpoints de descarga que verifican propiedad + autorización del
// médico. Así un usuario de portal no puede leer un archivo ajeno por su ruta.
const STAFF_ROLES = ['ADMIN', 'DOCTOR', 'MASTER'];
app.use('/uploads', authRequiredCookieOrHeader, (req: AuthRequest, res, next) => {
  if (req.path.startsWith('/documents') && !STAFF_ROLES.includes(req.user!.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, express.static(UPLOAD_DIR));

// ---- Health check (Docker/nginx lo usa para saber si el server vive) ----
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// =============================================================
// RUTAS PUBLICAS — No requieren login
// =============================================================

// Lista de empresas para el agente/bot y encuesta publica
app.get('/api/public/companies', async (_req, res) => {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  res.json(companies);
});

// Encuesta medica que llena el paciente en la tablet antes del examen
// Crea el paciente y su encuesta en una sola operacion
// Protegida contra bots: rate limit + captcha Turnstile (si está configurado)
// Token de tiempo firmado para la encuesta pública (defensa anti-bots). El
// frontend lo pide al abrir /encuesta y lo devuelve al enviar.
app.get('/api/public/survey/challenge', issueSurveyChallenge);

app.post('/api/public/survey', publicSurveyLimiter, surveyAntiBot, verifyTurnstile, async (req, res) => {
  const d = req.body;
  try {
    // Resuelve la FK de empresa por nombre (igual que la encuesta de la tablet),
    // para que el paciente quede ligado a su Company y no solo al texto libre.
    const empresa = typeof d.empresa === 'string' ? d.empresa.trim() : '';
    const companyId = empresa && empresa !== 'Sin empresa'
      ? (await prisma.company.findFirst({ where: { name: { equals: empresa, mode: 'insensitive' } }, select: { id: true } }))?.id ?? null
      : null;

    // Primero crea el paciente con datos basicos
    const patient = await prisma.patient.create({
      data: {
        fullName:  d.nombre        || 'Sin nombre',
        phone:     d.celular       || null,
        email:     d.correo        || null,
        nss:       d.nss           || null,
        birthDate: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
        company:   d.empresa       || null,
        companyId,
      },
    });

    // Luego guarda la encuesta completa ligada al paciente
    await prisma.patientSurvey.create({
      data: {
        patientId: patient.id,
        // Encabezado
        empresa: d.empresa, tipoExamen: d.tipoExamen, otroTipo: d.otroTipo, actividades: d.actividades,
        // Datos personales
        nombre: d.nombre, edad: d.edad ? parseInt(d.edad) : null, tipoSangre: d.tipoSangre,
        puestoDeTrabajo: d.puestoDeTrabajo, celular: d.celular, nss: d.nss,
        fechaNacimiento: d.fechaNacimiento, escolaridad: d.escolaridad, estadoCivil: d.estadoCivil,
        lugarNacimiento: d.lugarNacimiento, correo: d.correo,
        // Domicilio
        calle: d.calle, numero: d.numero, colonia: d.colonia, municipio: d.municipio, cp: d.cp,
        // Habitos
        practicaDeporte: d.practicaDeporte ?? null, cualDeporte: d.cualDeporte,
        frecuenciaDeporte: d.frecuenciaDeporte, horasDeporte: d.horasDeporte,
        habitosAlimenticios: d.habitosAlimenticios, comidasDia: d.comidasDia,
        consumeFrutasVerduras: d.consumeFrutasVerduras, aguaDia: d.aguaDia,
        calidadSueno: d.calidadSueno, horasSueno: d.horasSueno, especifiqueSueno: d.especifiqueSueno,
        // Tabaquismo
        fuma: d.fuma, edadInicioFuma: d.edadInicioFuma, anosFumando: d.anosFumando, cigarrosDia: d.cigarrosDia,
        // Alcoholismo
        consumeAlcohol: d.consumeAlcohol ?? null, tipoBebida: d.tipoBebida,
        cantidadBebidas: d.cantidadBebidas, frecuenciaAlcohol: d.frecuenciaAlcohol,
        // Drogas
        consumeDrogas: d.consumeDrogas, cualDroga: d.cualDroga, frecuenciaDroga: d.frecuenciaDroga,
        tiempoDroga: d.tiempoDroga, ultimaVezDroga: d.ultimaVezDroga,
        // Vacunacion y otros
        esquemaVacunacion: d.esquemaVacunacion ?? null, dosisAnticovid: d.dosisAnticovid,
        marcaVacuna: d.marcaVacuna, tieneTatuajes: d.tieneTatuajes ?? null,
        ultimoTatuaje: d.ultimoTatuaje, usaAudifonos: d.usaAudifonos ?? null,
        // Antecedentes (JSON arrays)
        antecedentesFamiliares: d.antecedentesFamiliares,
        // Laborales
        edadInicioLaboral: d.edadInicioLaboral, trabajoMinas: d.trabajoMinas ?? null, tiempoMinas: d.tiempoMinas,
        exposiciones: d.exposiciones, historialEmpleos: d.historialEmpleos,
        antecedentesPatologicos: d.antecedentesPatologicos,
      },
    });

    res.status(201).json({ ok: true, patientId: patient.id });
  } catch (err: any) {
    console.error('[public/survey]', err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy de código postal — prueba varias APIs en cascada
app.get('/api/public/cp/:codigo', publicCpLimiter, async (req, res) => {
  const { codigo } = req.params;
  if (!/^\d{5}$/.test(codigo)) return res.status(400).json({ error: 'CP inválido' }) as any;

  // API 1: copomex
  try {
    const r = await fetch(`https://api.copomex.com/query/info_cp/${codigo}?token=pruebas`,
      { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data = await r.json() as any;
      const items: any[] = Array.isArray(data) ? data : [data];
      const valid = items.filter((i: any) => !i.error && i.codigo_postal);
      if (valid.length) {
        return res.json({
          municipio: valid[0].codigo_postal.D_mnpio || '',
          estado:    valid[0].codigo_postal.d_estado || '',
          colonias:  [...new Set<string>(valid.map((i: any) => i.codigo_postal.d_asenta).filter(Boolean))],
        });
      }
    }
  } catch (e: any) { console.error('[cp copomex]', e.message); }

  // API 2: IcaliaLabs sepomex
  try {
    const r = await fetch(`https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${codigo}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (r.ok) {
      const data = await r.json() as any;
      const items: any[] = data.zip_codes || [];
      if (items.length) {
        return res.json({
          municipio: items[0].D_mnpio || '',
          estado:    items[0].d_estado || '',
          colonias:  [...new Set<string>(items.map((i: any) => i.d_asenta).filter(Boolean))],
        });
      }
    }
  } catch (e: any) { console.error('[cp icalialabs]', e.message); }

  // API 3: zippopotam (solo estado)
  try {
    const r = await fetch(`https://api.zippopotam.us/mx/${codigo}`,
      { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data = await r.json() as any;
      const places: any[] = data.places || [];
      if (places.length) {
        return res.json({
          municipio: '',
          estado:    places[0].state || '',
          colonias:  places.map((p: any) => p['place name']).filter(Boolean),
        });
      }
    }
  } catch (e: any) { console.error('[cp zippopotam]', e.message); }

  res.status(404).json({ error: 'CP no encontrado' });
});

// =============================================================
// RUTAS PROTEGIDAS — Requieren token JWT (ver middleware/auth.ts)
// =============================================================

// -- Autenticacion --
app.use('/api/auth/oauth',   oauth);         // Login social Google/Microsoft (config-gated)
app.use('/api/auth',         auth);

// -- Doctor / Compartido (DOCTOR + ADMIN) --
app.use('/api/patients',     patients);      // Pacientes
app.use('/api/appointments', appointments);  // Citas
app.use('/api/prescriptions',prescriptions); // Recetas
app.use('/api/surveys',      surveys);       // Encuestas medicas
app.use('/api/medical-exams',medicalExams);  // Examenes medicos
app.use('/api/documents',    documents);     // Expediente documental (encuesta, resultados, consentimiento)

// -- Portales externos (PACIENTE / EMPRESA) — cada quien ve solo lo suyo --
app.use('/api/portal',       portal);

// -- Admin --
app.use('/api/inventory',    inventory);     // Inventario de productos
app.use('/api/movements',    movements);     // Movimientos de inventario
app.use('/api/sales',        sales);         // Ventas
app.use('/api/dashboard',    dashboard);     // Stats del dashboard
app.use('/api/users',        users);         // Gestion de usuarios
app.use('/api/companies',    companies);     // Empresas clientes
app.use('/api/company-profiles', companyProfiles); // Perfiles/checklist de estudios por empresa
app.use('/api/batches',      batches);       // Citas de empresa
app.use('/api/system',       system);        // Panel de estado (exclusivo MASTER)
app.use('/api/audit',        audit);         // Bitácora de auditoría (ADMIN/MASTER)

// -- Bot externo (WhatsApp u otro canal, desarrollado por 3er ingeniero) --
// Auth: JWT con role AGENT — generar con: npm run agent:token
app.use('/api/agent',        agent);

// Red de seguridad: sin esto, cualquier error no capturado en una ruta
// (ej. una promesa rechazada) tumba todo el proceso en vez de responder 500.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// =============================================================
// INICIO DEL SERVIDOR
// =============================================================
const PORT = parseInt(process.env.PORT || '4000');
const server = createServer(app);
initSocket(server); // WebSocket para actualizaciones en tiempo real
server.listen(PORT, () => console.log(`API running on :${PORT}`));
