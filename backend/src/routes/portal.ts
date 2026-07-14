// =============================================================
// ARCHIVO: src/routes/portal.ts
// DESCRIPCION: Portales externos de PACIENTE y EMPRESA.
//
//   PACIENTE → ve SOLO su propio expediente (ligado por el personal) y
//              puede llenar SU encuesta. Nunca ve a otros pacientes.
//   EMPRESA  → ve los resultados de los empleados de SU empresa. Nunca ve
//              empleados de otras empresas.
//
// La seguridad clave está en que cada consulta se acota por el patientId
// (ligado a la cuenta) o el companyId (de la cuenta), tomados del token —
// nunca de parámetros que mande el cliente.
// =============================================================

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';
import { authRequired, requireRole, AuthRequest } from '../middleware/auth';
import { getCloudStorageProvider } from '../services/storage';
import { logAudit } from '../services/audit';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

// Envía el archivo de un documento al cliente (desde la nube o el disco local),
// con la verificación de propiedad ya hecha por quien llama.
async function streamDocument(doc: { fileName: string; fileUrl: string; cloudFileId: string | null }, res: any) {
  const provider = getCloudStorageProvider();
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  if (doc.cloudFileId && provider) {
    const bytes = await provider.downloadFile(doc.cloudFileId);
    return res.send(Buffer.from(bytes));
  }
  // Respaldo en disco local: fileUrl viene como /uploads/xxx
  const localPath = path.join(UPLOAD_DIR, doc.fileUrl.replace(/^\/uploads\//, ''));
  if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'Archivo no disponible' });
  return res.send(fs.readFileSync(localPath));
}

// =============================================================
// PORTAL DEL PACIENTE
// =============================================================
const patientPortal = Router();
patientPortal.use(authRequired, requireRole('PACIENTE'));

// Devuelve el patientId ligado a la cuenta (o null si el personal aún no lo ligó)
async function linkedPatientId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { patientId: true } });
  return u?.patientId ?? null;
}

// Mapea el payload de la encuesta a los campos de PatientSurvey (compartido por
// crear y editar). Mismo mapeo que routes/surveys.ts.
function buildSurveyData(d: any) {
  return {
    empresa: d.empresa, tipoExamen: d.tipoExamen, otroTipo: d.otroTipo, actividades: d.actividades,
    nombre: d.nombre, edad: d.edad ? parseInt(d.edad) : null, tipoSangre: d.tipoSangre,
    puestoDeTrabajo: d.puestoDeTrabajo, celular: d.celular, nss: d.nss,
    fechaNacimiento: d.fechaNacimiento, escolaridad: d.escolaridad, estadoCivil: d.estadoCivil,
    lugarNacimiento: d.lugarNacimiento, correo: d.correo,
    calle: d.calle, numero: d.numero, colonia: d.colonia, municipio: d.municipio, cp: d.cp,
    practicaDeporte: d.practicaDeporte ?? null, cualDeporte: d.cualDeporte,
    frecuenciaDeporte: d.frecuenciaDeporte, horasDeporte: d.horasDeporte,
    habitosAlimenticios: d.habitosAlimenticios, comidasDia: d.comidasDia,
    consumeFrutasVerduras: d.consumeFrutasVerduras, aguaDia: d.aguaDia,
    calidadSueno: d.calidadSueno, horasSueno: d.horasSueno, especifiqueSueno: d.especifiqueSueno,
    fuma: d.fuma, edadInicioFuma: d.edadInicioFuma, anosFumando: d.anosFumando, cigarrosDia: d.cigarrosDia,
    consumeAlcohol: d.consumeAlcohol ?? null, tipoBebida: d.tipoBebida,
    cantidadBebidas: d.cantidadBebidas, frecuenciaAlcohol: d.frecuenciaAlcohol,
    consumeDrogas: d.consumeDrogas, cualDroga: d.cualDroga, frecuenciaDroga: d.frecuenciaDroga,
    tiempoDroga: d.tiempoDroga, ultimaVezDroga: d.ultimaVezDroga,
    esquemaVacunacion: d.esquemaVacunacion ?? null, dosisAnticovid: d.dosisAnticovid,
    marcaVacuna: d.marcaVacuna, tieneTatuajes: d.tieneTatuajes ?? null,
    ultimoTatuaje: d.ultimoTatuaje, usaAudifonos: d.usaAudifonos ?? null,
    antecedentesFamiliares: d.antecedentesFamiliares, edadInicioLaboral: d.edadInicioLaboral,
    trabajoMinas: d.trabajoMinas, tiempoMinas: d.tiempoMinas, exposiciones: d.exposiciones,
    historialEmpleos: d.historialEmpleos, antecedentesPatologicos: d.antecedentesPatologicos,
  };
}

// GET /api/portal/me — estado de la cuenta del paciente
patientPortal.get('/me', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, fullName: true, email: true, patient: { select: { id: true, fullName: true } } },
  });
  res.json({ ...user, linked: !!user?.patient });
});

// GET /api/portal/results — expediente propio (documentos + encuestas)
patientPortal.get('/results', async (req: AuthRequest, res) => {
  const pid = await linkedPatientId(req.user!.id);
  if (!pid) return res.json({ linked: false, documents: [], surveys: [] });

  const [documents, surveys] = await Promise.all([
    prisma.document.findMany({
      // Solo lo que un DOCTOR liberó expresamente al paciente (patientVisible).
      where: { patientId: pid, patientVisible: true },
      select: { id: true, type: true, fileName: true, visitDate: true, cloudWebUrl: true, cloudFileId: true },
      orderBy: { visitDate: 'desc' },
    }),
    prisma.patientSurvey.findMany({
      where: { patientId: pid },
      select: { id: true, tipoExamen: true, empresa: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  res.json({ linked: true, documents, surveys });
});

// GET /api/portal/results/:documentId/download — descarga un documento propio
patientPortal.get('/results/:documentId/download', async (req: AuthRequest, res) => {
  const pid = await linkedPatientId(req.user!.id);
  if (!pid) return res.status(403).json({ error: 'Cuenta sin expediente ligado' });
  const doc = await prisma.document.findUnique({ where: { id: req.params.documentId } });
  // Propiedad + liberación: debe ser de SU expediente Y estar liberado por el
  // médico (patientVisible). Si no, se responde 404 (no se revela que existe).
  if (!doc || doc.patientId !== pid || !doc.patientVisible) return res.status(404).json({ error: 'Documento no encontrado' });
  logAudit(req, 'DOCUMENT_DOWNLOAD', { targetType: 'Document', targetId: doc.id, patientId: doc.patientId, detail: `portal paciente: ${doc.fileName}` });
  await streamDocument(doc, res);
});

// POST /api/portal/survey — guarda únicamente los datos de la encuesta en
// PostgreSQL. La generación del PDF y del expediente en nube es una acción
// posterior del personal desde el módulo Documentos.
patientPortal.post('/survey', async (req: AuthRequest, res) => {
  const d = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: req.user!.id },
        select: { patientId: true, fullName: true, email: true },
      });
      if (!account) throw new Error('Cuenta de paciente no encontrada');

      const company = d.empresa
        ? await tx.company.findFirst({
            where: { name: { equals: d.empresa, mode: 'insensitive' } },
            select: { id: true },
          })
        : null;

      let patientId = account.patientId;
      if (!patientId) {
        const patient = await tx.patient.create({
          data: {
            fullName: d.nombre?.trim() || account.fullName,
            phone: d.celular || null,
            email: d.correo || account.email,
            nss: d.nss || null,
            birthDate: d.fechaNacimiento ? new Date(`${d.fechaNacimiento}T00:00:00`) : null,
            company: d.empresa || null,
            companyId: company?.id || null,
            photoUrl: d.photoUrl || null,
          },
        });

        // Liga automáticamente la cuenta con el paciente recién creado. El
        // update condicional evita dejar dos expedientes si hubiera doble envío.
        const linked = await tx.user.updateMany({
          where: { id: req.user!.id, patientId: null },
          data: { patientId: patient.id },
        });
        if (linked.count === 1) {
          patientId = patient.id;
        } else {
          await tx.patient.delete({ where: { id: patient.id } });
          patientId = (await tx.user.findUnique({
            where: { id: req.user!.id },
            select: { patientId: true },
          }))?.patientId ?? null;
        }
      }

      if (!patientId) throw new Error('No se pudo ligar la cuenta al paciente');

      await tx.patient.update({
        where: { id: patientId },
        data: {
          phone: d.celular || undefined,
          email: d.correo || undefined,
          nss: d.nss || undefined,
          company: d.empresa || undefined,
          companyId: d.empresa ? company?.id || null : undefined,
          photoUrl: d.photoUrl || undefined,
        },
      });
      const survey = await tx.patientSurvey.create({
        data: { patientId, ...buildSurveyData(d) },
      });
      return { surveyId: survey.id, patientId };
    });
    res.status(201).json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[portal/survey]', err);
    res.status(500).json({ error: 'No se pudo guardar la encuesta' });
  }
});

// GET /api/portal/patient/survey — la última encuesta del paciente (o null),
// para mostrarla en modo lectura y permitir editarla.
patientPortal.get('/survey', async (req: AuthRequest, res) => {
  const pid = await linkedPatientId(req.user!.id);
  if (!pid) return res.json(null);
  const survey = await prisma.patientSurvey.findFirst({
    where: { patientId: pid },
    orderBy: { createdAt: 'desc' },
  });
  res.json(survey);
});

// PUT /api/portal/patient/survey/:id — editar la propia encuesta. Verifica que
// la encuesta pertenezca al expediente ligado a ESTA cuenta.
patientPortal.put('/survey/:id', async (req: AuthRequest, res) => {
  const pid = await linkedPatientId(req.user!.id);
  if (!pid) return res.status(403).json({ error: 'Cuenta sin expediente ligado' });
  const existing = await prisma.patientSurvey.findUnique({ where: { id: req.params.id }, select: { patientId: true } });
  if (!existing || existing.patientId !== pid) return res.status(404).json({ error: 'Encuesta no encontrada' });
  const d = req.body;
  try {
    const company = d.empresa
      ? await prisma.company.findFirst({
          where: { name: { equals: d.empresa, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;
    await prisma.patient.update({
      where: { id: pid },
      data: {
        phone: d.celular || undefined,
        email: d.correo || undefined,
        nss: d.nss || undefined,
        company: d.empresa || undefined,
        companyId: d.empresa ? company?.id || null : undefined,
      },
    });
    const survey = await prisma.patientSurvey.update({ where: { id: req.params.id }, data: buildSurveyData(d) });
    res.json({ ok: true, surveyId: survey.id });
  } catch (err: any) {
    console.error('[portal/survey PUT]', err);
    res.status(500).json({ error: 'No se pudo actualizar la encuesta' });
  }
});

// =============================================================
// PORTAL DE LA EMPRESA
// =============================================================
const companyPortal = Router();
companyPortal.use(authRequired, requireRole('EMPRESA'));

async function accountCompanyId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  return u?.companyId ?? null;
}

// GET /api/portal/company — datos de la empresa + sus empleados con resultados
companyPortal.get('/', async (req: AuthRequest, res) => {
  const cid = await accountCompanyId(req.user!.id);
  if (!cid) return res.status(403).json({ error: 'Cuenta sin empresa ligada' });

  const company = await prisma.company.findUnique({ where: { id: cid }, select: { id: true, name: true } });
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { companyId: cid },
        { company: { equals: company.name, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, fullName: true, nss: true,
      documents: {
        where: { companyVisible: true },
        select: { id: true, type: true, fileName: true, visitDate: true },
        orderBy: { visitDate: 'desc' },
      },
    },
    orderBy: { fullName: 'asc' },
  });
  res.json({ company, patients });
});

// GET /api/portal/company/results/:documentId/download — descarga el resultado
// de un empleado, verificando que pertenezca a ESTA empresa.
companyPortal.get('/results/:documentId/download', async (req: AuthRequest, res) => {
  const cid = await accountCompanyId(req.user!.id);
  if (!cid) return res.status(403).json({ error: 'Cuenta sin empresa ligada' });
  const company = await prisma.company.findUnique({ where: { id: cid }, select: { name: true } });
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
  const doc = await prisma.document.findUnique({
    where: { id: req.params.documentId },
    include: { patient: { select: { companyId: true, company: true } } },
  });
  const legacyMatch = doc?.patient?.company?.trim().toLocaleLowerCase('es-MX') === company.name.trim().toLocaleLowerCase('es-MX');
  if (!doc || !doc.companyVisible || (doc.patient?.companyId !== cid && !legacyMatch)) {
    return res.status(404).json({ error: 'Documento no encontrado o no autorizado' });
  }
  logAudit(req, 'DOCUMENT_DOWNLOAD', { targetType: 'Document', targetId: doc.id, patientId: doc.patientId, detail: `portal empresa: ${doc.fileName}` });
  await streamDocument(doc, res);
});

// Montados en rutas distintas para que el middleware de rol de cada portal
// no intercepte al otro (un router montado en '/' correría para TODO).
router.use('/patient', patientPortal);
router.use('/company', companyPortal);

export default router;
