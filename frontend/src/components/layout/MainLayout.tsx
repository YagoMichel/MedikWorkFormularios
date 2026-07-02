// =============================================================
// ARCHIVO: src/components/layout/MainLayout.tsx
// DESCRIPCION: Layout principal con sidebar (desktop) y barra
//              inferior flotante (móvil). Usado por ADMIN y DOCTOR.
//
// DESKTOP (≥768px): sidebar fijo izquierdo de 68px
// MÓVIL   (<768px): sidebar oculto, BottomNav visible
// =============================================================

import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import { useTheme } from '../../stores/theme.tsx';
import logo from '../../assets/logo.png';
import BottomNav from './BottomNav';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket';

type NotifItem = {
  id: string;
  title: string;
  subtitle: string;
  timeStr: string;
  unread: boolean;
};

const Icon = ({ name }: { name: string }) => <span className="material-symbols-rounded">{name}</span>;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { dark, toggle } = useTheme();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isDoctor = user?.role === 'DOCTOR';

  const { data: appts = [] } = useQuery({
    queryKey: ['doctor-appointments-today'],
    queryFn: async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const tmrw = new Date(today.getTime() + 86400000);
      return (await api.get('/appointments', { params: { mine: true, from: today.toISOString(), to: tmrw.toISOString() } })).data;
    },
    enabled: isDoctor,
  });

  const notifiedRef = useRef<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const unreadCount = notifications.filter(n => n.unread).length;

  useEffect(() => {
    if (user?.id) {
      const savedPhoto = localStorage.getItem(`profile_photo_${user.id}`);
      if (savedPhoto) setProfilePhoto(savedPhoto);

      const updatePhoto = () => {
        const photo = localStorage.getItem(`profile_photo_${user.id}`);
        if (photo) setProfilePhoto(photo);
      };

      window.addEventListener('storage', updatePhoto);
      window.addEventListener('profilePhotoChanged', updatePhoto);
      return () => {
        window.removeEventListener('storage', updatePhoto);
        window.removeEventListener('profilePhotoChanged', updatePhoto);
      };
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.notif-container')) {
        setShowNotifMenu(false);
      }
      if (!target.closest('.profile-container')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!isDoctor) return;
    // Las notificaciones de "faltan X minutos" han sido removidas,
    // ya que la clínica atiende por orden de llegada a partir de las 8 AM.
  }, [isDoctor]);

  useEffect(() => {
    if (isAdmin) {
      const handleBatchCreated = (data: any) => {
        const notifId = `batch-created-${data.id}`;
        if (!notifiedRef.current.has(notifId)) {
          notifiedRef.current.add(notifId);
          setNotifications(prev => {
            if (prev.find(n => n.id === notifId)) return prev;
            return [{
              id: notifId,
              title: 'Nueva jornada agendada',
              subtitle: `${data.company?.name || 'Empresa'} espera confirmación`,
              timeStr: 'Ahora',
              unread: true
            }, ...prev];
          });
          qc.invalidateQueries({ queryKey: ['batches'] });
        }
      };
      socket.on('batch:created', handleBatchCreated);
      return () => { socket.off('batch:created', handleBatchCreated); };
    }
    
    if (isDoctor) {
      const handleBatchConfirmed = (data: any) => {
        const notifId = `batch-confirmed-${data.id}`;
        if (!notifiedRef.current.has(notifId)) {
          notifiedRef.current.add(notifId);
          setNotifications(prev => {
            if (prev.find(n => n.id === notifId)) return prev;
            return [{
              id: notifId,
              title: 'Jornada Confirmada',
              subtitle: `El admin ha confirmado la jornada de ${data.company}`,
              timeStr: 'Ahora',
              unread: true
            }, ...prev];
          });
          qc.invalidateQueries({ queryKey: ['doctor-dashboard'] });
          qc.invalidateQueries({ queryKey: ['appointments'] });
        }
      };
      socket.on('batch:confirmed', handleBatchConfirmed);
      return () => { socket.off('batch:confirmed', handleBatchConfirmed); };
    }
  }, [isAdmin, isDoctor, qc]);


  useEffect(() => {
    if (!isDoctor) return;
    const loadMissedNotifs = async () => {
      try {
        const { data } = await api.get('/batches', { params: { status: 'CONFIRMADO' } });
        const readNotifs = JSON.parse(localStorage.getItem(`read_notifs_${user?.id}`) || '[]');
        
        data.forEach((b: any) => {
          const notifId = `batch-confirmed-${b.id}`;
          if (!readNotifs.includes(notifId) && !notifiedRef.current.has(notifId)) {
            notifiedRef.current.add(notifId);
            setNotifications(prev => {
              if (prev.find(n => n.id === notifId)) return prev;
              return [{
                id: notifId,
                title: 'Jornada Confirmada',
                subtitle: `El admin ha confirmado la jornada de ${b.company?.name || 'la empresa'}`,
                timeStr: new Date(b.updatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                unread: true
              }, ...prev];
            });
          }
        });
      } catch (err) {}
    };
    loadMissedNotifs();
  }, [isDoctor, user?.id]);

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    const prevRead = JSON.parse(localStorage.getItem(`read_notifs_${user?.id}`) || '[]');
    localStorage.setItem(`read_notifs_${user?.id}`, JSON.stringify(Array.from(new Set([...prevRead, ...ids]))));
    
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const links = isAdmin ? [
    { to: '/',          icon: 'dashboard',      label: 'Dashboard'  },
    { to: '/inventory', icon: 'inventory_2',    label: 'Inventario' },
    { to: '/companies', icon: 'business',       label: 'Empresas'   },
    { to: '/users',     icon: 'manage_accounts',label: 'Usuarios'   },
    { to: '/citas',     icon: 'calendar_month', label: 'Citas'      },
    { to: '/calendario',icon: 'date_range',     label: 'Calendario' },
    { to: '/reportes',  icon: 'bar_chart',      label: 'Reportes'   },
  ] : [
    { to: '/',             icon: 'dashboard', label: 'Dashboard' },
    { to: '/appointments', icon: 'event',     label: 'Agenda'    },
    { to: '/patients',     icon: 'group',     label: 'Pacientes' },
  ];

  const titleMap: Record<string, string> = {
    '/': 'Dashboard', '/patients': 'Pacientes', '/sales': 'Ventas',
    '/appointments': 'Agenda', '/inventory': 'Inventario',
    '/movements': 'Movimientos', '/users': 'Usuarios', '/prescriptions': 'Recetas',
    '/citas': 'Citas', '/calendario': 'Calendario', '/reportes': 'Reportes',
  };
  const title = titleMap[loc.pathname] || (loc.pathname.startsWith('/patients/') ? 'Ficha de paciente' : 'Mediwork');

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
            <div className="relative notif-container">
              <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition">
                <Icon name="notifications" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold border-2 border-white dark:border-slate-900 shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifMenu && (
                <div className="absolute top-full right-[-8px] mt-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 transform origin-top-right transition-all fade-in">
                  <div className="absolute -top-1.5 right-[20px] w-3 h-3 bg-white dark:bg-slate-800 border-l border-t border-slate-100 dark:border-slate-700 rotate-45"></div>
                  
                  <div className="relative z-10 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">Notificaciones</h3>
                      <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
                        Marcar todas como leídas
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar p-3 space-y-2">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6 text-sm text-slate-400">
                          No tienes notificaciones
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-default">
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                              <Icon name="event" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-bold text-slate-800 dark:text-white leading-tight">{n.title}</div>
                              <div className="text-xs text-slate-500 leading-tight mt-1">{n.subtitle}</div>
                              <div className="text-[10px] text-slate-400 mt-1.5">{n.timeStr}</div>
                            </div>
                            {n.unread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative profile-container">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="layout-user flex items-center gap-2 px-2 py-1.5 rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-sm overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #2560aa, #51abcd)' }}>
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="leading-tight hidden sm:block text-left">
                  <div className="layout-username text-xs font-bold text-slate-800 dark:text-slate-100">{user?.fullName}</div>
                  <div className="layout-role text-[10px] font-semibold text-slate-500 dark:text-slate-400">{user?.role}</div>
                </div>
                <span className="material-symbols-rounded text-slate-400 text-[20px] transition-transform ml-1" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none' }}>expand_more</span>
              </button>

              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-3 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 transform origin-top-right transition-all fade-in">
                  <div className="absolute -top-1.5 right-[20px] w-3 h-3 bg-white dark:bg-slate-800 border-l border-t border-slate-100 dark:border-slate-700 rotate-45"></div>
                  
                  <div className="relative z-10 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden py-2">
                    <button onClick={() => { nav('/profile'); setShowProfileMenu(false); }} className="w-full px-5 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition">
                      <span className="material-symbols-rounded text-lg text-slate-400">person</span> Mi Perfil
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-700"></div>
                    <button onClick={() => { logout(); nav('/login'); }} className="w-full px-5 py-3 text-left text-sm font-extrabold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-3 transition">
                      <span className="material-symbols-rounded text-lg text-red-500">logout</span> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* padding-bottom extra en móvil para no quedar bajo la barra flotante */}
        <main className="pt-[70px] p-6 pb-24 md:pb-6 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior flotante (solo visible en móvil vía CSS) */}
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
