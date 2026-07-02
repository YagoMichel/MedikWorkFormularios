import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SERVICIOS = [
  // grupo, sku, nombre
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-001', 'Revisión Médica General'],
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-002', 'Prueba Ruffier (Cardiovascular)'],
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-003', 'Óptica y Salud Visual'],
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-004', 'Audiometría'],
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-005', 'Espirometría'],
  ['Exámenes Médicos y Diagnóstico', 'SRV-MED-006', 'Imagenología (Rayos X)'],
  ['Laboratorio Clínico y Seguridad', 'SRV-LAB-001', 'Biometría Hemática'],
  ['Laboratorio Clínico y Seguridad', 'SRV-LAB-002', 'Química Sanguínea'],
  ['Laboratorio Clínico y Seguridad', 'SRV-LAB-003', 'Examen de Orina'],
  ['Laboratorio Clínico y Seguridad', 'SRV-LAB-004', 'Antidoping'],
  ['Servicios Complementarios',       'SRV-COM-001', 'Unidad Móvil (Servicio en Campo)'],
  ['Servicios Complementarios',       'SRV-COM-002', 'Ultrasonido'],
  ['Servicios Complementarios',       'SRV-COM-003', 'Asesoría Nutricional'],
  ['Servicios Complementarios',       'SRV-COM-004', 'Venta de Lentes'],
] as const;

async function main() {
  const cat = await prisma.category.upsert({
    where: { name: 'Servicios' },
    update: {},
    create: { name: 'Servicios' },
  });

  for (const [grupo, sku, nombre] of SERVICIOS) {
    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        sku,
        name: nombre,
        brand: grupo,          // brand reutilizado como agrupador de servicio
        categoryId: cat.id,
        costPrice: 0,
        salePrice: 0,          // el admin ajusta el precio desde Inventario
        stock: 9999,
        minStock: 0,
        active: true,
      },
    });
    console.log(`  + ${nombre}`);
  }
  console.log('✅ Servicios cargados:', SERVICIOS.length);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
