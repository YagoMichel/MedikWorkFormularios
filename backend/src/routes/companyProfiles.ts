// =============================================================
// ARCHIVO: src/routes/companyProfiles.ts
// DESCRIPCION: Perfiles de empresa (checklist de estudios requeridos por
//              puesto/perfil, ej. Sandvik → "Técnico plomo" → Laboratorio,
//              Radiografía, Ruffier, ...). Datos importados de PERFILES.xlsx
//              vía prisma/seed-perfiles.ts — esta ruta solo lee.
// =============================================================
import { Router } from 'express';
import { prisma } from '../prisma';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

// GET /api/company-profiles?companyId=X — perfiles (opcionalmente de una sola
// empresa), con sus items en orden y el nombre de la empresa para agrupar
router.get('/', async (req, res) => {
  const { companyId } = req.query as { companyId?: string };
  const where: any = {};
  if (companyId) where.companyId = companyId;

  const profiles = await prisma.companyProfile.findMany({
    where,
    include: {
      items: { orderBy: { order: 'asc' } },
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(profiles);
});

export default router;
