// =============================================================
// ARCHIVO: src/services/oauth.ts
// DESCRIPCION: Login social Google/Microsoft (OpenID Connect,
//   authorization-code flow, cliente confidencial). CONFIG-GATED:
//   un proveedor solo se activa si sus credenciales están en el .env
//   (igual que el captcha/SMTP). Sin credenciales, queda dormido.
//
//   El client_secret vive SOLO en el backend. El id_token se obtiene
//   server-to-server desde el token endpoint sobre TLS usando ese
//   secreto, por lo que sus claims son confiables en el code flow.
//
//   IMPORTANTE (Microsoft): esta app es DISTINTA a la de OneDrive —
//   aquella es app-only (client credentials); esta necesita el flujo
//   delegado (auth-code) y un registro de app aparte.
// =============================================================
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { APP_URL } from './email';

export type ProviderId = 'google' | 'microsoft';

interface ProviderConfig {
  id: ProviderId;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

// El secreto para firmar el `state` (CSRF): el mismo del JWT de sesión.
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function googleConfig(): ProviderConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    id: 'google', clientId, clientSecret,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  };
}

function microsoftConfig(): ProviderConfig | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  return {
    id: 'microsoft', clientId, clientSecret,
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scope: 'openid email profile',
  };
}

export function getProvider(id: string): ProviderConfig | null {
  if (id === 'google') return googleConfig();
  if (id === 'microsoft') return microsoftConfig();
  return null;
}

// Qué proveedores están activos (para que el frontend muestre solo esos botones).
export function enabledProviders() {
  return { google: !!googleConfig(), microsoft: !!microsoftConfig() };
}

// El redirect_uri pasa por nginx (/api) → backend. Debe registrarse IDÉNTICO en
// la consola de cada proveedor.
function redirectUri(id: ProviderId) {
  return `${APP_URL}/api/auth/oauth/${id}/callback`;
}

// `state` firmado y con caducidad: protección CSRF sin guardar estado en el server.
export function signState(provider: ProviderId): string {
  return jwt.sign({ provider, nonce: crypto.randomBytes(8).toString('hex') }, SECRET, { expiresIn: '10m' });
}
export function verifyState(state: string, provider: ProviderId): boolean {
  try {
    const decoded = jwt.verify(state, SECRET) as any;
    return decoded?.provider === provider;
  } catch {
    return false;
  }
}

export function buildAuthUrl(cfg: ProviderConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(cfg.id),
    response_type: 'code',
    scope: cfg.scope,
    state,
  });
  if (cfg.id === 'google') {
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
  }
  return `${cfg.authUrl}?${params.toString()}`;
}

// Intercambia el `code` por tokens y extrae los datos del usuario del id_token.
export async function exchangeCode(cfg: ProviderConfig, code: string): Promise<{ email: string; emailVerified: boolean; name: string }> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(cfg.id),
  });
  const r = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('sin id_token en la respuesta');

  // Confiable: el id_token vino del token endpoint por TLS autenticado con el
  // client_secret (code flow), así que no hace falta verificar su firma aparte.
  const claims = jwt.decode(data.id_token) as any;
  const email = String(claims?.email || '').toLowerCase().trim();
  // Google incluye email_verified; Microsoft (v2) no siempre lo manda, pero el
  // correo proviene de una cuenta ya autenticada → se toma como verificado.
  const emailVerified = cfg.id === 'google' ? claims?.email_verified === true : !!email;
  const name = String(claims?.name || claims?.given_name || email);
  return { email, emailVerified, name };
}
