import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import logo from '../../assets/logo.png';

export default function PatientLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex flex-col layout-root">
      <header className="layout-header h-[64px] flex items-center px-6 border-b">
        <img src={logo} alt="MediWork" className="h-9 object-contain" />
        <div className="ml-auto">
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
