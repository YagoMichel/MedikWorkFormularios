import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { patientId } = req.query as any;
  if (!patientId) return res.status(400).json({ error: 'patientId requerido' });
  const exams = await prisma.medicalExam.findMany({
    where: { patientId },
    orderBy: { date: 'desc' },
  });
  res.json(exams);
});

router.get('/:id', async (req, res) => {
  const exam = await prisma.medicalExam.findUnique({ where: { id: req.params.id } });
  if (!exam) return res.status(404).json({ error: 'No encontrado' });
  res.json(exam);
});

router.post('/', async (req, res) => {
  const { patientId, date, ...rest } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId requerido' });
  const exam = await prisma.medicalExam.create({
    data: { patientId, date: date ? new Date(date) : new Date(), ...rest },
  });
  res.status(201).json(exam);
});

router.put('/:id', async (req, res) => {
  const { patientId, date, ...rest } = req.body;
  const exam = await prisma.medicalExam.update({
    where: { id: req.params.id },
    data: { ...rest },
  });
  res.json(exam);
});

export default router;
