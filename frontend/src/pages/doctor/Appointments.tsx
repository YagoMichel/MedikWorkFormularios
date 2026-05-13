import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../stores/auth';

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

export default function Appointments() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [selected, setSelected] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);

  const { data: events = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => (await api.get('/appointments')).data,
  });

  const create = useMutation({
    mutationFn: async (data: any) => (await api.post('/batches', data)).data,
    onSuccess: () => { toast.success('Cita empresarial creada'); qc.invalidateQueries({ queryKey: ['appointments'] }); setShowForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/appointments/${id}`)).data,
    onSuccess: () => { toast.success('Cita eliminada'); qc.invalidateQueries({ queryKey: ['appointments'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  // Agrupa citas por día. Las empresariales (batchId) se colapsan en una sola entrada por batch.
  const eventsByDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of events) {
      const d = new Date(a.date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      const list = m.get(k)!;
      if (a.batchId) {
        const existing = list.find((e: any) => e.batchId === a.batchId);
        if (existing) { existing._count = (existing._count || 1) + 1; continue; }
        list.push({ ...a, _count: 1, _isBatch: true });
      } else {
        list.push(a);
      }
    }
    return m;
  }, [events]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // Semana actual (lunes a domingo)
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => openNew(selected)} className="btn btn-primary inline-flex items-center gap-1">
          <span className="material-symbols-rounded text-base">add_circle</span> Nueva cita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Mini calendario */}
        <div className="card p-5 h-fit">
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
                  style={isActive ? { background: '#3375c8', color: '#fff', boxShadow: '0 2px 8px rgba(51,117,200,0.4)' }
                    : isToday ? { color: '#3375c8', outline: '1px solid #6ec0db' }
                    : isMuted ? { color: '#cbd5e1' } : { color: '#475569' }}
                >
                  {d.getDate()}
                  {hasEvent && !isActive && <span className="absolute bottom-1 w-[4px] h-[4px] rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>
        </div>

      <div className="card p-0 overflow-hidden">
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

        {/* Grilla semanal */}
        <div className="grid grid-cols-7 divide-x divide-slate-100">
          {weekDays.map((d, i) => {
            const list = eventsByDay.get(dayKey(d)) || [];
            const isToday = sameDay(d, new Date());
            const isSelected = sameDay(d, selected);
            return (
              <div key={i}
                className="min-h-[200px] p-3 cursor-pointer transition"
                style={isSelected ? { background: 'color-mix(in srgb, #3375c8 12%, var(--bg-card))' } : {}}
                onClick={() => setSelected(new Date(d))}
              >
                {/* Cabecera día */}
                <div className="mb-2">
                  <div className="text-[11px] font-bold uppercase" style={{ color: isToday || isSelected ? '#3375c8' : '#94a3b8' }}>
                    {DOW_LONG[d.getDay()].slice(0,3)}
                  </div>
                  <div
                    className="text-xl font-extrabold w-8 h-8 flex items-center justify-center rounded-full"
                    style={isToday
                      ? { background: '#3375c8', color: '#fff' }
                      : isSelected
                        ? { background: '#e0eeff', color: '#3375c8' }
                        : { color: '#334155' }}
                  >
                    {d.getDate()}
                  </div>
                </div>

                {/* Citas del día */}
                <div className="flex flex-col gap-1.5">
                  {list.map((a: any) => a._isBatch ? (
                    <div
                      key={a.batchId}
                      className="rounded-lg px-2 py-1.5 border-l-[3px] text-[11px]"
                      style={{ borderLeftColor: '#3375c8', backgroundColor: '#3375c820' }}
                    >
                      <div className="font-semibold text-slate-800 truncate">{a.batch?.company?.name || 'Empresa'}</div>
                      <div className="text-slate-500">{a._count} pacientes · 08:00</div>
                    </div>
                  ) : (
                    <div
                      key={a.id}
                      className="rounded-lg px-2 py-1.5 border-l-[3px] text-[11px] group relative"
                      style={{ borderLeftColor: a.color || DEFAULT_COLOR, backgroundColor: (a.color || DEFAULT_COLOR) + '20' }}
                    >
                      <div className="font-semibold text-slate-800 truncate">{a.patient.fullName}</div>
                      <button
                        onClick={() => setConfirmDelete({ id: a.id, name: a.patient.fullName })}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition"
                      >
                        <span className="material-symbols-rounded text-[15px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Click para agendar */}
                <button
                  onClick={() => openNew(d)}
                  className="mt-2 w-full text-[10px] text-slate-300 hover:text-slate-400 hover:bg-slate-50 rounded py-1 transition text-center"
                >
                  + agregar
                </button>
              </div>
            );
          })}
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
