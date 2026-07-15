// =============================================================
// ARCHIVO: src/services/patientLink.ts
// DESCRIPCION: Liga automáticamente una cuenta de portal PACIENTE a su
//   expediente (Patient) cuando coincide el correo YA VERIFICADO. Así, el
//   paciente que llenó la encuesta (en la tablet o en el formulario público)
//   con su correo, al registrarse y verificar ese mismo correo, queda ligado
//   a su expediente y puede consultar de nuevo su formulario y sus resultados.
//
//   Seguridad: solo se ejecuta cuando el correo está verificado (signup+verify
//   o login social) — el paciente demostró poseer el correo, así que emparejar
//   por correo no permite reclamar un expediente ajeno. Nunca "roba" un
//   expediente que ya está ligado a otra cuenta (Patient.portalUser).
// =============================================================
import { prisma } from '../prisma';

// Devuelve el id del expediente ligado (nuevo o el que ya tenía), o null si no
// se encontró expediente que ligar. No lanza: cualquier problema deja la cuenta
// sin ligar (el staff siempre puede ligar a mano en Usuarios).
export async function autoLinkPatientByVerifiedEmail(userId: string, email: string): Promise<string | null> {
  const correo = (email || '').toLowerCase().trim();
  if (!correo) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, patientId: true },
  });
  if (!user || user.role !== 'PACIENTE') return null;
  if (user.patientId) return user.patientId; // ya ligado, no tocar

  // Expediente con ese correo (case-insensitive) que NO esté ya ligado a otra
  // cuenta. Si hubiera varios, el más reciente.
  const patient = await prisma.patient.findFirst({
    where: { email: { equals: correo, mode: 'insensitive' }, portalUser: { is: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!patient) return null;

  try {
    await prisma.user.update({ where: { id: userId }, data: { patientId: patient.id } });
    return patient.id;
  } catch {
    // Carrera improbable (otra cuenta lo tomó entre el find y el update): la
    // restricción @unique de User.patientId lo impide — se deja sin ligar.
    return null;
  }
}
