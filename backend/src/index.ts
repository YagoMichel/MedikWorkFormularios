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
        horasDeporte: d.horasDeporte, habitosAlimenticios: d.habitosAlimenticios,
        calidadSueno: d.calidadSueno, especifiqueSueno: d.especifiqueSueno,
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
        edadInicioLaboral: d.edadInicioLaboral, trabajoMinas: d.trabajoMinas,
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
