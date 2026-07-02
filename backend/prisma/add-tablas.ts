import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function slug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function getCat(name: string) {
  let c = await prisma.category.findFirst({ where: { name } });
  if (!c) c = await prisma.category.create({ data: { name } });
  return c;
}

async function upsert(opts: {
  sku: string; name: string; categoryId: string; brand: string;
  price: number; grupo: string; tipo?: string;
}) {
  const { sku, name, categoryId, brand, price, grupo, tipo } = opts;
  await prisma.product.upsert({
    where: { sku },
    update: { salePrice: price, name, brand, categoryId, attributes: { grupo, ...(tipo ? { tipo } : {}) } },
    create: {
      sku, name, categoryId, brand,
      salePrice: price, costPrice: 0, stock: 9999, minStock: 0,
      attributes: { grupo, ...(tipo ? { tipo } : {}) },
    },
  });
}

async function main() {
  // ── Tabla HX (Micas HX) — BLANCO / ANTIRREFLEJANTE / FOTO AR
  const catHx = await getCat('Micas HX');
  const HX = [
    { brand: 'HX BAJAS',     blanco: 200, antirreflejante: 500,  foto_ar: 700  },
    { brand: 'HX ALTAS',     blanco: 350, antirreflejante: 650,  foto_ar: 1300 },
    { brand: 'HX PROCEDADO', blanco: 800, antirreflejante: 1000, foto_ar: 1600 },
  ];
  for (const r of HX) {
    await upsert({ sku: `MICAHX-BLAN-${slug(r.brand)}`, name: `${r.brand} BLANCO`,         categoryId: catHx.id, brand: r.brand, price: r.blanco,         grupo: 'mica-hx', tipo: 'blanco' });
    await upsert({ sku: `MICAHX-AR-${slug(r.brand)}`,   name: `${r.brand} ANTIRREFLEJANTE`,categoryId: catHx.id, brand: r.brand, price: r.antirreflejante,grupo: 'mica-hx', tipo: 'antirreflejante' });
    await upsert({ sku: `MICAHX-FAR-${slug(r.brand)}`,  name: `${r.brand} FOTO AR`,        categoryId: catHx.id, brand: r.brand, price: r.foto_ar,        grupo: 'mica-hx', tipo: 'foto-ar' });
    console.log(`✓ ${r.brand}`);
  }

  // ── Tabla Policarbonato — mismas columnas
  const catPoli = await getCat('Micas Policarbonato');
  const POLI = [
    { brand: 'Policarbonato bajas',     blanco: 500,  antirreflejante: 750,  foto_ar: 1200 },
    { brand: 'Policarbonato altas',     blanco: 800,  antirreflejante: 1100, foto_ar: 1700 },
    { brand: 'Policarbonato procesado', blanco: 1500, antirreflejante: 1700, foto_ar: 2500 },
  ];
  for (const r of POLI) {
    await upsert({ sku: `POLI-BLAN-${slug(r.brand)}`, name: `${r.brand} BLANCO`,          categoryId: catPoli.id, brand: r.brand, price: r.blanco,          grupo: 'policarbonato', tipo: 'blanco' });
    await upsert({ sku: `POLI-AR-${slug(r.brand)}`,   name: `${r.brand} ANTIRREFLEJANTE`, categoryId: catPoli.id, brand: r.brand, price: r.antirreflejante, grupo: 'policarbonato', tipo: 'antirreflejante' });
    await upsert({ sku: `POLI-FAR-${slug(r.brand)}`,  name: `${r.brand} FOTO AR`,         categoryId: catPoli.id, brand: r.brand, price: r.foto_ar,         grupo: 'policarbonato', tipo: 'foto-ar' });
    console.log(`✓ ${r.brand}`);
  }

  // ── Tratamientos solares fijos (lista simple)
  const catTrat = await getCat('Tratamientos Solares');
  const TRAT = [
    { name: 'TINTE',                   price: 400 },
    { name: 'ESPEJEADO POLARIZADO',    price: 2000 },
    { name: 'POLARIZADO NEGRO Y CAFE', price: 1800 },
  ];
  for (const t of TRAT) {
    await upsert({ sku: `TRAT-${slug(t.name)}`, name: t.name, categoryId: catTrat.id, brand: t.name, price: t.price, grupo: 'tratamiento-solar' });
    console.log(`✓ ${t.name}`);
  }

  // ── Biseles
  const catBis = await getCat('Biseles');
  const BIS = [
    { name: 'Bisel Completo',    price: 50 },
    { name: 'Bisel Ranurado',    price: 65 },
    { name: 'Bisel Tres piezas', price: 150 },
  ];
  for (const b of BIS) {
    await upsert({ sku: `BIS-${slug(b.name)}`, name: b.name, categoryId: catBis.id, brand: b.name, price: b.price, grupo: 'bisel' });
    console.log(`✓ ${b.name}`);
  }

  // ── Blue Ray — 4 columnas
  const catBr = await getCat('Blue Ray');
  const BR = [
    { brand: 'HI INDEX',     terminado: 800,  procesado: 1400, foto_ter: 1200, foto_proc: 1800 },
    { brand: 'POLICARBONATO',terminado: 1100, procesado: 2100, foto_ter: 1800, foto_proc: 2800 },
    { brand: 'HI INDEX MR7', terminado: null, procesado: 2500, foto_ter: null, foto_proc: null },
  ];
  for (const r of BR) {
    const cols: [string, number | null, string][] = [
      ['terminado', r.terminado, 'TER'],
      ['procesado', r.procesado, 'PROC'],
      ['foto-ter',  r.foto_ter,  'FTER'],
      ['foto-proc', r.foto_proc, 'FPROC'],
    ];
    for (const [tipo, price, code] of cols) {
      if (price === null) continue;
      await upsert({
        sku: `BR-${code}-${slug(r.brand)}`,
        name: `${r.brand} BLUE RAY ${tipo.toUpperCase()}`,
        categoryId: catBr.id, brand: r.brand, price,
        grupo: 'blue-ray', tipo,
      });
    }
    console.log(`✓ ${r.brand}`);
  }

  // ── Terminada en HI INDEX — 5 columnas
  const catHi = await getCat('Terminada HI INDEX');
  const HI = [
    { brand: 'FLAT',       w: 400, ar: 650, foto_ar: 1100, blue_ray: 1400, blue_ray_foto: null },
    { brand: 'BLEND',      w: 500, ar: 700, foto_ar: 1200, blue_ray: 1500, blue_ray_foto: null },
    { brand: 'PROGRESIVO', w: 800, ar: 950, foto_ar: 1450, blue_ray: 1700, blue_ray_foto: 2200 },
  ];
  for (const r of HI) {
    const cols: [string, number | null, string][] = [
      ['w',             r.w,             'W'],
      ['ar',            r.ar,            'AR'],
      ['foto-ar',       r.foto_ar,       'FAR'],
      ['blue-ray',      r.blue_ray,      'BR'],
      ['blue-ray-foto', r.blue_ray_foto, 'BRF'],
    ];
    for (const [tipo, price, code] of cols) {
      if (price === null) continue;
      await upsert({
        sku: `HI-${code}-${slug(r.brand)}`,
        name: `${r.brand} ${tipo.toUpperCase().replace(/-/g, ' ')}`,
        categoryId: catHi.id, brand: r.brand, price,
        grupo: 'hi-index-terminada', tipo,
      });
    }
    console.log(`✓ ${r.brand}`);
  }

  const catProc = await getCat('Micas Procesadas');
  const PROC = [
    {
      brand: 'FLAT',
      values: [
        ['W HX', 600, 'W-HX'],
        ['W POLI', 1800, 'W-POLI'],
        ['AR HX', 750, 'AR-HX'],
        ['AR POLI', 2000, 'AR-POLI'],
        ['FOTO AR HX', 1400, 'FAR-HX'],
        ['FOTO AR POLI', 3100, 'FAR-POLI'],
        ['BLUE RAY HX', 1600, 'BR-HX'],
        ['BLUE RAY FOTO HX', 1800, 'BRF-HX'],
      ] as [string, number, string][],
    },
    {
      brand: 'BLEND',
      values: [
        ['W HX', 650, 'W-HX'],
        ['W POLI', 2200, 'W-POLI'],
        ['AR HX', 800, 'AR-HX'],
        ['FOTO AR HX', 1500, 'FAR-HX'],
        ['BLUE RAY HX', 1500, 'BR-HX'],
        ['BLUE RAY FOTO HX', 1900, 'BRF-HX'],
      ] as [string, number, string][],
    },
    {
      brand: 'PROGRESIVO',
      values: [
        ['W HX', 900, 'W-HX'],
        ['W POLI', 2100, 'W-POLI'],
        ['AR HX', 1100, 'AR-HX'],
        ['AR POLI', 2400, 'AR-POLI'],
        ['FOTO AR HX', 1600, 'FAR-HX'],
        ['FOTO AR POLI', 3200, 'FAR-POLI'],
        ['BLUE RAY HX', 1600, 'BR-HX'],
        ['BLUE RAY POLI', 3000, 'BR-POLI'],
        ['BLUE RAY FOTO HX', 2100, 'BRF-HX'],
        ['BLUE RAY FOTO POLI', 3500, 'BRF-POLI'],
      ] as [string, number, string][],
    },
  ];
  for (const row of PROC) {
    for (const [tipo, price, code] of row.values) {
      await upsert({
        sku: `PROC-${code}-${slug(row.brand)}`,
        name: `${row.brand} PROCESADA ${tipo}`,
        categoryId: catProc.id,
        brand: row.brand,
        price,
        grupo: 'procesada',
        tipo: tipo.toLowerCase().replace(/\s+/g, '-'),
      });
    }
    console.log(`✓ ${row.brand} PROCESADA`);
  }

  console.log('\nListo.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
