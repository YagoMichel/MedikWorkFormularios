// =============================================================
// ARCHIVO: src/pages/admin/CalendarView.tsx
// SECCION: ADMIN (compañero)
// DESCRIPCION: Vista de calendario read-only para el admin.
//              Muestra TODAS las citas agendadas incluyendo
//              las del bot. Distingue por origen: Bot, Manual, Empresarial.
//              Se refresca cada 30 segundos automaticamente.
// API: GET /api/appointments
// =============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOW_SHORT = ['LU','MA','MI','JU','VI','SA','DO'];
const DOW_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DEFAULT_COLOR = '#3375c8';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  AGENT: { label: 'Bot', color: '#8b5cf6' },
  MANUAL: { label: 'Manual', color: '#3375c8' },
  WALK_IN: { label: 'Walk-in', color: '#06b6d4' },
};

export default function CalendarView() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [detailAppt, setDetailAppt] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['appointments-admin'],
    queryFn: async () => (await api.get('/appointments')).data,
    refetchInterval: 30000,
  });

  const create = useMutation({
    mutationFn: async (data: any) => (await api.post('/appointments', data)).data,
    onSuccess: () => {
      toast.success('Cita creada');
      qc.invalidateQueries({ queryKey: ['appointments-admin'] });
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear cita'),
  });

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

  const calCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const weekStats = useMemo(() => {
    let total = 0, bot = 0, empresarial = 0;
    for (const d of weekDays) {
      const list = eventsByDay.get(dayKey(d)) || [];
      for (const a of list) {
        total++;
        if (a.source === 'AGENT') bot++;
        if (a._isBatch || a.type === 'EMPRESARIAL') empresarial++;
      }
    }
    return { total, bot, empresarial };
  }, [weekDays, eventsByDay]);

  if (isLoading) return <p className="text-slate-400 text-sm">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn btn-primary inline-flex items-center gap-1">
          <span className="material-symbols-rounded text-base">add_circle</span> Nueva cita
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Esta semana', value: weekStats.total, color: '#3375c8' },
          { label: 'Del bot', value: weekStats.bot, color: '#8b5cf6' },
          { label: 'Empresariales', value: weekStats.empresarial, color: '#06b6d4' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.color + '20' }}>
              <span className="material-symbols-rounded text-xl" style={{ color: s.color }}>calendar_month</span>
            </div>
            <div>
              <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-400 font-medium">{s.label}</div>
            </div>
          </div>
        ))}
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
              const list = eventsByDay.get(dayKey(d)) || [];
              const hasBot = list.some((a: any) => a.source === 'AGENT');
              const hasEvent = list.length > 0;
              return (
                <button key={i}
                  onClick={() => { setSelected(new Date(d)); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}
                  className="relative aspect-square flex items-center justify-center text-[11px] font-semibold rounded-lg transition"
                  style={isActive ? { background: '#3375c8', color: '#fff', boxShadow: '0 2px 8px rgba(51,117,200,0.4)' }
                    : isToday ? { color: '#3375c8', outline: '1px solid #6ec0db' }
                    : isMuted ? { color: '#cbd5e1' } : { color: '#475569' }}
                >
                  {d.getDate()}
                  {hasEvent && !isActive && (
                    <span className="absolute bottom-1 w-[4px] h-[4px] rounded-full"
                      style={{ background: hasBot ? '#8b5cf6' : '#f59e0b' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            {Object.entries(SOURCE_LABELS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: val.color }} />
                {val.label}
              </div>
            ))}
          </div>
        </div>

        {/* Vista semanal */}
        <div className="card p-0 overflow-hidden">
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

          <div className="grid grid-cols-7 divide-x divide-slate-100">
            {weekDays.map((d, i) => {
              const list = eventsByDay.get(dayKey(d)) || [];
              const isToday = sameDay(d, new Date());
              const isSelected = sameDay(d, selected);
              return (
                <div key={i}
                  className="min-h-[220px] p-3 cursor-pointer transition"
                  style={isSelected ? { background: 'color-mix(in srgb, #3375c8 8%, var(--bg-card))' } : {}}
                  onClick={() => setSelected(new Date(d))}
                >
                  <div className="mb-2">
                    <div className="text-[11px] font-bold uppercase" style={{ color: isToday || isSelected ? '#3375c8' : '#94a3b8' }}>
                      {DOW_LONG[d.getDay()].slice(0,3)}
                    </div>
                    <div className="text-xl font-extrabold w-8 h-8 flex items-center justify-center rounded-full"
                      style={isToday
                        ? { background: '#3375c8', color: '#fff' }
                        : isSelected
                          ? { background: '#e0eeff', color: '#3375c8' }
                          : { color: '#334155' }}
                    >
                      {d.getDate()}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {list.map((a: any) => {
                      if (a._isBatch) {
                        return (
                          <button key={a.batchId}
                            onClick={(e) => { e.stopPropagation(); setDetailAppt(a); }}
                            className="rounded-lg px-2 py-1.5 border-l-[3px] text-[11px] text-left w-full hover:opacity-80 transition"
                            style={{ borderLeftColor: '#06b6d4', backgroundColor: '#06b6d420' }}
                          >
                            <div className="font-semibold text-slate-800 truncate">{a.batch?.company?.name || 'Empresa'}</div>
                            <div className="text-slate-500">{a._count} pacientes · 08:00</div>
                            <div className="text-[10px] font-semibold mt-0.5" style={{ color: '#06b6d4' }}>Empresarial</div>
                          </button>
                        );
                      }
                      const src = SOURCE_LABELS[a.source] || SOURCE_LABELS.MANUAL;
                      const color = a.source === 'AGENT' ? '#8b5cf6' : (a.color || DEFAULT_COLOR);
                      return (
                        <button key={a.id}
                          onClick={(e) => { e.stopPropagation(); setDetailAppt(a); }}
                          className="rounded-lg px-2 py-1.5 border-l-[3px] text-[11px] text-left w-full hover:opacity-80 transition"
                          style={{ borderLeftColor: color, backgroundColor: color + '20' }}
                        >
                          <div className="font-semibold text-slate-800 truncate">{a.patient?.fullName || 'Paciente'}</div>
                          <div className="text-slate-500">{new Date(a.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-[10px] font-semibold mt-0.5" style={{ color }}>{src.label}</div>
                        </button>
                      );
                    })}
                    {list.length === 0 && (
                      <div className="text-[10px] text-slate-300 text-center pt-4">Sin citas</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal nueva cita */}
      {showForm && (
        <NewAppointmentForm
          defaultDate={selected}
          onClose={() => setShowForm(false)}
          onSubmit={(d: any) => create.mutate(d)}
        />
      )}

      {/* Modal detalle */}
      {detailAppt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setDetailAppt(null)}>
          <div className="card rounded-xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h2 className="text-base font-bold">Detalle de cita</h2>
              <button onClick={() => setDetailAppt(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {detailAppt._isBatch ? (
              <div className="space-y-2 text-sm">
                <Row label="Tipo" value="Empresarial" />
                <Row label="Empresa" value={detailAppt.batch?.company?.name || '—'} />
                <Row label="Pacientes" value={String(detailAppt._count)} />
                <Row label="Fecha" value={new Date(detailAppt.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <Row label="Hora" value="08:00 AM" />
                <Row label="Doctor" value={detailAppt.doctor?.fullName || '—'} />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Row label="Paciente" value={detailAppt.patient?.fullName || '—'} />
                <Row label="Fecha" value={new Date(detailAppt.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <Row label="Hora" value={new Date(detailAppt.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} />
                <Row label="Duración" value={`${detailAppt.durationMin ?? 20} min`} />
                <Row label="Doctor" value={detailAppt.doctor?.fullName || '—'} />
                <Row label="Origen" value={SOURCE_LABELS[detailAppt.source]?.label || detailAppt.source || '—'} />
                {detailAppt.type && <Row label="Tipo" value={detailAppt.type} />}
                {detailAppt.notes && <Row label="Notas" value={detailAppt.notes} />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="text-slate-700 font-semibold text-right">{value}</span>
    </div>
  );
}

function NewAppointmentForm({ defaultDate, onClose, onSubmit }: { defaultDate: Date; onClose: () => void; onSubmit: (d: any) => void }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    date: toDateStr(defaultDate),
    time: '09:00',
    durationMin: 30,
    type: 'PRIMERA_VEZ',
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => (await api.get('/patients')).data,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: async () => (await api.get('/users/doctors')).data,
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const [h, m] = form.time.split(':');
    const dt = new Date(`${form.date}T${h}:${m}:00`);
    onSubmit({ patientId: form.patientId, doctorId: form.doctorId, date: dt.toISOString(), durationMin: Number(form.durationMin), type: form.type });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Nueva cita</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <select className="input" required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
            <option value="">— Paciente —</option>
            {patients.map((p: any) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
          <select className="input" required value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
            <option value="">— Doctor —</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="input" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="PRIMERA_VEZ">Primera vez</option>
              <option value="SEGUIMIENTO">Seguimiento</option>
              <option value="REVISION_LENTES">Revisión lentes</option>
              <option value="URGENCIA">Urgencia</option>
            </select>
            <input className="input" type="number" min={5} max={240} placeholder="Duración (min)" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Agendar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
