import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LENTES = [
  { name: 'POLI W',              bajas: 1300, altas: 1450, procesado: 2150 },
  { name: 'POLI AR',             bajas: 1450, altas: 1700, procesado: 2400 },
  { name: 'POLI FOTO AR',        bajas: 1800, altas: 2350, procesado: 3000 },
  { name: 'POLI BLUE RAY',       bajas: 1600, altas: null, procesado: 3100 },
  { name: 'POLI BLUE RAY FOTO',  bajas: 2550, altas: null, procesado: 3650 },
  { name: 'POLI FLAT W',         bajas: null, altas: null, procesado: 2600 },
  { name: 'POLI FLAR FOTO',      bajas: null, altas: null, procesado: 3700 },
  { name: 'POLI PROGRESIVO W',   bajas: null, altas: null, procesado: 2950 },
  { name: 'POLI PROGRESIVO FOTO',bajas: null, altas: null, procesado: 3950 },
];

function toSku(name: string, tipo: string) {
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${tipo}-${slug}`;
}

async function main() {
  let cat = await prisma.category.findFirst({ where: { name: 'Lentes de Seguridad' } });
  if (!cat) cat = await prisma.category.create({ data: { name: 'Lentes de Seguridad' } });

  for (const l of LENTES) {
    for (const [tipo, precio] of [['bajas', l.bajas], ['altas', l.altas], ['procesado', l.procesado]] as const) {
      if (precio === null) continue;
      const sku = toSku(l.name, tipo.toUpperCase());
      await prisma.product.upsert({
        where: { sku },
        update: { salePrice: precio },
        create: {
          sku,
          name: `${l.name} ${tipo.toUpperCase()}`,
          categoryId: cat.id,
          brand: l.name,
          salePrice: precio,
          costPrice: 0,
          stock: 9999,
          minStock: 0,
          attributes: { tipo, grupo: 'lente-seguridad' },
        },
      });
    }
    console.log(`✓ ${l.name}`);
  }
  console.log('Listo.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
