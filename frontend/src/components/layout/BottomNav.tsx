// ARCHIVO: src/components/layout/BottomNav.tsx
// DESCRIPCION: Barra de navegación flotante para móvil (<768px).
//   4 iconos fijos + botón ⊕ que abre overlay con cuadrícula de opciones extras.

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth';

const Icon = ({ name }: { name: string }) => (
  <span className="material-symbols-rounded" style={{ fontSize: 22 }}>{name}</span>
);

interface BottomNavProps {
  isAdmin: boolean;
  isMaster?: boolean;
}

export default function BottomNav({ isAdmin, isMaster }: BottomNavProps) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const nav = useNavigate();

  const fixedAdmin = [
    { to: '/',          icon: 'dashboard',       label: 'Inicio'   },
    { to: '/citas',     icon: 'calendar_month',  label: 'Citas'    },
    { to: '/users',     icon: 'manage_accounts', label: 'Usuarios' },
    { to: '/companies', icon: 'business',        label: 'Empresas' },
  ];

  const fixedDoctor = [
    { to: '/',             icon: 'dashboard', label: 'Inicio'    },
    { to: '/appointments', icon: 'event',     label: 'Agenda'    },
    { to: '/patients',     icon: 'group',     label: 'Pacientes' },
    { to: '/companies',    icon: 'business',  label: 'Empresas'  },
  ];

  const menuAdmin = [
    { to: '/patients',   icon: 'group',       label: 'Pacientes'  },
    { to: '/inventory',  icon: 'inventory_2', label: 'Inventario' },
    { to: '/calendario', icon: 'date_range',  label: 'Calendario' },
    { to: '/reportes',   icon: 'bar_chart',   label: 'Reportes'   },
    { to: '/auditoria',  icon: 'history',     label: 'Auditoría'  },
    ...(isMaster ? [{ to: '/company-review', icon: 'approval', label: 'Aprobaciones' }] : []),
    ...(isMaster ? [{ to: '/system-status', icon: 'monitor_heart', label: 'Estado del sistema' }] : []),
  ];

  const fixed = isAdmin ? fixedAdmin : fixedDoctor;
  const menuItems = isAdmin ? menuAdmin : [];

  const handleLogout = () => {
    setOpen(false);
    logout();
    nav('/login');
  };

  return (
    <>
      {/* Overlay + grid menu */}
      {open && (
        <div
          className="bottom-nav-overlay fixed inset-0 z-40 flex items-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full px-4 pb-28"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-3 mb-3">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="bottom-nav-grid-item flex flex-col items-center gap-1.5 py-4"
                >
                  <Icon name={item.icon} />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <button
              onClick={handleLogout}
              className="bottom-nav-grid-logout w-full flex items-center justify-center gap-2 py-3 font-semibold text-sm"
            >
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Floating bar */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="bottom-nav-bar flex items-center justify-around px-3 py-2">
          {fixed.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `bottom-nav-icon w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 ${isActive ? 'active' : ''}`
              }
            >
              <Icon name={link.icon} />
              <span className="text-[9px] font-semibold leading-none">{link.label}</span>
            </NavLink>
          ))}

          <button
            onClick={() => setOpen((v) => !v)}
            className={`bottom-nav-menu-btn w-11 h-11 rounded-xl flex items-center justify-center text-white text-2xl font-light ${open ? 'open' : ''}`}
          >
            +
          </button>
        </div>
      </nav>
    </>
  );
}
