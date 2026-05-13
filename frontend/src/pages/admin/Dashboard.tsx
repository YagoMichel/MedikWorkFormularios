import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useEffect } from 'react';
import { socket } from '../../services/socket';
import { useAuth } from '../../stores/auth';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
const pct = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: async () => (await api.get('/dashboard/admin')).data,
  });

  useEffect(() => {
    const h = () => refetch();
    ['sale:created', 'movement:created', 'product:updated'].forEach((e) => socket.on(e, h));
    return () => { ['sale:created', 'movement:created', 'product:updated'].forEach((e) => socket.off(e, h)); };
  }, [refetch]);

  if (isLoading || !data) return <div className="flex items-center justify-center h-full text-ink-muted">Cargando...</div>;
  const k = data.kpis;

  const salesPct = pct(k.salesMonth.total, k.salesMonth.prevTotal);
  const patientsPct = pct(k.patientsToday.count, k.patientsToday.prev);

  const initials = (user?.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-10 px-4">

      {/* Avatar */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4" style={{ background: '#3375c8' }}>
        {initials}
      </div>

      {/* Ventas del mes — métrica principal */}
      <div className="text-5xl font-extrabold text-primary-800 tracking-tight">
        {fmt(k.salesMonth.total)}
      </div>
      <div className="text-sm text-ink-secondary font-semibold uppercase tracking-widest mt-1 mb-1">
        Ventas del mes
      </div>
      <div className={`text-xs flex items-center gap-1 mb-8 ${salesPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        <span className="material-symbols-rounded text-sm">{salesPct >= 0 ? 'trending_up' : 'trending_down'}</span>
        {Math.abs(salesPct).toFixed(1)}% vs mes anterior
      </div>

      {/* Tarjetas secundarias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {/* Pacientes hoy */}
        <div className="card rounded-2xl p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-orange-500 font-semibold text-sm">
            <span className="material-symbols-rounded">group</span>
            Pacientes
          </div>
          <div className="text-3xl font-extrabold text-orange-600">{k.patientsToday.count}</div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">Atendidos hoy</div>
          <div className={`text-xs flex items-center gap-1 mt-1 ${patientsPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            <span className="material-symbols-rounded text-sm">{patientsPct >= 0 ? 'trending_up' : 'trending_down'}</span>
            {Math.abs(patientsPct).toFixed(1)}% vs ayer
          </div>
        </div>

        {/* Empresas */}
        <div className="card rounded-2xl p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-violet-500 font-semibold text-sm">
            <span className="material-symbols-rounded">business</span>
            Empresas
          </div>
          <div className="text-3xl font-extrabold text-violet-700">{k.empresas.count}</div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">Con expediente</div>
        </div>
      </div>
    </div>
  );
}
