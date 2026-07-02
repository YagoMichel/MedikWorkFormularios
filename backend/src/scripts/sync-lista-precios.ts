import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ProductDef = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  attributes: Record<string, string>;
};

const products: ProductDef[] = [];

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function add(product: Omit<ProductDef, 'sku'> & { sku?: string }) {
  products.push({
    ...product,
    sku: product.sku ?? `${slug(product.category)}-${slug(product.name)}`,
  });
}

function addArmazon(name: string, armazon: number, hxar: number | null, hxarNote?: string) {
  add({
    sku: `ARM-${slug(name).slice(0, 30)}`,
    name,
    category: 'Armazones',
    brand: name,
    price: armazon,
    attributes: { tipo: 'armazon', ...(hxarNote ? { hxarNote } : {}) },
  });
  if (hxar !== null) {
    add({
      sku: `HXAR-${slug(name).slice(0, 30)}`,
      name: `${name} HX AR`,
      category: 'Armazones',
      brand: name,
      price: hxar,
      attributes: { tipo: 'hxar' },
    });
  }
}

function addMatrix(category: string, brand: string, label: string, price: number, grupo: string, tipo: string, skuPrefix: string) {
  add({
    sku: `${skuPrefix}-${slug(tipo)}-${slug(brand)}`,
    name: `${brand} ${label}`,
    category,
    brand,
    price,
    attributes: { grupo, tipo },
  });
}

([
  ['Marina', 1100, 1450],
  ['Marina Sobrepuesto', 1100, 1500],
  ['Owen', 1100, 1400],
  ['CoolMen', 1100, 1400],
  ['Armazón de Seguridad', 800, 1000],
  ['Prince Noble', 1100, 1350],
  ['Olive People', 800, 1200],
  ['Brigth Visión Metálico', 1000, 1350],
  ['Bright Visión Acetato', 600, 1000],
  ['Good Kids', 800, 950],
  ['Nikitana', 800, 1250],
  ['Adan y Eva', 500, 500],
  ['Hendeli', 500, 500],
  ['CMARK', 650, 850],
  ['CAFTEN / CAFFSEN FLEXIBLE', 800, 1050],
  ['CAFTEN/ CAFFSEN', 700, 950],
  ['AIDEFU TITAMIUN', 1500, 1850],
  ['LOBENTON', 500, 650],
  ['ONOLA', 600, 800],
  ['YOE SP 5PIEZAS', 1000, 1500],
  ['YOE SP', 950, 1500],
  ['ROYALITY', 1100, 1400],
  ['MAVERICK', 1200, 1400],
  ['SEGURIDAD GOOGLE SPORT 5 PIEZAS', 1500, 2150],
  ['RETRO', 1100, 1600],
  ['Aidefu metálico', 1300, 1650],
  ['CAFFESEN METALICO', 1050, 1500],
  ['AIDEFU SP 5 PIEZAS', 1200, 1600],
  ['AIDEFU KIDS ACCESORIOS', 1300, 1550],
  ['AIDEFU KIDS', 900, 1250],
  ['Fantasía', 100, null],
  ['LENTE SOLAR 2', 250, null],
  ['LENTE SOLAR 3', 300, null],
] satisfies [string, number, number | null][])
  .forEach(([name, armazon, hxar]) => addArmazon(name, armazon, hxar));
addArmazon('Daisy', 800, null, 'NO SE PUEDE GRADUAR');
addArmazon('ETIQUETA ROJA', 350, 500);
addArmazon('ETIQUETA VERDE', 500, 700);
addArmazon('ETIQUETA AMARILLA', 450, 650);

([
  ['POLI W', 1300, 1450, 2150],
  ['POLI AR', 1450, 1700, 2400],
  ['POLI FOTO AR', 1800, 2350, 3000],
  ['POLI BLUE RAY', 1600, null, 3100],
  ['POLI BLUE RAY FOTO', 2550, null, 3650],
  ['POLI FLAT W', null, null, 2600],
  ['POLI FLAR FOTO', null, null, 3700],
  ['POLI PROGRESIVO W', null, null, 2950],
  ['POLI PROGRESIVO FOTO', null, null, 3950],
] satisfies [string, number | null, number | null, number | null][])
  .forEach(([brand, bajas, altas, procesado]) => {
    ([
      ['bajas', bajas],
      ['altas', altas],
      ['procesado', procesado],
    ] satisfies [string, number | null][]).forEach(([tipo, price]) => {
      if (price !== null) addMatrix('Lentes de Seguridad', brand, tipo.toUpperCase(), price, 'lente-seguridad', tipo, tipo.toUpperCase());
    });
  });

([
  ['HX BAJAS', 200, 500, 700, 'Micas HX', 'MICAHX'],
  ['HX ALTAS', 350, 650, 1300, 'Micas HX', 'MICAHX'],
  ['HX PROCEDADO', 800, 1000, 1600, 'Micas HX', 'MICAHX'],
  ['Policarbonato bajas', 500, 750, 1200, 'Micas Policarbonato', 'POLI'],
  ['Policarbonato altas', 800, 1100, 1700, 'Micas Policarbonato', 'POLI'],
  ['Policarbonato procesado', 1500, 1700, 2500, 'Micas Policarbonato', 'POLI'],
] satisfies [string, number, number, number, string, string][])
  .forEach(([brand, blanco, ar, fotoAr, category, prefix]) => {
    addMatrix(category, brand, 'BLANCO', blanco, category === 'Micas HX' ? 'mica-hx' : 'policarbonato', 'blanco', prefix);
    addMatrix(category, brand, 'ANTIRREFLEJANTE', ar, category === 'Micas HX' ? 'mica-hx' : 'policarbonato', 'antirreflejante', prefix);
    addMatrix(category, brand, 'FOTO AR', fotoAr, category === 'Micas HX' ? 'mica-hx' : 'policarbonato', 'foto-ar', prefix);
  });

[
  ['Bisel Completo', 50],
  ['Bisel Ranurado', 65],
  ['Bisel Tres piezas', 150],
].forEach(([name, price]) => add({ sku: `BIS-${slug(String(name))}`, name: String(name), category: 'Biseles', brand: String(name), price: Number(price), attributes: { grupo: 'bisel' } }));

[
  ['TINTE', 400],
  ['ESPEJEADO POLARIZADO', 2000],
  ['POLARIZADO NEGRO Y CAFE', 1800],
].forEach(([name, price]) => add({ sku: `TRAT-${slug(String(name))}`, name: String(name), category: 'Tratamientos Solares', brand: String(name), price: Number(price), attributes: { grupo: 'tratamiento-solar' } }));

[
  ['HI INDEX', [['terminado', 800], ['procesado', 1400], ['foto-ter', 1200], ['foto-proc', 1800]]],
  ['POLICARBONATO', [['terminado', 1100], ['procesado', 2100], ['foto-ter', 1800], ['foto-proc', 2800]]],
  ['HI INDEX MR7', [['procesado', 2500]]],
].forEach(([brand, values]) => {
  (values as [string, number][]).forEach(([tipo, price]) => addMatrix('Blue Ray', String(brand), `BLUE RAY ${tipo.toUpperCase()}`, price, 'blue-ray', tipo, 'BR'));
});

[
  ['FLAT', [['w', 400], ['ar', 650], ['foto-ar', 1100], ['blue-ray', 1400]]],
  ['BLEND', [['w', 500], ['ar', 700], ['foto-ar', 1200], ['blue-ray', 1500]]],
  ['PROGRESIVO', [['w', 800], ['ar', 950], ['foto-ar', 1450], ['blue-ray', 1700], ['blue-ray-foto', 2200]]],
].forEach(([brand, values]) => {
  (values as [string, number][]).forEach(([tipo, price]) => addMatrix('Terminada HI INDEX', String(brand), tipo.toUpperCase().replace(/-/g, ' '), price, 'hi-index-terminada', tipo, 'HI'));
});

[
  ['FLAT', [['W HX', 600], ['W POLI', 1800], ['AR HX', 750], ['AR POLI', 2000], ['FOTO AR HX', 1400], ['FOTO AR POLI', 3100], ['BLUE RAY HX', 1600], ['BLUE RAY FOTO HX', 1800]]],
  ['BLEND', [['W HX', 650], ['W POLI', 2200], ['AR HX', 800], ['FOTO AR HX', 1500], ['BLUE RAY HX', 1500], ['BLUE RAY FOTO HX', 1900]]],
  ['PROGRESIVO', [['W HX', 900], ['W POLI', 2100], ['AR HX', 1100], ['AR POLI', 2400], ['FOTO AR HX', 1600], ['FOTO AR POLI', 3200], ['BLUE RAY HX', 1600], ['BLUE RAY POLI', 3000], ['BLUE RAY FOTO HX', 2100], ['BLUE RAY FOTO POLI', 3500]]],
].forEach(([brand, values]) => {
  (values as [string, number][]).forEach(([tipo, price]) => addMatrix('Micas Procesadas', String(brand), `PROCESADA ${tipo}`, price, 'procesada', tipo.toLowerCase().replace(/\s+/g, '-'), 'PROC'));
});

[
  ['ESTUCHE DURO', 40],
  ['ESTUCHE BLANDO', 15],
  ['ESTUCHE DE CIERRE', 50],
  ['PLAQUETAS', 50],
  ['TORNILLO', 20],
  ['MICROFIBRA', 10],
  ['MICROFIBRA PREMIUM', 15],
  ['SOLUCION', 30],
  ['CORREAS', 20],
  ['SUJETADOR/CORREA', 80],
].forEach(([name, price]) => add({ sku: `ACC-${slug(String(name))}`, name: String(name), category: 'Accesorios', brand: String(name), price: Number(price), attributes: { tipo: 'accesorio', grupo: 'accesorio' } }));

async function getCategory(name: string) {
  return prisma.category.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function main() {
  const categoryByName = new Map<string, string>();
  const expectedSkus = products.map((product) => product.sku);

  for (const product of products) {
    let categoryId = categoryByName.get(product.category);
    if (!categoryId) {
      const category = await getCategory(product.category);
      categoryId = category.id;
      categoryByName.set(product.category, categoryId);
    }

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        categoryId,
        brand: product.brand,
        salePrice: product.price,
        costPrice: 0,
        stock: 9999,
        minStock: 0,
        active: true,
        attributes: product.attributes,
      },
      create: {
        sku: product.sku,
        name: product.name,
        categoryId,
        brand: product.brand,
        salePrice: product.price,
        costPrice: 0,
        stock: 9999,
        minStock: 0,
        active: true,
        attributes: product.attributes,
      },
    });
  }

  const deleted = await prisma.product.updateMany({
    where: { sku: { notIn: expectedSkus } },
    data: { active: false },
  });

  console.log(`Sincronizados: ${products.length}`);
  console.log(`Desactivados por no coincidir: ${deleted.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
