import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../stores/theme.tsx';
import logo from '../../assets/logo.png';

const Icon = ({ name }: { name: string }) => <span className="material-symbols-rounded">{name}</span>;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { dark, toggle } = useTheme();
  const isAdmin = user?.role === 'ADMIN';

  const links = isAdmin ? [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/inventory', icon: 'inventory_2', label: 'Inventario' },
    { to: '/companies', icon: 'business', label: 'Empresas' },
    { to: '/users', icon: 'manage_accounts', label: 'Usuarios' },
    { to: '/agent', icon: 'smart_toy', label: 'Agente IA' },
    { to: '/citas', icon: 'calendar_month', label: 'Citas' },
  ] : [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/appointments', icon: 'event', label: 'Agenda' },
    { to: '/patients', icon: 'group', label: 'Pacientes' },
  ];

  const titleMap: Record<string, string> = {
    '/': 'Dashboard', '/patients': 'Pacientes', '/sales': 'Ventas',
    '/appointments': 'Agenda', '/inventory': 'Inventario',
    '/movements': 'Movimientos', '/users': 'Usuarios', '/prescriptions': 'Recetas', '/agent': 'Agente IA', '/citas': 'Citas',
  };
  const title = titleMap[loc.pathname] || (loc.pathname.startsWith('/patients/') ? 'Ficha de paciente' : 'Mediwork');

  const initials = (user?.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  return (
    <div className="layout-root min-h-screen flex">
      {/* Sidebar */}
      <aside className="layout-sidebar fixed left-0 top-0 h-screen w-[68px] flex flex-col items-center z-40">
        <div className="layout-sidebar-top py-4 w-full flex justify-center border-b">
          <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
        </div>
        <nav className="flex-1 flex flex-col items-center gap-3 py-4">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) =>
                `group relative w-11 h-11 rounded-xl flex items-center justify-center transition nav-link ${isActive ? 'nav-link-active text-white shadow' : 'nav-link-idle'}`
              }
              style={({ isActive }) => isActive ? { background: '#3375c8' } : {}}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r" style={{ background: '#3375c8' }} />}
                  <Icon name={l.icon} />
                  <span className="nav-tooltip absolute left-[calc(100%+12px)] whitespace-nowrap text-white text-xs font-semibold px-3 py-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition pointer-events-none shadow-lg z-50">
                    {l.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="layout-sidebar-bottom py-6 w-full flex justify-center border-t">
          <button onClick={() => { logout(); nav('/login'); }}
            className="group relative w-11 h-11 rounded-xl flex items-center justify-center layout-logout transition">
            <Icon name="logout" />
            <span className="nav-tooltip absolute left-[calc(100%+12px)] whitespace-nowrap text-white text-xs font-semibold px-3 py-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition pointer-events-none">
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-[68px] flex flex-col min-h-screen">
        <header className="layout-header fixed top-0 right-0 left-[68px] h-[70px] z-30 flex items-center px-6 backdrop-blur-md border-b">
          <h2 className="layout-title absolute left-1/2 -translate-x-1/2 text-base font-bold">{title}</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition" title={dark ? 'Modo claro' : 'Modo oscuro'}>
              <Icon name={dark ? 'light_mode' : 'dark_mode'} />
            </button>
            <button className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition">
              <Icon name="notifications" />
            </button>
            <div className="layout-user flex items-center gap-2 px-2 py-1 rounded-xl">
              <div className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3375c8, #51abcd)' }}>{initials}</div>
              <div className="leading-tight">
                <div className="layout-username text-xs font-semibold">{user?.fullName}</div>
                <div className="layout-role text-[10px]">{user?.role}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="pt-[70px] p-6 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
