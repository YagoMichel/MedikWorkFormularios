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
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
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
  const countCompletadas = selectedEvents.filter((a: any) => a.status === 'ATENDIDA').length;
  const countPendientes = countProgramadas - countCompletadas;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => openNew(selected)} className="btn btn-primary inline-flex items-center gap-1">
          <span className="material-symbols-rounded text-base">add_circle</span> Nueva cita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* Mini calendario */}
          <div className="card p-5 h-fit shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-extrabold capitalize">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h4>
              <div className="flex gap-1">
                <button className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  <span className="material-symbols-rounded text-[18px]">chevron_left</span>
                </button>
                <button className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  <span className="material-symbols-rounded text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
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
                    className="relative aspect-square flex items-center justify-center text-[11px] font-semibold rounded-lg transition"
                    style={isActive ? { background: '#3b82f6', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }
                      : isToday ? { color: '#3b82f6', outline: '1px solid #93c5fd' }
                      : isMuted ? { color: '#cbd5e1' } : { color: '#475569' }}
                  >
                    {d.getDate()}
                    {hasEvent && !isActive && <span className="absolute bottom-1 w-[4px] h-[4px] rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen del día */}
          <div className="card p-5 shadow-sm">
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mb-4">Resumen del día</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                <div className="flex items-center gap-3">
                  <CalendarIcon size={16} className="text-purple-600 dark:text-purple-400"/>
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Citas programadas</span>
                </div>
                <span className="font-extrabold text-slate-800 dark:text-white">{countProgramadas}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-orange-500 dark:text-orange-400"/>
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Pendientes</span>
                </div>
                <span className="font-extrabold text-slate-800 dark:text-white">{countPendientes}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-emerald-500 dark:text-emerald-400"/>
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Completadas</span>
                </div>
                <span className="font-extrabold text-slate-800 dark:text-white">{countCompletadas}</span>
              </div>
            </div>

          </div>
        </div>

      <div className="card p-0 overflow-hidden shadow-sm flex flex-col">
        {/* Header semana */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
          <h3 className="text-base font-extrabold capitalize">{weekLabel}</h3>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition" onClick={prevWeek}>
              <span className="material-symbols-rounded text-[18px]">chevron_left</span>
            </button>
            <button className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200" onClick={goToday}>Hoy</button>
            <button className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition" onClick={nextWeek}>
              <span className="material-symbols-rounded text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Grilla semanal horaria */}
        <div className="flex flex-col relative bg-slate-50/30 dark:bg-slate-900/50" style={{ minHeight: '780px' }}>
          <div className="flex flex-1">
            {/* Eje de tiempo */}
            <div className="w-14 shrink-0 border-r border-slate-100 dark:border-slate-800 relative bg-white dark:bg-slate-900 z-10">
              <div className="h-[70px]"></div>
              {Array.from({ length: 13 }, (_, i) => 7 + i).map(hour => (
                <div key={hour} className="h-[60px] relative">
                  <span className="absolute -top-2.5 right-2 text-[10px] text-slate-400 font-semibold">{String(hour).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800 relative">
              
              {/* Lineas horizontales de fondo */}
              <div className="absolute inset-0 pointer-events-none mt-[70px]">
                {Array.from({ length: 13 }, (_, i) => (
                  <div key={i} className="h-[60px] border-b border-slate-100 dark:border-slate-800/50 w-full" />
                ))}
              </div>

              {weekDays.map((d, i) => {
                const list = eventsByDay.get(dayKey(d)) || [];
                const isToday = sameDay(d, new Date());
                const isSelected = sameDay(d, selected);
                return (
                  <div key={i} className="relative cursor-pointer transition hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                    onClick={() => setSelected(new Date(d))}
                    style={isSelected ? { backgroundColor: 'rgba(59, 130, 246, 0.05)' } : {}}
                  >
                    {/* Cabecera del día */}
                    <div className="h-[70px] flex flex-col items-center justify-center border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-[10px] font-bold uppercase mb-1" style={{ color: isToday || isSelected ? '#3b82f6' : '#94a3b8' }}>
                        {DOW_SHORT[d.getDay()]}
                      </div>
                      <div className="text-base font-extrabold w-8 h-8 flex items-center justify-center rounded-full mb-1"
                        style={isToday ? { background: '#3b82f6', color: '#fff' } : isSelected ? { background: '#eff6ff', color: '#3b82f6' } : { color: 'inherit' }}
                      >
                        {d.getDate()}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); openNew(d); }} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition">+ Agregar</button>
                    </div>

                    {/* Contenedor de eventos */}
                    <div className="relative mt-1 overflow-hidden" style={{ height: '720px' }}>
                      {list.map((a: any) => {
                        const date = new Date(a.date);
                        let hour = date.getHours();
                        let min = date.getMinutes();
                        if (hour < 7) hour = 7;
                        if (hour > 19) hour = 19;
                        
                        const top = (hour - 7) * 60 + min;
                        const height = (a.durationMin || 30);
                        const isBatch = a._isBatch;
                        const isPending = a.status === 'AGENDADA' || a.status === 'BORRADOR';
                        
                        const bg = isBatch ? 'var(--tw-colors-blue-50, #eff6ff)' : isPending ? 'var(--tw-colors-purple-50, #f5f3ff)' : 'var(--tw-colors-blue-50, #eff6ff)';
                        const border = isBatch ? '#3b82f6' : isPending ? '#8b5cf6' : '#3b82f6';
                        
                        return (
                          <div
                            key={a.id || a.batchId}
                            className="absolute left-1 right-1 rounded-md p-1.5 border-l-[3px] shadow-sm overflow-hidden group flex flex-col"
                            style={{ top: `${top}px`, height: `${height}px`, backgroundColor: bg, borderLeftColor: border, zIndex: 20 }}
                          >
                            <div className="font-bold text-slate-800 dark:text-slate-900 flex items-center gap-1 text-[11px] leading-tight truncate">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: border }}></span>
                              {a.company?.name || a.batch?.company?.name || a.patient?.fullName || 'Paciente'}
                            </div>
                            <div className="text-slate-500 dark:text-slate-600 text-[10px] truncate pl-2.5 mt-0.5">
                              {a.expectedCount ? `${a.expectedCount} pacientes · ` : ''}{date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="pl-2.5 mt-0.5">
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: isPending ? 'var(--tw-colors-purple-100, #ede9fe)' : 'var(--tw-colors-blue-100, #dbeafe)', color: border }}>
                                {isPending ? 'Pendiente' : 'Completada'}
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
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Footer Leyenda */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div> Consulta
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div> Cita programada
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div> Pendiente
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Completada
              </div>
            </div>

          </div>
        </div>
      </div>

      </div>{/* end grid */}

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
        <h2 className="text-lg font-bold mb-4">Nueva cita empresarial</h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <select className="input" required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">— Empresa —</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" type="number" min={1} max={500} required placeholder="Cantidad de pacientes" value={form.expectedCount} onChange={(e) => setForm({ ...form, expectedCount: e.target.value })} />
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
