// =============================================================
// ARCHIVO: src/pages/portal/PortalLayout.tsx
// DESCRIPCION: Layout de los portales externos (PACIENTE / EMPRESA).
//              Reutiliza el MISMO estilo visual que MainLayout (sidebar +
//              header), pero con navegación reducida y sin la maquinaria de
//              notificaciones/socket propia de doctor/admin.
// =============================================================

import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../stores/theme.tsx';
import { useState, useEffect } from 'react';
import logo from '../../assets/logo.png';

const Icon = ({ name }: { name: string }) => <span className="material-symbols-rounded">{name}</span>;

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { dark, toggle } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.profile-container')) setShowProfileMenu(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const isEmpresa = user?.role === 'EMPRESA';

  const links = isEmpresa
    ? [{ to: '/', icon: 'folder_shared', label: 'Expedientes' }]
    : [
        { to: '/', icon: 'folder_shared', label: 'Mi expediente' },
        { to: '/mi-encuesta', icon: 'assignment', label: 'Mi encuesta' },
      ];

  const titleMap: Record<string, string> = isEmpresa
    ? { '/': 'Expedientes de la empresa' }
    : { '/': 'Mi expediente', '/mi-encuesta': 'Mi encuesta' };
  const title = titleMap[loc.pathname] || 'Mediwork';

  const initials = (user?.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  return (
    <div className="layout-root min-h-screen flex">
      {/* Sidebar — oculto en móvil, visible en desktop */}
      <aside className="layout-sidebar hidden md:flex fixed left-0 top-0 h-screen w-[68px] flex-col items-center z-40">
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

      {/* Contenido principal */}
      <div className="flex-1 md:ml-[68px] flex flex-col min-h-screen">
        <header className="layout-header fixed top-0 right-0 left-0 md:left-[68px] h-[70px] z-30 flex items-center px-6 backdrop-blur-md border-b">
          <h2 className="layout-title absolute left-1/2 -translate-x-1/2 text-base font-bold">{title}</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition" title={dark ? 'Modo claro' : 'Modo oscuro'}>
              <Icon name={dark ? 'light_mode' : 'dark_mode'} />
            </button>
            <div className="relative profile-container">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="layout-user flex items-center gap-2 px-2 py-1.5 rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-sm overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #2560aa, #51abcd)' }}>
                  {user?.photoUrl ? <img src={user.photoUrl} alt="User" className="w-full h-full object-cover" /> : initials}
                </div>
                <div className="leading-tight hidden sm:block text-left">
                  <div className="layout-username text-xs font-bold text-slate-800 dark:text-slate-100">{user?.fullName}</div>
                  <div className="layout-role text-[10px] font-semibold text-slate-500 dark:text-slate-400">{isEmpresa ? 'Empresa' : 'Paciente'}</div>
                </div>
                <span className="material-symbols-rounded text-slate-400 text-[20px] transition-transform ml-1" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none' }}>expand_more</span>
              </button>
              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-3 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 transform origin-top-right transition-all fade-in">
                  <div className="absolute -top-1.5 right-[20px] w-3 h-3 bg-white dark:bg-slate-800 border-l border-t border-slate-100 dark:border-slate-700 rotate-45"></div>
                  <div className="relative z-10 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden py-2">
                    <button onClick={() => { logout(); nav('/login'); }} className="w-full px-5 py-3 text-left text-sm font-extrabold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-3 transition">
                      <span className="material-symbols-rounded text-lg text-red-500">logout</span> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="pt-[70px] p-6 pb-24 md:pb-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
