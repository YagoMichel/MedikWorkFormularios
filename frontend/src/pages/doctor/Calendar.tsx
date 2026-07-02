// =============================================================
// ARCHIVO: src/pages/doctor/Calendar.tsx
// SECCION: DOCTOR (tuyo)
// DESCRIPCION: Calendario semanal de citas del doctor.
//              Permite ver, crear y eliminar citas.
//              El admin tambien puede ver esta vista en solo lectura.
// =============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../stores/auth';
import { Calendar as CalendarIcon, Clock, CheckCircle } from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#51abcd', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#6366f1',
];
const DEFAULT_COLOR = '#3b82f6';
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOW_SHORT = ['LU','MA','MI','JU','VI','SA','DO'];
const DOW_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function Calendar() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [selected, setSelected] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  const [selectedEventInfo, setSelectedEventInfo] = useState<any>(null);

  const { data: events = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => (await api.get('/appointments')).data,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await api.get('/batches')).data,
  });

  const create = useMutation({
    mutationFn: async (data: any) => (await api.post('/batches', data)).data,
    onSuccess: () => { toast.success('Cita empresarial creada'); qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['batches'] }); setShowForm(false); },
    onError: (e: any) => {
      console.error(e);
      toast.error(e.response?.data?.error || e.message || 'Error desconocido al crear cita');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/appointments/${id}`)).data,
    onSuccess: () => { toast.success('Cita eliminada'); qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['batches'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  const eventsByDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of events) {
      if (a.batchId) continue;
      const d = new Date(a.date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    for (const b of batches) {
      const d = new Date(b.date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push({ ...b, _isBatch: true });
    }
    return m;
  }, [events, batches]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const weekStart = useMemo(() => {
    const d = new Date(selected);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0,0,0,0);
    return d;
  }, [selected]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }), [weekStart]);

  const weekLabel = (() => {
    const end = weekDays[6];
    return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
  })();

  const prevWeek = () => { const d = new Date(selected); d.setDate(d.getDate() - 7); setSelected(d); };
  const nextWeek = () => { const d = new Date(selected); d.setDate(d.getDate() + 7); setSelected(d); };
  const goToday  = () => { const d = new Date(); d.setHours(0,0,0,0); setSelected(d); };

  const openNew = (forDate?: Date) => {
    setSelected(forDate || new Date());
    setShowForm(true);
  };

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });

  const calCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const selectedEvents = eventsByDay.get(dayKey(selected)) || [];
  const countProgramadas = selectedEvents.length;
  const countCompletadas = selectedEvents.filter((a: any) => {
    const isExplicitlyCompleted = a.status === 'ATENDIDA' || a.status === 'COMPLETADA' || a.status === 'CERRADO';
    if (isExplicitlyCompleted) return true;
    const isCanceled = a.status === 'CANCELADA' || a.status === 'NO_ASISTIO' || a.status === 'CANCELADO';
    if (isCanceled) return false;
    
    // TODAS las citas (individuales y empresariales) se completan solo al fin del día
    const dayEnd = new Date(new Date(a.date).setHours(23, 59, 59, 999));
    return dayEnd.getTime() < new Date().getTime();
  }).length;
  const countCanceladas = selectedEvents.filter((a: any) => a.status === 'CANCELADA' || a.status === 'NO_ASISTIO' || a.status === 'CANCELADO').length;
  const countPendientes = countProgramadas - countCompletadas - countCanceladas;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end mb-2">
        <button onClick={() => openNew(selected)} className="px-5 py-2.5 bg-[#2560aa] hover:bg-[#1c4b85] text-white font-bold rounded-xl shadow-lg shadow-[#2560aa]/30 transition-all inline-flex items-center gap-2 hover:scale-105">
          <span className="material-symbols-rounded text-lg">add_circle</span> Nueva cita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* Mini calendario */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 h-fit">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-extrabold capitalize text-slate-800 dark:text-white">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h4>
              <div className="flex gap-1">
                <button className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-50 hover:bg-[#51abcd]/10 text-slate-500 hover:text-[#2560aa] transition"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  <span className="material-symbols-rounded text-[18px]">chevron_left</span>
                </button>
                <button className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-50 hover:bg-[#51abcd]/10 text-slate-500 hover:text-[#2560aa] transition"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  <span className="material-symbols-rounded text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
              {DOW_SHORT.map((l) => (
                <div key={l} className="text-center text-[10px] font-extrabold text-slate-400 pb-2">{l}</div>
              ))}
              {calCells.map((d, i) => {
                const isMuted = d.getMonth() !== cursor.getMonth();
                const isActive = sameDay(d, selected);
                const isToday = sameDay(d, new Date());
                const hasEvent = (eventsByDay.get(dayKey(d)) || []).length > 0;
                return (
                  <button key={i}
                    onClick={() => { setSelected(new Date(d)); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                    className="relative aspect-square flex items-center justify-center text-[12px] font-bold rounded-xl transition-all"
                    style={isActive ? { background: '#2560aa', color: '#fff', boxShadow: '0 4px 10px rgba(37, 96, 170, 0.3)', transform: 'scale(1.05)' }
                      : isToday ? { color: '#2560aa', border: '2px solid #51abcd' }
                      : isMuted ? { color: '#cbd5e1' } : { color: '#475569' }}
                  >
                    {d.getDate()}
                    {hasEvent && !isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#51abcd]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen del día */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mb-5">Resumen del día</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#2560aa]/5 border border-[#2560aa]/10 transition hover:bg-[#2560aa]/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2560aa]/10 flex items-center justify-center text-[#2560aa]">
                    <CalendarIcon size={16} strokeWidth={2.5}/>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Citas programadas</span>
                </div>
                <span className="font-extrabold text-lg text-[#2560aa]">{countProgramadas}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#51abcd]/5 border border-[#51abcd]/10 transition hover:bg-[#51abcd]/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#51abcd]/10 flex items-center justify-center text-[#51abcd]">
                    <Clock size={16} strokeWidth={2.5}/>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Pendientes</span>
                </div>
                <span className="font-extrabold text-lg text-[#51abcd]">{countPendientes}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 transition hover:bg-emerald-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500">
                    <CheckCircle size={16} strokeWidth={2.5}/>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Completadas</span>
                </div>
                <span className="font-extrabold text-lg text-emerald-600">{countCompletadas}</span>
              </div>
            </div>
          </div>
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex flex-col">
        {/* Header semana */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-wrap gap-3 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-lg font-extrabold capitalize text-[#2560aa] dark:text-white">{weekLabel}</h3>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#51abcd] hover:text-[#2560aa] text-slate-600 transition" onClick={prevWeek}>
              <span className="material-symbols-rounded text-[18px]">chevron_left</span>
            </button>
            <button className="text-sm font-bold px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#51abcd] hover:text-[#2560aa] text-slate-600 transition" onClick={goToday}>Hoy</button>
            <button className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#51abcd] hover:text-[#2560aa] text-slate-600 transition" onClick={nextWeek}>
              <span className="material-symbols-rounded text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Grilla semanal horaria */}
        <div className="flex flex-col relative bg-slate-50/20 dark:bg-slate-900/50" style={{ minHeight: '780px' }}>
          <div className="flex flex-1">
            {/* Eje de tiempo */}
            <div className="w-16 shrink-0 border-r border-slate-100 dark:border-slate-800 relative bg-white dark:bg-slate-900 z-10">
              <div className="h-[75px]"></div>
              {Array.from({ length: 13 }, (_, i) => 7 + i).map(hour => (
                <div key={hour} className="h-[60px] relative">
                  <span className="absolute -top-2.5 right-3 text-[11px] text-slate-400 font-bold">{String(hour).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800 relative">
              
              {/* Lineas horizontales de fondo */}
              <div className="absolute inset-0 pointer-events-none mt-[75px]">
                {Array.from({ length: 13 }, (_, i) => (
                  <div key={i} className="h-[60px] border-b border-slate-100/60 dark:border-slate-800/50 w-full" />
                ))}
              </div>

              {weekDays.map((d, i) => {
                const list = eventsByDay.get(dayKey(d)) || [];
                const isToday = sameDay(d, new Date());
                const isSelected = sameDay(d, selected);
                return (
                  <div key={i} className="relative cursor-pointer transition hover:bg-[#51abcd]/5 dark:hover:bg-[#2560aa]/10"
                    onClick={() => setSelected(new Date(d))}
                    style={isSelected ? { backgroundColor: 'rgba(37, 96, 170, 0.04)' } : {}}
                  >
                    {/* Cabecera del día */}
                    <div className="h-[75px] flex flex-col items-center justify-center border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-[10px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: isToday || isSelected ? '#2560aa' : '#94a3b8' }}>
                        {DOW_SHORT[d.getDay()]}
                      </div>
                      <div className="text-lg font-black w-9 h-9 flex items-center justify-center rounded-full mb-1 transition-all"
                        style={isToday ? { background: '#2560aa', color: '#fff', boxShadow: '0 4px 10px rgba(37, 96, 170, 0.3)' } : isSelected ? { background: '#51abcd', color: '#fff', boxShadow: '0 4px 10px rgba(81, 171, 205, 0.3)' } : { color: 'inherit' }}
                      >
                        {d.getDate()}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); openNew(d); }} className="text-[10px] font-bold text-[#51abcd] hover:text-[#2560aa] transition opacity-0 group-hover:opacity-100">+ Agregar</button>
                    </div>

                    {/* Contenedor de eventos */}
                    <div className="relative mt-1 overflow-hidden" style={{ height: '720px' }}>
                      {(() => {
                        const sortedList = [...list].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
                        const layoutItems = sortedList.map(a => {
                          const date = new Date(a.date);
                          let hour = date.getHours();
                          let min = date.getMinutes();
                          if (hour < 7) hour = 7;
                          if (hour > 19) hour = 19;
                          const top = (hour - 7) * 60 + min;
                          const height = Math.max((a.durationMin || 30), 68); 
                          return { a, date, top, bottom: top + height, col: 0 };
                        });
                        
                        const columns: typeof layoutItems[] = [];
                        for (const item of layoutItems) {
                          let placed = false;
                          for (let i = 0; i < columns.length; i++) {
                            const lastItem = columns[i][columns[i].length - 1];
                            if (lastItem.bottom <= item.top) {
                              columns[i].push(item);
                              item.col = i;
                              placed = true;
                              break;
                            }
                          }
                          if (!placed) {
                            item.col = columns.length;
                            columns.push([item]);
                          }
                        }
                        const maxCol = columns.length || 1;
                        
                        return layoutItems.map(({ a, date, top, col }) => {
                          const height = (a.durationMin || 30);
                          const isBatch = a._isBatch;
                          
                          const eventEnd = new Date(new Date(a.date).setHours(23, 59, 59, 999));
                          const hasPassed = eventEnd.getTime() < new Date().getTime();
                          const isCompleted = a.status === 'ATENDIDA' || a.status === 'COMPLETADA' || a.status === 'CERRADO' || (hasPassed && a.status !== 'CANCELADA' && a.status !== 'CANCELADO' && a.status !== 'NO_ASISTIO');
                          
                          const isPending = !isBatch && !isCompleted;
                          
                          const isSinEmpresa = isBatch && (a.company?.name === 'Sin Empresa' || a.batch?.company?.name === 'Sin Empresa');
                          const label = isSinEmpresa ? 'Individual' : isBatch ? 'Empresarial' : isCompleted ? 'Completada' : 'Pendiente';
                          
                          const bg = isCompleted ? '#f0fdf4' : (isBatch && !isSinEmpresa) ? 'rgba(81,171,205,0.1)' : 'rgba(37,96,170,0.05)';
                          const border = isCompleted ? '#10b981' : (isBatch && !isSinEmpresa) ? '#51abcd' : '#2560aa';
                          const textBadge = isCompleted ? '#10b981' : (isBatch && !isSinEmpresa) ? '#51abcd' : '#2560aa';
                          const bgBadge = isCompleted ? 'rgba(16,185,129,0.1)' : (isBatch && !isSinEmpresa) ? 'rgba(81,171,205,0.1)' : 'rgba(37,96,170,0.1)';
                          
                          const leftPct = col * (100 / maxCol);
                          const widthPct = 100 / maxCol;
                          
                          return (
                            <div
                              key={a.id || a.batchId}
                              onClick={() => setSelectedEventInfo(a)}
                              className="absolute rounded-xl p-2 border border-slate-200/60 shadow-sm overflow-hidden group flex flex-col transition-all hover:scale-[1.02] hover:shadow-md hover:z-30 cursor-pointer"
                              style={{ 
                                top: `${top}px`, 
                                left: `calc(${leftPct}% + 4px)`, 
                                width: `calc(${widthPct}% - 8px)`, 
                                height: `${height}px`, 
                                minHeight: '68px', 
                                backgroundColor: bg, 
                                borderLeftColor: border, 
                                borderLeftWidth: '4px', 
                                zIndex: 20 + col 
                              }}
                            >
                              <div className="font-extrabold text-slate-800 dark:text-slate-900 flex items-center gap-1.5 text-[11px] leading-tight truncate">
                                {a.company?.name || a.batch?.company?.name || a.patient?.fullName || 'Paciente'}
                              </div>
                              <div className="text-slate-500 font-semibold text-[10px] truncate mt-0.5">
                                {a.expectedCount ? `${a.expectedCount} pac. · ` : ''}{date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="mt-1">
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ backgroundColor: bgBadge, color: textBadge }}>
                                  {label}
                                </span>
                              </div>
                              
                              {!isBatch && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: a.id, name: a.patient?.fullName }); }}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition"
                                >
                                  <span className="material-symbols-rounded text-[14px]">delete</span>
                                </button>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Footer Leyenda */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 mt-auto">
            <div className="flex gap-5 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-[#51abcd] shadow-sm"></div> Empresarial
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2560aa] shadow-sm"></div> Citas individuales
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Completada
              </div>
            </div>

          </div>
        </div>
      </div>

      </div>{/* end grid */}

      {selectedEventInfo && (() => {
        const a = selectedEventInfo;
        const isBatch = a._isBatch;
        
        const eventEnd = new Date(new Date(a.date).setHours(23, 59, 59, 999));
        const hasPassed = eventEnd.getTime() < new Date().getTime();
        const isCompleted = a.status === 'ATENDIDA' || a.status === 'COMPLETADA' || a.status === 'CERRADO' || (hasPassed && a.status !== 'CANCELADA' && a.status !== 'CANCELADO' && a.status !== 'NO_ASISTIO');
        
        const isSinEmpresa = isBatch && (a.company?.name === 'Sin Empresa' || a.batch?.company?.name === 'Sin Empresa');
        const label = isSinEmpresa ? 'Individual' : isBatch ? 'Empresarial' : isCompleted ? 'Completada' : 'Pendiente';
        
        const border = isCompleted ? '#10b981' : (isBatch && !isSinEmpresa) ? '#51abcd' : '#2560aa';
        const textBadge = isCompleted ? '#10b981' : (isBatch && !isSinEmpresa) ? '#51abcd' : '#2560aa';
        const bgBadge = isCompleted ? 'rgba(16,185,129,0.1)' : (isBatch && !isSinEmpresa) ? 'rgba(81,171,205,0.1)' : 'rgba(37,96,170,0.1)';

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative flex flex-col transform transition-all">
              
              {/* Top border bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: border }}></div>
              
              <div className="p-7 relative">
                <button onClick={() => setSelectedEventInfo(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center">
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
                
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 pr-8 mb-1 leading-tight">
                  {a.company?.name || a.batch?.company?.name || a.patient?.fullName || 'Paciente'}
                </h2>
                
                <div className="mb-6">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider" style={{ backgroundColor: bgBadge, color: textBadge }}>
                    {label}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: bgBadge, color: textBadge }}>
                      <span className="material-symbols-rounded">schedule</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 mb-0.5">FECHA Y HORA</div>
                      <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 leading-tight">
                        {new Date(a.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>
                        <span className="text-slate-500">{new Date(a.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isBatch && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: bgBadge, color: textBadge }}>
                        <span className="material-symbols-rounded">group</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400 mb-0.5">PACIENTES ESPERADOS</div>
                        <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 leading-tight">
                          {a.expectedCount} personas
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: bgBadge, color: textBadge }}>
                      <span className="material-symbols-rounded">check_circle</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 mb-0.5">ESTADO</div>
                      <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 leading-tight">
                        {isCompleted && a.status !== 'ATENDIDA' && a.status !== 'COMPLETADA' && a.status !== 'CERRADO' 
                          ? 'COMPLETADA (AUTOMÁTICO)' 
                          : a.status === 'BORRADOR' ? 'AGENDADA (PENDIENTE)' : a.status}
                      </div>
                    </div>
                  </div>
                </div>

                {a.notes && (
                  <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(241, 245, 249, 0.6)', border: '1px solid rgba(226, 232, 240, 0.6)' }}>
                    <div className="text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Notas adicionales</div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">{a.notes}</div>
                  </div>
                )}
                
                <div className="mt-8">
                  <button onClick={() => setSelectedEventInfo(null)} className="w-full py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5" style={{ backgroundColor: border }}>
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-red-600">Confirmar eliminación</h2>
            <p className="text-sm text-slate-600">¿Estás seguro que deseas eliminar <span className="font-semibold">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <AppointmentForm
          defaultDate={selected}
          onClose={() => setShowForm(false)}
          onSubmit={(d: any) => create.mutate(d)}
        />
      )}
    </div>
  );
}

function AppointmentForm({ defaultDate, onClose, onSubmit }: any) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const [form, setForm] = useState({
    companyId: '',
    date: toDateStr(defaultDate instanceof Date ? defaultDate : new Date()),
    expectedCount: '',
    notes: '',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSubmit({ companyId: form.companyId, date: form.date, expectedCount: Number(form.expectedCount), notes: form.notes });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Nueva jornada de citas</h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <select className="input" required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">— Empresa / Tipo —</option>
            <option value="SIN_EMPRESA">Sin empresa (Citas individuales)</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" type="number" min={1} max={25} required placeholder="Cantidad de pacientes (Máx. 25)" value={form.expectedCount} onChange={(e) => setForm({ ...form, expectedCount: e.target.value })} />
          <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Agendar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
