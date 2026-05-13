import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 12);
  await prisma.user.upsert({
    where: { email: 'admin@clinica.com' },
    update: {},
    create: { email: 'admin@clinica.com', fullName: 'Administrador', role: 'ADMIN', passwordHash: await hash('Admin1234!') },
  });
  await prisma.user.upsert({
    where: { email: 'doctor1@clinica.com' },
    update: {},
    create: { email: 'doctor1@clinica.com', fullName: 'Dra. Ana Pérez', role: 'DOCTOR', passwordHash: await hash('Doctor1234!') },
  });
  console.log('Listo.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
