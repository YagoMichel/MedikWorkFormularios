// =============================================================
// ARCHIVO: src/index.ts
// DESCRIPCION: Punto de entrada del servidor Express.
//              Registra middlewares, rutas y arranca el servidor.
// PUERTO: 4000 (configurable via env PORT)
// =============================================================

import 'dotenv/config';
import express from 'express';
import { prisma } from './prisma';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './socket';

// ---- Rutas protegidas (requieren token JWT) ----
import auth         from './routes/auth';
import patients     from './routes/patients';
import appointments from './routes/appointments';
import prescriptions from './routes/prescriptions';
import inventory    from './routes/inventory';
import movements    from './routes/movements';
import sales        from './routes/sales';
import dashboard    from './routes/dashboard';
import users        from './routes/users';
import companies    from './routes/companies';
import agent        from './routes/agent';
import batches      from './routes/batches';
import surveys      from './routes/surveys';
import medicalExams from './routes/medicalExams';
import documents    from './routes/documents';

const app = express();

// ---- Middlewares globales ----
app.use(cors());
app.use(express.json({ limit: '10mb' })); // limite para imagenes en base64

// ---- Archivos subidos (fotos de pacientes, recetas) ----
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(UPLOAD_DIR));

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
app.post('/api/public/survey', async (req, res) => {
  const d = req.body;
  try {
    // Primero crea el paciente con datos basicos
    const patient = await prisma.patient.create({
      data: {
        fullName:  d.nombre        || 'Sin nombre',
        phone:     d.celular       || null,
        email:     d.correo        || null,
        nss:       d.nss           || null,
        birthDate: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
        company:   d.empresa       || null,
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
app.get('/api/public/cp/:codigo', async (req, res) => {
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
app.use('/api/auth',         auth);

// -- Doctor / Compartido (DOCTOR + ADMIN) --
app.use('/api/patients',     patients);      // Pacientes
app.use('/api/appointments', appointments);  // Citas
app.use('/api/prescriptions',prescriptions); // Recetas
app.use('/api/surveys',      surveys);       // Encuestas medicas
app.use('/api/medical-exams',medicalExams);  // Examenes medicos
app.use('/api/documents',    documents);     // Expediente documental (encuesta, resultados, consentimiento)

// -- Admin --
app.use('/api/inventory',    inventory);     // Inventario de productos
app.use('/api/movements',    movements);     // Movimientos de inventario
app.use('/api/sales',        sales);         // Ventas
app.use('/api/dashboard',    dashboard);     // Stats del dashboard
app.use('/api/users',        users);         // Gestion de usuarios
app.use('/api/companies',    companies);     // Empresas clientes
app.use('/api/batches',      batches);       // Citas de empresa

// -- Bot externo (WhatsApp u otro canal, desarrollado por 3er ingeniero) --
// Auth: JWT con role AGENT — generar con: npm run agent:token
app.use('/api/agent',        agent);

// =============================================================
// INICIO DEL SERVIDOR
// =============================================================
const PORT = parseInt(process.env.PORT || '4000');
const server = createServer(app);
initSocket(server); // WebSocket para actualizaciones en tiempo real
server.listen(PORT, () => console.log(`API running on :${PORT}`));
