import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// POST /api/surveys — guardar encuesta y registrar/actualizar paciente
router.post('/', async (req: AuthRequest, res) => {
  const d = req.body;

  try {
    let patientId: string | null = d.patientId || null;

    // Si es paciente nuevo, crearlo con los datos de la encuesta
    if (!patientId && d.nombre) {
      const patient = await prisma.patient.create({
        data: {
          fullName: d.nombre,
          phone: d.celular || null,
          email: d.correo || null,
          nss: d.nss || null,
          birthDate: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
          gender: null,
          medicalNotes: null,
        },
      });
      patientId = patient.id;
    } else if (patientId) {
      // Actualizar datos básicos del paciente existente
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          phone: d.celular || undefined,
          email: d.correo || undefined,
          nss: d.nss || undefined,
        },
      });
    }

    const survey = await prisma.patientSurvey.create({
      data: {
        patientId,
        empresa: d.empresa,
        tipoExamen: d.tipoExamen,
        otroTipo: d.otroTipo,
        actividades: d.actividades,
        nombre: d.nombre,
        edad: d.edad ? parseInt(d.edad) : null,
        tipoSangre: d.tipoSangre,
        puestoDeTrabajo: d.puestoDeTrabajo,
        celular: d.celular,
        nss: d.nss,
        fechaNacimiento: d.fechaNacimiento,
        escolaridad: d.escolaridad,
        estadoCivil: d.estadoCivil,
        lugarNacimiento: d.lugarNacimiento,
        correo: d.correo,
        calle: d.calle,
        numero: d.numero,
        colonia: d.colonia,
        municipio: d.municipio,
        cp: d.cp,
        practicaDeporte: d.practicaDeporte ?? null,
        cualDeporte: d.cualDeporte,
        horasDeporte: d.horasDeporte,
        habitosAlimenticios: d.habitosAlimenticios,
        calidadSueno: d.calidadSueno,
        especifiqueSueno: d.especifiqueSueno,
        fuma: d.fuma,
        edadInicioFuma: d.edadInicioFuma,
        anosFumando: d.anosFumando,
        cigarrosDia: d.cigarrosDia,
        consumeAlcohol: d.consumeAlcohol ?? null,
        tipoBebida: d.tipoBebida,
        cantidadBebidas: d.cantidadBebidas,
        frecuenciaAlcohol: d.frecuenciaAlcohol,
        consumeDrogas: d.consumeDrogas,
        cualDroga: d.cualDroga,
        frecuenciaDroga: d.frecuenciaDroga,
        tiempoDroga: d.tiempoDroga,
        ultimaVezDroga: d.ultimaVezDroga,
        esquemaVacunacion: d.esquemaVacunacion ?? null,
        dosisAnticovid: d.dosisAnticovid,
        marcaVacuna: d.marcaVacuna,
        tieneTatuajes: d.tieneTatuajes ?? null,
        ultimoTatuaje: d.ultimoTatuaje,
        usaAudifonos: d.usaAudifonos ?? null,
        antecedentesFamiliares: d.antecedentesFamiliares,
        edadInicioLaboral: d.edadInicioLaboral,
        trabajoMinas: d.trabajoMinas,
        exposiciones: d.exposiciones,
        historialEmpleos: d.historialEmpleos,
        antecedentesPatologicos: d.antecedentesPatologicos,
      },
    });

    res.status(201).json({ ok: true, surveyId: survey.id, patientId });
  } catch (err: any) {
    console.error('[surveys]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/surveys — listar encuestas (admin/doctor), filtrable por patientId
router.get('/', async (req: AuthRequest, res) => {
  const { patientId } = req.query as any;
  const surveys = await prisma.patientSurvey.findMany({
    where: patientId ? { patientId } : undefined,
    include: { patient: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(surveys);
});

// PUT /api/surveys/:id
router.put('/:id', async (req, res) => {
  const d = req.body;
  try {
    const survey = await prisma.patientSurvey.update({
      where: { id: req.params.id },
      data: {
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
    res.json(survey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/surveys/:id
router.get('/:id', async (req, res) => {
  const survey = await prisma.patientSurvey.findUnique({
    where: { id: req.params.id },
    include: { patient: true },
  });
  if (!survey) return res.status(404).json({ error: 'No encontrada' });
  res.json(survey);
});

export default router;
