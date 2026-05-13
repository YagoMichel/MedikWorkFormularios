import 'dotenv/config';
import express from 'express';
import { prisma } from './prisma';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { initSocket } from './socket';
import auth from './routes/auth';
import patients from './routes/patients';
import appointments from './routes/appointments';
import prescriptions from './routes/prescriptions';
import inventory from './routes/inventory';
import movements from './routes/movements';
import sales from './routes/sales';
import dashboard from './routes/dashboard';
import users from './routes/users';
import companies from './routes/companies';
import agent from './routes/agent';
import whatsapp from './routes/whatsapp';
import batches from './routes/batches';
import surveys from './routes/surveys';
import medicalExams from './routes/medicalExams';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rutas públicas — sin login
app.get('/api/public/companies', async (_req, res) => {
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  res.json(companies);
});

// Ruta pública — paciente llena encuesta sin login
app.post('/api/public/survey', async (req, res) => {
  const d = req.body;
  try {
    const patient = await prisma.patient.create({
      data: {
        fullName: d.nombre || 'Sin nombre',
        phone: d.celular || null,
        email: d.correo || null,
        nss: d.nss || null,
        birthDate: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
        company: d.empresa || null,
      },
    });
    await prisma.patientSurvey.create({
      data: {
        patientId: patient.id,
        empresa: d.empresa, tipoExamen: d.tipoExamen, otroTipo: d.otroTipo, actividades: d.actividades,
        nombre: d.nombre, edad: d.edad ? parseInt(d.edad) : null, tipoSangre: d.tipoSangre,
        puestoDeTrabajo: d.puestoDeTrabajo, celular: d.celular, nss: d.nss,
        fechaNacimiento: d.fechaNacimiento, escolaridad: d.escolaridad, estadoCivil: d.estadoCivil,
        lugarNacimiento: d.lugarNacimiento, correo: d.correo,
        calle: d.calle, numero: d.numero, colonia: d.colonia, municipio: d.municipio, cp: d.cp,
        practicaDeporte: d.practicaDeporte ?? null, cualDeporte: d.cualDeporte,
        horasDeporte: d.horasDeporte, habitosAlimenticios: d.habitosAlimenticios,
        calidadSueno: d.calidadSueno, especifiqueSueno: d.especifiqueSueno,
        fuma: d.fuma, edadInicioFuma: d.edadInicioFuma, anosFumando: d.anosFumando, cigarrosDia: d.cigarrosDia,
        consumeAlcohol: d.consumeAlcohol ?? null, tipoBebida: d.tipoBebida,
        cantidadBebidas: d.cantidadBebidas, frecuenciaAlcohol: d.frecuenciaAlcohol,
        consumeDrogas: d.consumeDrogas, cualDroga: d.cualDroga, frecuenciaDroga: d.frecuenciaDroga,
        tiempoDroga: d.tiempoDroga, ultimaVezDroga: d.ultimaVezDroga,
        esquemaVacunacion: d.esquemaVacunacion ?? null, dosisAnticovid: d.dosisAnticovid,
        marcaVacuna: d.marcaVacuna, tieneTatuajes: d.tieneTatuajes ?? null,
        ultimoTatuaje: d.ultimoTatuaje, usaAudifonos: d.usaAudifonos ?? null,
        antecedentesFamiliares: d.antecedentesFamiliares, edadInicioLaboral: d.edadInicioLaboral,
        trabajoMinas: d.trabajoMinas, exposiciones: d.exposiciones,
        historialEmpleos: d.historialEmpleos, antecedentesPatologicos: d.antecedentesPatologicos,
      },
    });
    res.status(201).json({ ok: true, patientId: patient.id });
  } catch (err: any) {
    console.error('[public/survey]', err);
    res.status(500).json({ error: err.message });
  }
});
app.use('/api/auth', auth);
app.use('/api/patients', patients);
app.use('/api/appointments', appointments);
app.use('/api/prescriptions', prescriptions);
app.use('/api/inventory', inventory);
app.use('/api/movements', movements);
app.use('/api/sales', sales);
app.use('/api/dashboard', dashboard);
app.use('/api/users', users);
app.use('/api/companies', companies);
app.use('/api/agent', agent);
app.use('/api/whatsapp', whatsapp);
app.use('/api/batches', batches);
app.use('/api/surveys', surveys);
app.use('/api/medical-exams', medicalExams);

const PORT = parseInt(process.env.PORT || '4000');
const server = createServer(app);
initSocket(server);
server.listen(PORT, () => console.log(`API running on :${PORT}`));
