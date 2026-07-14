// =============================================================
// ARCHIVO: src/hooks/useInactivityLogout.ts
// DESCRIPCION: Cierra la sesión automáticamente tras un periodo sin
//   actividad del usuario (mouse/teclado/scroll/touch). Complementa
//   la expiración corta del token (SESSION_TTL en el backend): cierra
//   la sesión ANTES de que caduque aunque la pestaña quede abierta,
//   según la recomendación de sesiones acotadas (LFPDPPP/NOM-024).
//
//   El rol PACIENTE_TABLET (kiosco de encuestas) queda EXENTO: no
//   muestra datos sensibles y la captura no debe interrumpirse.
// =============================================================
import { useEffect, useRef } from 'react';
import { useAuth } from '../stores/auth';

// Minutos de inactividad antes de cerrar sesión (configurable con VITE_INACTIVITY_MIN).
const INACTIVITY_MS = (Number(import.meta.env.VITE_INACTIVITY_MIN) || 30) * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export function useInactivityLogout() {
  const { user, logout } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sin sesión, o en el kiosco de tablet, no aplica.
    if (!user || user.role === 'PACIENTE_TABLET') return;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => logout(), INACTIVITY_MS);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // arranca el conteo al montar

    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);
}
