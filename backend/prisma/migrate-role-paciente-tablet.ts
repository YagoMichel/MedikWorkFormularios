// =============================================================
// Migración one-off: renombra el rol PACIENTE → PACIENTE_TABLET
// en una base de datos existente.
//
// ORDEN DE USO (importa — prisma db push no puede renombrar un
// valor de enum que aún tiene filas usándolo):
//   1. npm run migrate:role-tablet   (este script)
//   2. npx prisma db push            (elimina el valor viejo del enum)
//
// En una BD nueva (sin usuarios PACIENTE) no hace falta: db push basta.
// =============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Agrega el valor nuevo al enum (no-op si ya existe).
  //    ALTER TYPE ... ADD VALUE no puede ir en transacción — va solo.
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PACIENTE_TABLET'`);

  // 2. Mueve los usuarios existentes al valor nuevo.
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "User" SET role = 'PACIENTE_TABLET' WHERE role = 'PACIENTE'`
  );
  console.log(`Usuarios actualizados PACIENTE → PACIENTE_TABLET: ${updated}`);
  // Nota: 'PACIENTE' NO se retira del enum — ahora se reutiliza para el portal
  // del paciente. Este script solo mueve a los usuarios de la tablet (kiosco)
  // que antes usaban 'PACIENTE' hacia 'PACIENTE_TABLET'.
  console.log('Ahora ejecuta: npx prisma db push  (agrega EMPRESA y deja PACIENTE para el portal)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
