import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { Link } from 'react-router-dom';
import { Users, Calendar as CalendarIcon, Clock, TrendingUp, CalendarCheck, Shield, ChevronRight, UserPlus, FileText, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

import { useState, useEffect } from 'react';
import { socket } from '../../services/socket';
import FeedbackApproval from './FeedbackApproval';

export default function DoctorDashboard() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    const handler = () => qc.invalidateQueries({ queryKey: ['dashboard-doctor'] });
    socket.on('appointments:updated', handler);
    socket.on('newAppointment', handler);
    socket.on('newBatch', handler);
    socket.on('batch:updated', handler);
    socket.on('batch:status_updated', handler);
    socket.on('newPatient', handler);
    return () => {
      socket.off('appointments:updated', handler);
      socket.off('newAppointment', handler);
      socket.off('newBatch', handler);
      socket.off('batch:updated', handler);
      socket.off('batch:status_updated', handler);
      socket.off('newPatient', handler);
    };
  }, [qc]);

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

  const updateBatchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      return (await api.put(`/batches/${id}`, { status })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-doctor'] });
      qc.invalidateQueries({ queryKey: ['doctor-calendar'] });
      toast.success('Jornada completada exitosamente');
    },
    onError: () => toast.error('Error al completar la jornada'),
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 p-8 md:p-10 flex justify-between items-center shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="z-10 max-w-xl">
          <h1 className="text-4xl font-extrabold text-white mb-3 flex items-center gap-3 drop-shadow-sm">
            ¡{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Doctor'}! <span className="text-3xl animate-bounce">👋</span>
          </h1>
          <p className="text-white/90 text-lg font-medium">
            Aquí tienes un resumen de tu actividad y citas para el día de hoy.
          </p>
        </div>
        
        {/* Avatar */}
        <div className="relative z-10 hidden sm:block shrink-0">
          <button onClick={() => setShowPhotoModal(true)} className="block w-28 h-28 rounded-full flex items-center justify-center text-3xl font-extrabold text-[#2560aa] shadow-2xl overflow-hidden border-4 border-white bg-white transition-transform hover:scale-105 cursor-pointer">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.fullName?.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U'
            )}
          </button>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
          <ClipboardList size={260} className="text-white" />
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pacientes */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2560aa]/10 to-[#51abcd]/10 dark:from-[#2560aa]/30 dark:to-[#51abcd]/30 text-[#2560aa] flex items-center justify-center shrink-0">
            <Users size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Pacientes en sistema</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{data.totalPacientes}</div>
          </div>
        </div>
        {/* Citas del mes */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#51abcd]/10 to-[#2560aa]/10 text-[#51abcd] flex items-center justify-center shrink-0">
            <CalendarIcon size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Citas este mes</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{data.citasMes}</div>
          </div>
        </div>
        {/* Consultas hoy */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Consultas hoy</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">
              {data.stats.total} <span className="text-lg font-medium text-slate-400">/ 20</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Consultas de hoy y Consejo */}
        <div className="space-y-6 flex flex-col">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex flex-col h-[420px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Users size={20} className="text-[#2560aa]" /> Consultas programadas
              </h3>
              <div className="text-xs font-bold bg-[#51abcd]/10 text-[#2560aa] px-4 py-1.5 rounded-full">
                {data.stats.total} pendientes
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-3 space-y-3 custom-scrollbar">
              {(() => {
                const combined = [
                  ...(data.todays || []),
                  ...(data.todaysBatches || []).map((b: any) => ({ ...b, isBatch: true }))
                ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (combined.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm p-4">
                      <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <CalendarCheck size={24} className="text-slate-300" />
                      </div>
                      <p className="font-medium text-slate-500">No hay consultas ni jornadas programadas para hoy.</p>
                    </div>
                  );
                }

                return combined.map((cita: any) => {
                  const isBatch = cita.isBatch;
                  const title = isBatch ? (cita.company?.name === 'Sin Empresa' ? 'Jornada (Sin Empresa)' : `Jornada: ${cita.company?.name}`) : (cita.patient?.fullName || 'Cita');
                  const initial = isBatch ? 'J' : (cita.patient?.fullName?.charAt(0).toUpperCase() || 'P');
                  const hora = new Date(cita.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                  const subtitle = isBatch ? `${cita.expectedCount} pacientes esperados` : cita.status;
                  
                  return (
                    <div key={isBatch ? `b-${cita.id}` : cita.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 flex justify-between items-center transition hover:shadow-md hover:border-[#51abcd]/30 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${isBatch ? 'bg-gradient-to-br from-[#51abcd] to-[#2560aa]' : 'bg-gradient-to-br from-[#2560aa] to-[#51abcd]'} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}>
                          {initial}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#2560aa] transition-colors">{title}</div>
                          <div className="text-xs text-slate-500 font-medium">
                            {subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                          {!isBatch && (
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 shadow-sm px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-600">
                              {hora}
                            </div>
                          )}
                        {(isBatch ? cita.status !== 'CERRADO' && cita.status !== 'CANCELADO' : cita.status !== 'ATENDIDA' && cita.status !== 'CANCELADA') && (
                          <button 
                            onClick={() => {
                              if (isBatch) {
                                updateBatchStatus.mutate({ id: cita.id, status: 'CERRADO' });
                              } else {
                                updateStatus.mutate({ id: cita.id, status: 'ATENDIDA' });
                              }
                            }}
                            className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-500 hover:text-white text-emerald-600 flex items-center justify-center transition-all shadow-sm"
                            title="Marcar como completada"
                          >
                            <span className="material-symbols-rounded text-[18px] font-bold">check</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Consejo de seguridad */}
          <div className="bg-white dark:bg-[#1a2332] rounded-3xl p-6 flex items-start gap-5 relative shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800/60">
            <div className="w-12 h-12 rounded-2xl bg-[#2560aa]/10 dark:bg-white/5 text-[#2560aa] dark:text-[#51abcd] flex shrink-0 items-center justify-center">
              <Shield size={24} />
            </div>
            <div className="pr-6">
              <div className="font-extrabold text-slate-800 dark:text-white text-base mb-1">Consejo de seguridad</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Recuerda mantener la confidencialidad de los diagnósticos y bloquear tu sesión al alejarte.
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Actividad reciente */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex flex-col h-full">
          <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-50 dark:border-slate-700 pb-5">
            <TrendingUp size={20} className="text-[#51abcd]" /> Actividad reciente
          </h3>
          <div className="flex-1 flex flex-col justify-start space-y-6 pt-2">
            
            {data.activities && data.activities.length > 0 ? data.activities.slice(0, 4).map((act: any, idx: number) => {
              const date = new Date(act.date);
              const isPatient = act.type === 'NEW_PATIENT';
              const isBatch = act.type === 'NEW_BATCH';
              const isIndividual = act.type === 'NEW_APPOINTMENT';
              
              let bgColor = isPatient ? 'bg-emerald-50 dark:bg-emerald-900/20' : isBatch ? 'bg-[#51abcd]/10 dark:bg-[#51abcd]/20' : 'bg-[#2560aa]/10 dark:bg-[#2560aa]/20';
              let textColor = isPatient ? 'text-emerald-500' : isBatch ? 'text-[#51abcd]' : 'text-[#2560aa]';
              
              return (
                <div key={idx} className="flex items-center gap-4 group cursor-default">
                  <div className={`w-12 h-12 rounded-2xl flex shrink-0 items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${bgColor} ${textColor}`}>
                    {isPatient ? <UserPlus size={20} /> : <CalendarIcon size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold text-slate-800 dark:text-slate-200 truncate transition-colors group-hover:${textColor}`}>{act.title}</div>
                    <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{act.subtitle}</div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 text-right shrink-0 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            }) : (
              <div className="flex-1 flex items-center justify-center text-center text-slate-400 text-sm py-4 font-medium">No hay actividad reciente.</div>
            )}
          </div>

          {data.activities && data.activities.length > 0 && (
            <button 
              onClick={() => setShowActivityModal(true)}
              className="w-full mt-8 py-3.5 text-sm font-bold text-[#2560aa] border-2 border-[#2560aa]/10 rounded-xl hover:bg-[#2560aa] hover:text-white transition-all flex items-center justify-center gap-2"
            >
              Ver todo el historial <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Actividad */}
      <FeedbackApproval />

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
                const isBatch = act.type === 'NEW_BATCH';
                const isIndividual = act.type === 'NEW_APPOINTMENT';
                
                let bgColor = isPatient ? 'bg-emerald-50 dark:bg-emerald-900/20' : isBatch ? 'bg-[#51abcd]/10 dark:bg-[#51abcd]/20' : 'bg-[#2560aa]/10 dark:bg-[#2560aa]/20';
                let textColor = isPatient ? 'text-emerald-500' : isBatch ? 'text-[#51abcd]' : 'text-[#2560aa]';

                return (
                  <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition hover:border-slate-300 dark:hover:border-slate-600">
                    <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center ${bgColor} ${textColor}`}>
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
      {/* Modal de Foto de Perfil */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] fade-in" onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-sm w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-12 right-0 md:-right-12 text-white/70 hover:text-white transition-colors p-2"
            >
              <span className="material-symbols-rounded text-4xl">close</span>
            </button>
            <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white flex items-center justify-center text-8xl font-extrabold text-[#2560aa] animate-scale-in">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="Profile Large" className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
