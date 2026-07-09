import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

const MASTER_EMAIL = 'master@mediworkzac.com';

async function main() {
  const password = "admin123";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: MASTER_EMAIL } });
  if (existing) {
    await prisma.user.update({ where: { email: MASTER_EMAIL }, data: { passwordHash } });
    console.log('Contraseña de la cuenta Master actualizada.');
    console.log(`Email:    ${MASTER_EMAIL}`);
    console.log(`Password: ${password}`);
    return;
  }

  await prisma.user.create({
    data: { email: MASTER_EMAIL, fullName: 'Master', role: 'MASTER', passwordHash },
  });

  console.log('Cuenta Master creada.');
  console.log(`Email:    ${MASTER_EMAIL}`);
  console.log(`Password: ${password}`);
  console.log('Guárdala ahora: no se volverá a mostrar. Cámbiala desde Perfil tras el primer login.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
