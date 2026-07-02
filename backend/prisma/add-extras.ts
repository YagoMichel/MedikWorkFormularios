import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slug(s: string) {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getCat(name: string) {
  let c = await prisma.category.findFirst({ where: { name } });
  if (!c) c = await prisma.category.create({ data: { name } });
  return c;
}

async function main() {
  const cat = await getCat('Accesorios');
  const accesorios = [
    { name: 'ESTUCHE DURO', price: 40 },
    { name: 'ESTUCHE BLANDO', price: 15 },
    { name: 'ESTUCHE DE CIERRE', price: 50 },
    { name: 'PLAQUETAS', price: 50 },
    { name: 'TORNILLO', price: 20 },
    { name: 'MICROFIBRA', price: 10 },
    { name: 'MICROFIBRA PREMIUM', price: 15 },
    { name: 'SOLUCION', price: 30 },
    { name: 'CORREAS', price: 20 },
    { name: 'SUJETADOR/CORREA', price: 80 },
  ];

  for (const item of accesorios) {
    await prisma.product.upsert({
      where: { sku: `ACC-${slug(item.name)}` },
      update: {
        name: item.name,
        brand: item.name,
        categoryId: cat.id,
        salePrice: item.price,
        active: true,
        attributes: { tipo: 'accesorio', grupo: 'accesorio' },
      },
      create: {
        sku: `ACC-${slug(item.name)}`,
        name: item.name,
        categoryId: cat.id,
        brand: item.name,
        salePrice: item.price,
        costPrice: 0,
        stock: 9999,
        minStock: 0,
        attributes: { tipo: 'accesorio', grupo: 'accesorio' },
      },
    });
    console.log(`✓ ${item.name}`);
  }

  console.log('\nListo.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
