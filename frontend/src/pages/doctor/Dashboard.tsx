// =============================================================
// ARCHIVO: src/pages/doctor/Dashboard.tsx
// SECCION: DOCTOR (tuyo)
// DESCRIPCION: Dashboard del doctor. Muestra resumen del dia:
//              citas pendientes, pacientes atendidos, alertas.
// =============================================================
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';

export default function DoctorDashboard() {
  const user = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-doctor'],
    queryFn: async () => (await api.get('/dashboard/doctor')).data,
  });

  if (isLoading || !data) return <div className="flex items-center justify-center h-full text-ink-muted">Cargando...</div>;

  const initials = (user?.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();

  const proxima = data.proximaCita;
  const proximaFecha = proxima
    ? new Date(proxima.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : null;

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-10 px-4">

      {/* Avatar */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4" style={{ background: '#3375c8' }}>
        {initials}
      </div>

      {/* Citas del mes — métrica principal */}
      <div className="text-5xl font-extrabold text-primary-800 tracking-tight">
        {data.citasMes}
      </div>
      <div className="text-sm text-ink-secondary font-semibold uppercase tracking-widest mt-1 mb-8">
        Citas del mes
      </div>

      {/* Tarjetas secundarias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {/* Total pacientes */}
        <div className="card rounded-2xl p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-orange-500 font-semibold text-sm">
            <span className="material-symbols-rounded">group</span>
            Pacientes
          </div>
          <div className="text-3xl font-extrabold text-orange-600">{data.totalPacientes}</div>
          <div className="text-xs text-ink-muted uppercase tracking-wide">Total en sistema</div>
        </div>

        {/* Próxima cita */}
        <div className="card rounded-2xl p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-violet-500 font-semibold text-sm">
            <span className="material-symbols-rounded">event</span>
            Próxima cita
          </div>
          {proxima ? (
            <>
              <div className="text-base font-bold text-violet-700">{proxima.patient?.fullName || proxima.batch?.company?.name || 'Cita empresarial'}</div>
              <div className="text-xs text-ink-muted capitalize">{proximaFecha}</div>
            </>
          ) : (
            <div className="text-sm text-ink-muted mt-1">Sin citas próximas</div>
          )}
        </div>
      </div>
    </div>
  );
}
