// =============================================================
// ARCHIVO: prisma/seed-perfiles.ts
// DESCRIPCION: Carga el checklist de estudios por empresa/perfil, importado
//              de PERFILES.xlsx (empresa → perfil → lista ordenada de
//              estudios requeridos, algunos con detalle de referencia).
//              Se corre una sola vez a mano: npx tsx prisma/seed-perfiles.ts
// =============================================================
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type Item = { label: string; detail?: string };
type Profile = { name: string; items: Item[] };
type CompanyData = { company: string; profiles: Profile[] };

// Normaliza nombres de perfil que en el Excel traían salto de línea o
// espacios de más (ej. "TECNICO...\r\nHOMBRE PERIODICO")
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const DATA: CompanyData[] = [
  {
    company: 'SANDVIK',
    profiles: [
      { name: 'TECNICO GENERAL HOMBRE', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Perfil de lipidos | - Quimica sanguinea 5 elementos | - Hemoglobina glucosidada | - EGO | -Perfil hepatico | - Perfil Renal | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 6 elementos' },
        { label: 'RIESGO CARDIOVASCULAR' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (CD)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'TECNICO GENERAL MUJER', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Perfil de lipidos | - Quimica sanguinea 5 elementos | - Hemoglobina glucosidada | - EGO | -Perfil hepatico | - Perfil Renal | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 6 elementos | - Preba de embarazo' },
        { label: 'RIESGO CARDIOVASCULAR' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (CD)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'TECNICO PLOMO', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Perfil de lipidos | - Quimica sanguinea 5 elementos | - Hemoglobina glucosidada | - EGO | -Perfil hepatico | - Perfil Renal | - grupo sanguineo y rh | - ADP 6 elementos | - Plomo en sangre' },
        { label: 'RIESGO CARDIOVASCULAR' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (CD)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'PERFIL ADM PERIODICO', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Perfil de lipidos | - Quimica sanguinea 4 elementos | - Hemoglobina glucosidada | - EGO | - ADP 6 elementos' },
        { label: 'RUFFIER' },
      ]},
      { name: 'PSICOMETRICO INGRESO', items: [
        { label: 'CUESTIONARIO NORDICO E INTERPRETACION' },
        { label: 'Test cleaver', detail: '- Test 16pf | - Test terman' },
      ]},
      { name: 'TECNICO JUANICIPIO HOMBRE PERIODICO', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 5 elementos | - EGO | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 6 elementos | - Antigeno prostatico especifico (despues de los 40 años)' },
        { label: 'RIESGO CARDIOVASCULAR' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (CD E IMPRESAS)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'CUESTIONARIO NORDICO' },
        { label: 'CUESTIONARIO DE HABITOS SALUDABLES' },
        { label: 'CUESTIONARIO DE TABAQUISMO' },
        { label: 'CUESTIONARIO DE ALCOHOLISMO' },
        { label: 'PSICOMETRICOS', detail: '- NOM 35 | - BURNOUT | - SOFI | - PERFIL DE ESTRES | - GOLDBERG' },
      ]},
      { name: 'TECNICO JUANICIPIO MUJER PERIODICO', items: [
        { label: 'HISTORIA CLINICA SANDVIK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 5 elementos | - EGO | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 6 elementos | - Papanicolau' },
        { label: 'RIESGO CARDIOVASCULAR' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (CD E IMPRESAS)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'Historia clinica laboral' },
        { label: 'CUESTIONARIO DE HABITOS SALUDABLES' },
        { label: 'CUESTIONARIO DE TABAQUISMO' },
        { label: 'CUESTIONARIO DE ALCOHOLISMO' },
        { label: 'PSICOMETRICOS', detail: '- NOM 35 | - BURNOUT | - SOFI | - PERFIL DE ESTRES | - GOLDBERG' },
      ]},
    ],
  },
  {
    company: 'GRUPO INDUSTRIAL CO',
    profiles: [
      { name: 'DIGITAL 2', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
    ],
  },
  {
    company: 'EPIROC MEXICO',
    profiles: [
      { name: 'DIGITAL 2', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG MAYOR DE 40 AÑOS EN ESTA EMPRESA' },
      ]},
    ],
  },
  {
    company: 'MARIA LUISA FLORES',
    profiles: [
      { name: 'DIGITAL 2', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'DIGITAL 3', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos | - PLOMO EN SANGRE' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
    ],
  },
  {
    company: 'LASEC',
    profiles: [
      { name: 'DIGITAL 1', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 5 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos | - VHI | -VDRL | - Glucosilada | - perfil de lipidos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG MAYOR DE 40 AÑOS EN ESTA EMPRESA' },
      ]},
      { name: 'DIGITAL 2', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG MAYOR DE 40 AÑOS EN ESTA EMPRESA' },
      ]},
      { name: 'PERFIL NEW MONT', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Hemograma | - eritrosedimentacion | - GLUCOSA | - hemoglobina glucosilada | - UREMIA | -EGO | - PRUEBA DE EMBARAZO EN MUJERES | -ADP 3 ELEMENTOS | - SCREENING DE ALCOHOL' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (IMPRESAS)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG CON INTERPRETACION CARDIOLOGO' },
        { label: 'ENCEFALOGRAMA' },
      ]},
    ],
  },
  {
    company: 'NORMET',
    profiles: [
      { name: 'PERIODICO PERSONAL OPERATIVO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 5 elementos | -EGO | - ADP 5 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG PARA TODOS' },
      ]},
      { name: 'PERIODICO PERSONAL ADMINISTRATIVO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 5 elementos | - Hemoglobina glucosilada | -EGO | - ADP 5 elementos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (DIGITAL)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG PARA TODOS' },
      ]},
      { name: 'CERTIFICADO MEDICO MEDIWORK', items: [
        { label: 'ADP' },
      ]},
    ],
  },
  {
    company: 'IP LINKS',
    profiles: [
      { name: 'COMPLETO IMPRESO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 5 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos | - VHI | -VDRL | - Glucosilada | - perfil de lipidos' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (IMPRESO)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG MAYOR DE 40 AÑOS EN ESTA EMPRESA' },
      ]},
      { name: 'MINERA FRESNILLO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK', detail: 'HISTORIA LABORAL' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 3 elementos | -EGO | - ADP 5 elementos | - PIE si es mujer' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (IMPRESO)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'JUNICIPIO INGRESO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK', detail: 'HISTORIA LABORAL' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea | PERFIL DE LIPIDOS | PIE en mujeres | - EGO | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 5 elementos' },
        { label: 'RUFFIER' },
        { label: 'CUESTIONARIO NORDICO' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'RADIOGRAFIA (IMPRESAS)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'ESPIROMETRIA' },
        { label: 'PSICOMETRICOS', detail: '- Test cleaver | - Test 16pf | - Test terman' },
      ]},
      { name: 'JUNICIPIO PERIODICO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK', detail: 'HISTORIA LABORAL' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica | - Quimica sanguinea | PERFIL DE LIPIDOS | PIE en mujeres | - EGO | - Grupo sanguineo y RH | - VHI | - VDRL | - ADP 5 elementos' },
        { label: 'RUFFIER' },
        { label: 'CUESTIONARIO NORDICO' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'RADIOGRAFIA (IMPRESAS)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'ESPIROMETRIA' },
        { label: 'PSICOMETRICOS', detail: '- NOM 35 | - BURNOUT | - SOFI | - PERFIL DE ESTRES | - GOLDBERG' },
        { label: 'CUESTIONARIO DE HABITOS SALUDABLES' },
        { label: 'CUESTIONARIO DE TABAQUISMO' },
        { label: 'CUESTIONARIO DE ALCOHOLISMO' },
      ]},
      { name: 'PERFIL LA COLORADA', items: [
        { label: 'HISTORIA CLINICA MEDIWORK' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 6 elementos | - Hemoglobina glucosilada en caso de necesitar | - perfil de lipidos | -EGO | - Grupo sanguineo y RH | - ADP 5 elementos | - VHI | -VDRL | - PIE en caso de ser mujer' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (IMPRESO)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
        { label: 'EKG MAYOR DE 45 AÑOS' },
      ]},
      { name: 'PERFIL SAUCITO', items: [
        { label: 'HISTORIA CLINICA MEDIWORK', detail: 'HISTORIA LABORAL' },
        { label: 'Optometria' },
        { label: 'LABORATORIO', detail: '- Biometria Hematica completa | - Quimica sanguinea 6 elementos | -EGO | - Grupo sanguineo y RH | - ADP 6 elementos | - VHI | -VDRL | - Glucosilada valor arriba de 105 | - perfil de lipidos | - PIE si es mujer' },
        { label: 'RUFFIER' },
        { label: 'AUDIOMETRIA OSEA/AREA' },
        { label: 'ESPIROMETRIA' },
        { label: 'RADIOGRAFIA (IMPRESO)', detail: '- Rx de torax | - Rx de columna ap | - Rx de columan lateral' },
      ]},
      { name: 'CERTIFICADO MEDICO', items: [
        { label: 'CERTIFICADO MEDICO MEDIWORK' },
        { label: 'ADP' },
      ]},
    ],
  },
];

async function main() {
  for (const { company, profiles } of DATA) {
    const companyName = clean(company);
    const companyRecord = await prisma.company.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName },
    });

    for (const profile of profiles) {
      const profileName = clean(profile.name);

      let profileRecord = await prisma.companyProfile.findFirst({
        where: { companyId: companyRecord.id, name: profileName },
      });
      if (!profileRecord) {
        profileRecord = await prisma.companyProfile.create({
          data: { companyId: companyRecord.id, name: profileName },
        });
      } else {
        // Reimportar limpio: borra los items viejos y los vuelve a crear en orden
        await prisma.companyProfileItem.deleteMany({ where: { profileId: profileRecord.id } });
      }

      await prisma.companyProfileItem.createMany({
        data: profile.items.map((item, i) => ({
          profileId: profileRecord!.id,
          label: clean(item.label),
          detail: item.detail ? clean(item.detail) : null,
          order: i,
        })),
      });
      console.log(`  + ${companyName} → ${profileName} (${profile.items.length} estudios)`);
    }
  }
  console.log('✅ Perfiles cargados:', DATA.reduce((n, c) => n + c.profiles.length, 0));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
