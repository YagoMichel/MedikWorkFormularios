import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRANDS = [
  { name: 'Marina',                          armazon: 1100, hxar: 1450 },
  { name: 'Marina Sobrepuesto',              armazon: 1100, hxar: 1500 },
  { name: 'Owen',                            armazon: 1100, hxar: 1400 },
  { name: 'CoolMen',                         armazon: 1100, hxar: 1400 },
  { name: 'Armazón de Seguridad',            armazon: 800,  hxar: 1000 },
  { name: 'Prince Noble',                    armazon: 1100, hxar: 1350 },
  { name: 'Olive People',                    armazon: 800,  hxar: 1200 },
  { name: 'Brigth Visión Metálico',          armazon: 1000, hxar: 1350 },
  { name: 'Bright Visión Acetato',           armazon: 600,  hxar: 1000 },
  { name: 'Good Kids',                       armazon: 800,  hxar: 950  },
  { name: 'Nikitana',                        armazon: 800,  hxar: 1250 },
  { name: 'Adan y Eva',                      armazon: 500,  hxar: 500  },
  { name: 'Hendeli',                         armazon: 500,  hxar: 500  },
  { name: 'CMARK',                           armazon: 650,  hxar: 850  },
  { name: 'CAFTEN / CAFFSEN FLEXIBLE',       armazon: 800,  hxar: 1050 },
  { name: 'CAFTEN/ CAFFSEN',                 armazon: 700,  hxar: 950  },
  { name: 'AIDEFU TITAMIUN',                 armazon: 1500, hxar: 1850 },
  { name: 'LOBENTON',                        armazon: 500,  hxar: 650  },
  { name: 'ONOLA',                           armazon: 600,  hxar: 800  },
  { name: 'YOE SP 5PIEZAS',                  armazon: 1000, hxar: 1500 },
  { name: 'YOE SP',                          armazon: 950,  hxar: 1500 },
  { name: 'ROYALITY',                        armazon: 1100, hxar: 1400 },
  { name: 'MAVERICK',                        armazon: 1200, hxar: 1400 },
  { name: 'SEGURIDAD GOOGLE SPORT 5 PIEZAS', armazon: 1500, hxar: 2150 },
  { name: 'RETRO',                           armazon: 1100, hxar: 1600 },
  { name: 'Aidefu Metálico',                 armazon: 1300, hxar: 1650 },
  { name: 'CAFFESEN METALICO',               armazon: 1050, hxar: 1500 },
  { name: 'AIDEFU SP 5 PIEZAS',             armazon: 1200, hxar: 1600 },
  { name: 'AIDEFU KIDS ACCESORIOS',          armazon: 1300, hxar: 1550 },
  { name: 'AIDEFU KIDS',                     armazon: 900,  hxar: 1250 },
  { name: 'Fantasía',                        armazon: 100,  hxar: null },
  { name: 'LENTE SOLAR 2',                   armazon: 250,  hxar: null },
  { name: 'LENTE SOLAR 3',                   armazon: 300,  hxar: null },
  { name: 'Daisy',                           armazon: 800,  hxar: null, hxarNote: 'NO SE PUEDE GRADUAR' },
];

function toSku(name: string, tipo: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${tipo}-${slug}`;
}

async function main() {
  console.log('Borrando inventario y servicios...');

  // Borrar en orden por FK
  await prisma.saleItem.deleteMany();
  await prisma.abono.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  console.log('Creando categoría Armazones...');
  const cat = await prisma.category.create({ data: { name: 'Armazones' } });

  console.log('Insertando productos...');
  let count = 0;
  for (const b of BRANDS) {
    // Producto Armazón
    await prisma.product.create({
      data: {
        sku:        toSku(b.name, 'ARM'),
        name:       b.name,
        categoryId: cat.id,
        brand:      b.name,
        salePrice:  b.armazon,
        costPrice:  0,
        stock:      9999,
        minStock:   0,
        attributes: { tipo: 'armazon', ...(b.hxarNote ? { hxarNote: b.hxarNote } : {}) },
      },
    });
    count++;

    // Producto HX AR (si tiene precio)
    if (b.hxar !== null) {
      await prisma.product.create({
        data: {
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
      count++;
    }
  }

  console.log(`Listo: ${count} productos creados en ${BRANDS.length} marcas.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
