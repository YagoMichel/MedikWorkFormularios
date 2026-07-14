// =============================================================
// ARCHIVO: components/TurnstileWidget.tsx
// DESCRIPCION: Captcha Cloudflare Turnstile (anti-bots).
//
// Solo se renderiza si VITE_TURNSTILE_SITE_KEY está definida en el
// .env del frontend — sin ella no aparece nada y el backend tampoco
// exige el token (misma lógica en backend/src/middleware/turnstile.ts).
//
// USO:
//   const [captcha, setCaptcha] = useState('');
//   <TurnstileWidget onToken={setCaptcha} />
//   ...al enviar: incluir { turnstileToken: captcha } en el body.
// =============================================================

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Carga el script de Cloudflare una sola vez, compartido entre widgets
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error('No se pudo cargar Turnstile')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    }).catch(() => { /* sin captcha visible; el backend decidirá */ });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // onToken se asume estable (setState de React lo es)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
