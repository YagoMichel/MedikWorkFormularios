import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../stores/theme.tsx';
import logo from '../../assets/logo.png';

export default function PatientLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col layout-root">
      <header className="layout-header h-[64px] flex items-center px-6 border-b">
        <img src={logo} alt="MediWork" className="h-9 object-contain" />
        <div className="ml-auto flex items-center gap-3">
          <button onClick={toggle} className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition">
            <span className="material-symbols-rounded text-[20px]">{dark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <button onClick={() => { logout(); nav('/login'); }}
            className="flex items-center gap-1 text-sm font-semibold text-white transition px-4 py-2 rounded-xl"
            style={{ background: '#e53e3e' }}>
            <span className="material-symbols-rounded text-[18px]">logout</span>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
