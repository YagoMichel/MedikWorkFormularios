import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { Link } from 'react-router-dom';
import { Users, Calendar as CalendarIcon, Clock, TrendingUp, CalendarCheck, Shield, ChevronRight, UserPlus, FileText, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

import { useState } from 'react';

export default function DoctorDashboard() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [showActivityModal, setShowActivityModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-doctor'],
    queryFn: async () => (await api.get('/dashboard/doctor')).data,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      return (await api.put(`/appointments/${id}`, { status })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-doctor'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  if (isLoading || !data) return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>;

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Buenos días';
    if (hr < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const proxima = data.proximaCita;
  const proximaNombre = proxima ? (proxima.patient?.fullName || proxima.batch?.company?.name || 'Cita empresarial') : '--';
  const proximaFecha = proxima ? new Date(proxima.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : '--';
  const proximaHora = proxima ? new Date(proxima.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 fade-in">
      {/* Banner de Bienvenida */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#f0f7ff] to-[#e0f0ff] dark:from-slate-800 dark:to-slate-900 border border-blue-50 dark:border-slate-700 p-8 flex justify-between items-center shadow-sm">
        <div className="z-10 max-w-xl">
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            ¡{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Doctor'}! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Aquí tienes un resumen de tu actividad del día de hoy.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none transform translate-x-4 translate-y-4">
          <ClipboardList size={220} className="text-blue-500" />
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pacientes */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-1">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Pacientes</div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{data.totalPacientes}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total en sistema</div>
          </div>
        </div>
        {/* Citas del mes */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center mb-1">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Citas del mes</div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.citasMes}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Agendadas</div>
          </div>
        </div>
        {/* Consultas hoy */}
        <div className="card rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 flex items-center justify-center mb-1">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">Consultas hoy</div>
            <div className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
              {data.stats.total} <span className="text-sm font-medium text-orange-400/80">/ 25</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{data.stats.total === 0 ? 'Aún no hay consultas' : `${data.stats.atendidas} atendidas`}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Consultas de hoy y Consejo */}
        <div className="space-y-6 flex flex-col">
          <div className="card rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Users size={18} className="text-slate-400" /> Consultas de hoy
              </h3>
              <div className="text-[11px] font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-100 dark:border-orange-800/50">
                {data.stats.total} / 25
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {data.todays && data.todays.length > 0 ? (
                data.todays.map((cita: any) => {
                  const hora = new Date(cita.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={cita.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex justify-between items-center transition hover:border-blue-200 dark:hover:border-blue-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {cita.patient?.fullName?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">{cita.patient?.fullName || 'Paciente'}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">{cita.status}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md">
                          {hora}
                        </div>
                        {cita.status !== 'ATENDIDA' && cita.status !== 'CANCELADA' && (
                          <button 
                            onClick={() => updateStatus.mutate({ id: cita.id, status: 'ATENDIDA' })}
                            className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                            title="Marcar como atendida"
                          >
                            <span className="material-symbols-rounded text-[16px] font-bold">check</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm p-4">
                  <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                    <CalendarCheck size={20} className="text-slate-300" />
                  </div>
                  No tienes consultas agendadas para el día de hoy.
                </div>
              )}
            </div>
          </div>

          {/* Consejo del día */}
          <div className="bg-[#eff6ff] dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4 flex items-start gap-4 relative shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex shrink-0 items-center justify-center shadow-md">
              <Shield size={20} />
            </div>
            <div className="pr-6">
              <div className="font-bold text-slate-800 dark:text-blue-400 text-sm mb-1">Consejo del día</div>
              <div className="text-xs text-slate-600 dark:text-blue-300 leading-relaxed">
                No olvides revisar tus citas programadas y actualizar la información de tus pacientes.
              </div>
            </div>
            <button className="absolute top-4 right-4 text-blue-400 hover:text-blue-600 transition">
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Actividad reciente */}
        <div className="card rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200 mb-6 border-b border-slate-50 dark:border-slate-700 pb-4">
            <TrendingUp size={18} className="text-slate-400" /> Actividad reciente
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-6 py-2">
            
            {data.activities && data.activities.length > 0 ? data.activities.slice(0, 3).map((act: any, idx: number) => {
              const date = new Date(act.date);
              const isPatient = act.type === 'NEW_PATIENT';
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center ${
                    isPatient ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-500'
                  }`}>
                    {isPatient ? <UserPlus size={18} /> : <CalendarIcon size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">{act.title}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{act.subtitle}</div>
                  </div>
                  <div className="text-[10px] text-slate-400 text-right shrink-0 leading-tight capitalize">
                    {date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}<br/>
                    {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-slate-400 text-sm py-4">No hay actividad reciente.</div>
            )}
          </div>

          {data.activities && data.activities.length > 0 && (
            <button 
              onClick={() => setShowActivityModal(true)}
              className="w-full mt-6 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1"
            >
              Ver toda la actividad de hoy <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Actividad */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" /> Actividad de hoy
              </h2>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
              {data.activities?.map((act: any, idx: number) => {
                const date = new Date(act.date);
                const isPatient = act.type === 'NEW_PATIENT';
                return (
                  <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition hover:border-blue-200 dark:hover:border-slate-600">
                    <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center ${
                      isPatient ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-500'
                    }`}>
                      {isPatient ? <UserPlus size={18} /> : <CalendarIcon size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">{act.title}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{act.subtitle}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 text-right shrink-0 leading-tight capitalize">
                      {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
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
