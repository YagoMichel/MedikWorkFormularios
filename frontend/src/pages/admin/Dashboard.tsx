import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useEffect, useState } from 'react';
import { socket } from '../../services/socket';
import { useAuth } from '../../stores/auth';
import { Link } from 'react-router-dom';
import {
  DollarSign, CalendarClock, Building2, Calendar as CalendarIcon,
  TrendingUp, ShoppingBag, ChevronRight, AlertTriangle, ShieldCheck, BarChart3,
} from 'lucide-react';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
const pct = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

export default function AdminDashboard() {
  const { user } = useAuth();
  const [showActivityModal, setShowActivityModal] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: async () => (await api.get('/dashboard/admin')).data,
  });

  useEffect(() => {
    const h = () => refetch();
    ['sale:created', 'movement:created', 'product:updated'].forEach((e) => socket.on(e, h));
    return () => { ['sale:created', 'movement:created', 'product:updated'].forEach((e) => socket.off(e, h)); };
  }, [refetch]);

  if (isLoading || !data) return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>;
  const k = data.kpis;
  const salesPct = pct(k.salesMonth.total, k.salesMonth.prevTotal);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Buenos días';
    if (hr < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 fade-in">
      {/* Banner de Bienvenida */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-[-10%] right-[10%] w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 flex flex-col-reverse md:flex-row items-center justify-between gap-8 p-8 md:p-10">
          <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 mt-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center gap-2">
              ¡{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Administrador'}! <span className="text-2xl md:text-3xl">👋</span>
            </h1>
            <p className="text-blue-100/90 text-sm md:text-base">
              Aquí tienes un resumen de la actividad del negocio de hoy.
            </p>
          </div>

          <div className="relative shrink-0">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl font-extrabold text-[#2560aa] shadow-lg overflow-hidden border-4 border-white bg-white">
              {user?.photoUrl ? (
                <img src={`${user.photoUrl}?t=${Date.now()}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.split(' ').filter(Boolean).slice(0, 2).map((p: any) => p[0]).join('').toUpperCase() || 'U'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ventas del mes */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-1">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Ventas del mes</div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{fmt(k.salesMonth.total)}</div>
            <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${salesPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <span className="material-symbols-rounded text-xs">{salesPct >= 0 ? 'trending_up' : 'trending_down'}</span>
              {Math.abs(salesPct).toFixed(1)}% vs mes anterior
            </div>
          </div>
        </div>
        {/* Citas pendientes */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 flex items-center justify-center mb-1">
            <CalendarClock size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Citas</div>
            <div className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">{k.pendingBatches}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Pendientes por confirmar</div>
          </div>
        </div>
        {/* Empresas */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-500 flex items-center justify-center mb-1">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Empresas</div>
            <div className="text-2xl font-extrabold text-violet-700 dark:text-violet-400">{k.empresas.count}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Con expediente</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Citas de hoy y alerta de stock */}
        <div className="space-y-6 flex flex-col">
          <div className="card rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <CalendarIcon size={18} className="text-slate-400" /> Citas de hoy
              </h3>
              <div className="text-[11px] font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-100 dark:border-orange-800/50">
                {(data.todaysAppointments?.length || 0) + (data.todaysBatches?.length || 0)}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {(() => {
                const combined = [
                  ...(data.todaysAppointments || []),
                  ...(data.todaysBatches || []).map((b: any) => ({ ...b, isBatch: true }))
                ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (combined.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm p-4">
                      <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                        <CalendarIcon size={20} className="text-slate-300" />
                      </div>
                      No hay citas agendadas para el día de hoy.
                    </div>
                  );
                }

                return combined.map((cita: any) => {
                  const hora = new Date(cita.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                  const isBatch = cita.isBatch;
                  const title = isBatch ? (cita.company?.name === 'Sin Empresa' ? 'Jornada (Sin Empresa)' : `Jornada: ${cita.company?.name}`) : (cita.patient?.fullName || 'Cita');
                  const initial = isBatch ? 'J' : (cita.patient?.fullName?.charAt(0).toUpperCase() || 'P');
                  
                  return (
                    <div key={isBatch ? `b-${cita.id}` : cita.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex justify-between items-center transition hover:border-blue-200 dark:hover:border-blue-800/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${isBatch ? 'bg-[#51abcd]/20 text-[#51abcd]' : 'bg-[#2560aa]/20 text-[#2560aa]'} flex items-center justify-center font-bold text-xs shrink-0`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">{title}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                            {isBatch ? `${cita.expectedCount} pacientes esperados` : `Dr(a). ${cita.doctor?.fullName || '—'}`}
                          </div>
                        </div>
                      </div>
                        {!isBatch && (
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md shrink-0">
                            {hora}
                          </div>
                        )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Alerta de stock bajo */}
          {k.lowStock.count > 0 ? (
            <Link to="/inventory" className="bg-[#fff7ed] dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl p-4 flex items-start gap-4 relative shadow-sm transition hover:border-orange-200 dark:hover:border-orange-700">
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex shrink-0 items-center justify-center shadow-md">
                <AlertTriangle size={20} />
              </div>
              <div className="pr-2">
                <div className="font-bold text-slate-800 dark:text-orange-400 text-sm mb-1">Stock bajo</div>
                <div className="text-xs text-slate-600 dark:text-orange-300 leading-relaxed">
                  Tienes {k.lowStock.count} producto{k.lowStock.count !== 1 ? 's' : ''} con inventario bajo. Revisa el inventario.
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-[#eff6ff] dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4 flex items-start gap-4 relative shadow-sm">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex shrink-0 items-center justify-center shadow-md">
                <ShieldCheck size={20} />
              </div>
              <div className="pr-2">
                <div className="font-bold text-slate-800 dark:text-blue-400 text-sm mb-1">Todo en orden</div>
                <div className="text-xs text-slate-600 dark:text-blue-300 leading-relaxed">
                  No hay productos con stock bajo por el momento.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Ventas recientes */}
        <div className="card rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200 mb-6 border-b border-slate-50 dark:border-slate-700 pb-4">
            <TrendingUp size={18} className="text-slate-400" /> Ventas recientes
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-6 py-2">

            {data.lastSales && data.lastSales.length > 0 ? data.lastSales.slice(0, 4).map((sale: any) => {
              const date = new Date(sale.createdAt);
              return (
                <div key={sale.id} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex shrink-0 items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                    <ShoppingBag size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">Venta a {sale.patient?.fullName || 'Cliente general'}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">Atendido por {sale.vendor?.fullName || '—'}</div>
                  </div>
                  <div className="text-right shrink-0 leading-tight">
                    <div className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{fmt(sale.total)}</div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-slate-400 text-sm py-4">No hay ventas recientes.</div>
            )}
          </div>

          {data.lastSales && data.lastSales.length > 4 && (
            <button
              onClick={() => setShowActivityModal(true)}
              className="w-full mt-6 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1"
            >
              Ver todas las ventas recientes <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Ventas Recientes */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" /> Ventas recientes
              </h2>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
              {data.lastSales?.map((sale: any) => {
                const date = new Date(sale.createdAt);
                return (
                  <div key={sale.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition hover:border-blue-200 dark:hover:border-slate-600">
                    <div className="w-10 h-10 rounded-full flex shrink-0 items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                      <ShoppingBag size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">Venta a {sale.patient?.fullName || 'Cliente general'}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">Atendido por {sale.vendor?.fullName || '—'}</div>
                    </div>
                    <div className="text-right shrink-0 leading-tight">
                      <div className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{fmt(sale.total)}</div>
                      <div className="text-[10px] text-slate-400">
                        {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
