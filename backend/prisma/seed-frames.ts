import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRANDS = [
  'Marina', 'Marina Sp', 'Owen', 'Cool Men', 'Cool Men Sp',
  'Armazon de Seguridad', 'MAVERIK', 'Google Deportivo', 'Prince Noble',
  'Olive People', 'Brigth Vision Metalico', 'Bright Vision Pasta',
  'Good Kids', 'Nikitana', 'Adan y Eva', 'Hendeli', 'FANTASIA',
  'ETIQUETA ROJA', 'ETIQUETA AMARILLA', 'ETIQUETA VERDE', 'ETIQUETA AZUL',
  'YOE SP 5 Piezas', 'YOE SP', 'CMARK', 'CAFFDY', 'CAFTEN (CAFFSEN)',
  'INUSUAL', 'LOBENTON', 'ONOLA', 'VINCENT', 'ROYALITY', 'ROYALITY SP',
  'GOOGLE DAISY', 'solar 2', 'CAFTEN/ CAFFESEN FLEXIBLE',
  'CAFTEN/ CAFFESEN', 'aideffu titanium', 'LECTURA', 'aidefu metal',
  'aidefu kids accesorios', 'aidefu kids', 'solar 3', 'OWEN SP 5 PIEZAS',
  'AIDEFU SP 5 PIEZAS', 'CAFFESEN METALICO', 'AIDEFU GOOGLE SPORT',
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
   .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const category = await prisma.category.upsert({
    where: { name: 'Armazones' },
    update: {},
    create: { name: 'Armazones' },
  });

  for (const brand of BRANDS) {
    const sku = `ARM-${slug(brand)}`;
    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        sku,
        name: brand,
        brand,
        categoryId: category.id,
        costPrice: 0,
        salePrice: 0,
        stock: 0,
        minStock: 0,
      },
    });
  }
  console.log(`Cargadas ${BRANDS.length} marcas de armazones (datos en 0).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
