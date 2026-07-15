// =============================================================
// ARCHIVO: src/services/email.ts
// DESCRIPCION: Envío de correo (config-gated con SMTP).
//
// ACTIVACION: solo envía de verdad si SMTP_HOST/SMTP_USER/SMTP_PASS
// están definidas en el .env. Sin ellas, NO falla: registra el enlace
// en la consola del servidor para que el personal lo copie a mano.
// Así el resto del sistema (registro, activación) funciona en dev sin
// depender de un servidor de correo.
//
// Variables (.env):
//   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM
//   APP_URL  → base pública para armar los enlaces (ej. https://clinica.mx)
// =============================================================

import nodemailer from 'nodemailer';

const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const isEmailConfigured = smtpConfigured;

async function send(to: string, subject: string, html: string, textLink: string) {
  const tx = getTransporter();
  if (!tx) {
    // Sin SMTP: dejar el enlace en el log para copiarlo a mano.
    console.log(`\n[email:DEV] Para: ${to}\n[email:DEV] Asunto: ${subject}\n[email:DEV] Enlace: ${textLink}\n`);
    return;
  }
  await tx.sendMail({
    from: process.env.SMTP_FROM || 'Mediwork <no-reply@mediwork.local>',
    to, subject, html,
  });
}

const wrapper = (title: string, body: string, btnText: string, btnUrl: string) => `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#2560aa">${title}</h2>
    <p style="font-size:14px;line-height:1.6">${body}</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${btnUrl}" style="background:#2560aa;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:bold;display:inline-block">${btnText}</a>
    </p>
    <p style="font-size:12px;color:#64748b">Si el botón no funciona, copia este enlace en tu navegador:<br>${btnUrl}</p>
    <p style="font-size:12px;color:#94a3b8">Este enlace caduca pronto. Si tú no solicitaste esto, ignora el correo.</p>
  </div>`;

// Enlace para que la EMPRESA defina su contraseña por primera vez
export async function sendCompanyActivationEmail(to: string, fullName: string, token: string) {
  const url = `${APP_URL}/activar?token=${token}`;
  await send(
    to,
    'Activa tu cuenta de empresa — Mediwork',
    wrapper('Bienvenido a Mediwork', `Hola ${fullName}, tu clínica creó una cuenta de empresa para consultar los resultados de tus trabajadores. Para empezar, define tu contraseña:`, 'Definir contraseña', url),
    url,
  );
}

// Enlace para que el PACIENTE verifique su correo tras registrarse
export async function sendPatientVerificationEmail(to: string, fullName: string, token: string) {
  const url = `${APP_URL}/verificar?token=${token}`;
  await send(
    to,
    'Verifica tu correo — Mediwork',
    wrapper('Confirma tu correo', `Hola ${fullName}, gracias por registrarte. Confirma que este correo es tuyo para activar tu cuenta:`, 'Verificar correo', url),
    url,
  );
}

// Aviso al paciente de que el médico liberó un resultado/documento en su portal.
// No incluye el documento ni datos clínicos: solo invita a entrar (o crear cuenta)
// para consultarlo de forma segura.
export async function sendResultReleasedEmail(to: string, fullName: string, docLabel?: string) {
  const url = `${APP_URL}/login`;
  const que = docLabel ? `un nuevo documento (<b>${docLabel}</b>)` : 'un nuevo resultado';
  await send(
    to,
    'Ya tienes un resultado disponible — Mediwork',
    wrapper(
      'Resultado disponible',
      `Hola ${fullName}, tu médico liberó ${que} en tu expediente. Para consultarlo de forma segura, inicia sesión en tu portal. Si aún no tienes cuenta, puedes crearla con este mismo correo desde la pantalla de inicio de sesión.`,
      'Iniciar sesión o crear cuenta',
      url,
    ),
    url,
  );
}

// Enlace para restablecer la contraseña olvidada (paciente o empresa)
export async function sendPasswordResetEmail(to: string, fullName: string, token: string) {
  const url = `${APP_URL}/restablecer?token=${token}`;
  await send(
    to,
    'Restablece tu contraseña — Mediwork',
    wrapper('Restablece tu contraseña', `Hola ${fullName}, recibimos una solicitud para restablecer tu contraseña. Haz clic para definir una nueva. Si tú no lo solicitaste, ignora este correo.`, 'Restablecer contraseña', url),
    url,
  );
}
