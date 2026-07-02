import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NUEVAS = [
  { name: 'ETIQUETA ROJA',     armazon: 350, hxar: 500 },
  { name: 'ETIQUETA VERDE',    armazon: 500, hxar: 700 },
  { name: 'ETIQUETA AMARILLA', armazon: 450, hxar: 650 },
];

function toSku(name: string, tipo: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${tipo}-${slug}`;
}

async function main() {
  const cat = await prisma.category.findFirst({ where: { name: 'Armazones' } });
  if (!cat) { console.error('Categoría Armazones no encontrada'); return; }

  for (const b of NUEVAS) {
    // Armazón
    await prisma.product.upsert({
      where: { sku: toSku(b.name, 'ARM') },
      update: { salePrice: b.armazon },
      create: {
        sku:        toSku(b.name, 'ARM'),
        name:       b.name,
        categoryId: cat.id,
        brand:      b.name,
        salePrice:  b.armazon,
        costPrice:  0,
        stock:      9999,
        minStock:   0,
        attributes: { tipo: 'armazon' },
      },
    });

    // HX AR
    await prisma.product.upsert({
      where: { sku: toSku(b.name, 'HXAR') },
      update: { salePrice: b.hxar },
      create: {
        sku:        toSku(b.name, 'HXAR'),
        name:       `${b.name} HX AR`,
        categoryId: cat.id,
        brand:      b.name,
        salePrice:  b.hxar,
        costPrice:  0,
        stock:      9999,
        minStock:   0,
        attributes: { tipo: 'hxar' },
      },
    });

    console.log(`✓ ${b.name}`);
  }

  console.log('Listo — 6 productos agregados.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
