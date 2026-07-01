import { Outlet, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../stores/theme.tsx';
import logo from '../../assets/logo.png';

// Toca el logo 5 veces seguidas (en menos de 2s) para revelar el botón de
// cerrar sesión. Es una tablet compartida en sala de espera: el paciente no
// debe poder salir de la encuesta ni cerrar sesión por accidente, pero el
// personal sigue necesitando una forma de hacerlo al final del día.
const TAPS_REQUIRED = 5;
const TAP_WINDOW_MS = 2000;

export default function PatientLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();
  const [unlocked, setUnlocked] = useState(false);
  const tapsRef = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({ count: 0, timer: null });

  const onLogoTap = () => {
    const t = tapsRef.current;
    if (t.timer) clearTimeout(t.timer);
    t.count += 1;
    if (t.count >= TAPS_REQUIRED) {
      t.count = 0;
      setUnlocked(true);
      return;
    }
    t.timer = setTimeout(() => { t.count = 0; }, TAP_WINDOW_MS);
  };

  return (
    <div className="min-h-screen flex flex-col layout-root">
      <header className="layout-header h-[64px] flex items-center px-6 border-b">
        <img src={logo} alt="MediWork" className="h-9 object-contain select-none" onClick={onLogoTap} />
        <div className="ml-auto flex items-center gap-3">
          <button onClick={toggle} className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition">
            <span className="material-symbols-rounded text-[20px]">{dark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          {unlocked && (
            <button onClick={() => { logout(); nav('/login'); }}
              className="flex items-center gap-1 text-sm font-semibold text-white transition px-4 py-2 rounded-xl"
              style={{ background: '#e53e3e' }}>
              <span className="material-symbols-rounded text-[18px]">logout</span>
              Cerrar sesión
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
