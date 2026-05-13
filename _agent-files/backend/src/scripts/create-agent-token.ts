// backend/src/scripts/create-agent-token.ts
//
// Crea (o reusa) el usuario de servicio "agent@mediwork.local" y emite
// un JWT de larga duracion (1 ano) que se pega como credencial Header Auth en n8n.
//
// Uso: docker exec -it mediwork-backend npx tsx src/scripts/create-agent-token.ts
// O bien:  npm run agent:token  (despues de agregar el script en package.json)

import 'dotenv/config';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SERVICE_EMAIL = 'agent@mediwork.local';

async function main() {
  let user = await prisma.user.findUnique({ where: { email: SERVICE_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: SERVICE_EMAIL,
        // Password aleatoria, no se usa para login (el agente solo usa JWT)
        passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
        fullName: 'n8n Agent (servicio)',
        role: 'AGENT',
        active: true,
      },
    });
    console.log('[ok] Usuario AGENT creado:', user.email);
  } else {
    console.log('[ok] Usuario AGENT ya existia:', user.email);
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: '365d' }
  );

  console.log('\n========================================');
  console.log('JWT de servicio para n8n (valido 1 ano)');
  console.log('========================================');
  console.log(token);
  console.log('========================================');
  console.log('\nConfiguralo en n8n como credencial Header Auth:');
  console.log('  Name:  Authorization');
  console.log('  Value: Bearer <pega-el-token-arriba>');
  console.log('\nNota: si rotas JWT_SECRET, debes regenerar este token.\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
