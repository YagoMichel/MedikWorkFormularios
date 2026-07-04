// =============================================================
// ARCHIVO: src/pages/admin/BatchesManager.tsx
// SECCION: ADMIN (compañero)
// DESCRIPCION: Tabla de citas de empresa (batches) y solicitudes
//              de cita recibidas desde la pagina web publica.
// =============================================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { Building2, Calendar, Users, Activity, CheckCircle2, XCircle, Mail, Phone, CalendarClock, Edit2, Trash2 } from 'lucide-react';

interface Batch {
  id: string;
  date: string;
  expectedCount: number;
  status: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO' | 'CERRADO';
  company: { name: string };
}

interface SolicitudWeb {
  id: string;
  createdAt: string;
  date: string;
  status: string;
  preNotes: string | null;
  patient: { fullName: string; phone: string | null; email: string | null } | null;
  doctor: { fullName: string } | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CONFIRMADO' || status === 'CONFIRMADA') {
    return <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border border-emerald-100/50 inline-flex items-center gap-1.5"><CheckCircle2 size={12} strokeWidth={3} /> {status}</span>;
  }
  if (status === 'CANCELADO' || status === 'CANCELADA') {
    return <span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border border-rose-100/50 inline-flex items-center gap-1.5"><XCircle size={12} strokeWidth={3} /> {status}</span>;
  }
  if (status === 'CERRADO') {
    return <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border border-slate-200/50 inline-flex items-center gap-1.5"><CheckCircle2 size={12} strokeWidth={3} /> {status}</span>;
  }
  return <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border border-amber-100/50 inline-flex items-center gap-1.5"><Activity size={12} strokeWidth={3} /> {status}</span>;
}

function BatchesTab() {
  const qc = useQueryClient();
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Batch | null>(null);

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: () => api.get('/batches').then((r) => r.data),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/batches/${id}/confirm-admin`),
    onSuccess: () => {
      toast.success('Cita confirmada');
      qc.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: () => toast.error('Error al confirmar la cita'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/batches/${id}`),
    onSuccess: () => {
      toast.success('Cita eliminada correctamente');
      qc.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: () => toast.error('Error al eliminar la cita'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.put(`/batches/${id}`, data),
    onSuccess: () => {
      toast.success('Cita actualizada');
      qc.invalidateQueries({ queryKey: ['batches'] });
      setEditingBatch(null);
    },
    onError: () => toast.error('Error al actualizar la cita'),
  });

  if (isLoading) return <p className="text-slate-400 text-sm py-4">Cargando citas de empresa...</p>;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
              <th className="px-6 py-5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Empresa</th>
              <th className="px-6 py-5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trabajadores</th>
              <th className="px-6 py-5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-12 font-medium text-sm">
                  No hay solicitudes de cita empresarial en este momento.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#51abcd]/10 text-[#51abcd] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Building2 size={18} strokeWidth={2.5} />
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{b.company.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(b.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Users size={14} className="text-slate-400" />
                      {b.expectedCount} <span className="font-medium text-slate-400">pacientes</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 transition-opacity">
                      {b.status === 'BORRADOR' && (
                        <button
                          className="px-4 py-2 bg-[#2560aa] hover:bg-[#1c4b85] text-white font-bold rounded-xl shadow-lg shadow-[#2560aa]/20 transition-all text-xs"
                          onClick={() => confirm.mutate(b.id)}
                          disabled={confirm.isPending}
                        >
                          Confirmar
                        </button>
                      )}
                      
                      <button 
                        className="p-2 text-slate-400 hover:text-[#2560aa] hover:bg-[#2560aa]/10 rounded-lg transition-colors" 
                        title="Editar"
                        onClick={() => setEditingBatch(b)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50" 
                        title="Eliminar"
                        disabled={remove.isPending}
                        onClick={() => setConfirmDelete(b)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {editingBatch && (
        <EditBatchForm
          batch={editingBatch}
          onClose={() => setEditingBatch(null)}
          onSubmit={(data: any) => update.mutate({ id: editingBatch.id, data })}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col items-center text-center relative">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Eliminar cita?</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              ¿Estás seguro que deseas eliminar la cita de <span className="font-bold text-slate-700 dark:text-slate-200">{confirmDelete.company.name}</span> del {formatDate(confirmDelete.date)}?<br/>Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} 
                className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-all text-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditBatchForm({ batch, onClose, onSubmit }: any) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(batch.date);
  const toDateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const [form, setForm] = useState({
    companyId: batch.companyId || '',
    date: toDateStr,
    expectedCount: String(batch.expectedCount),
    status: batch.status,
    notes: batch.notes || '',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSubmit({ companyId: form.companyId, date: form.date, expectedCount: Number(form.expectedCount), status: form.status, notes: form.notes });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Editar Cita</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
            <XCircle size={18} />
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Empresa</label>
            <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full" required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">— Seleccionar Empresa —</option>
              <option value="SIN_EMPRESA">Sin empresa (Individual)</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
            <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full" required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="BORRADOR">Borrador</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="CERRADO">Cerrado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Pacientes</label>
              <input className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full" type="number" min={1} required value={form.expectedCount} onChange={(e) => setForm({ ...form, expectedCount: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Fecha</label>
              <input className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Notas (Opcional)</label>
            <textarea className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-[#2560aa] hover:bg-[#1c4b85] text-white font-bold rounded-xl shadow-lg shadow-[#2560aa]/20 transition-all text-sm">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SolicitudesWebTab() {
  const qc = useQueryClient();
  const [fechas, setFechas] = useState<Record<string, string>>({});

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudWeb[]>({
    queryKey: ['solicitudes-web'],
    queryFn: () => api.get('/agent/solicitudes-web').then((r) => r.data),
  });

  const confirmar = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha?: string }) =>
      api.post(`/agent/solicitudes-web/${id}/confirmar`, { fecha }),
    onSuccess: () => {
      toast.success('Cita confirmada — aparecerá en el calendario');
      qc.invalidateQueries({ queryKey: ['solicitudes-web'] });
    },
    onError: () => toast.error('Error al confirmar'),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`/agent/solicitudes-web/${id}/cancelar`),
    onSuccess: () => {
      toast.success('Solicitud cancelada');
      qc.invalidateQueries({ queryKey: ['solicitudes-web'] });
    },
    onError: () => toast.error('Error al cancelar'),
  });

  if (isLoading) return <p className="text-slate-400 text-sm py-4">Cargando solicitudes web...</p>;

  const pendientes = solicitudes.filter((s) => s.status === 'AGENDADA');
  const confirmadas = solicitudes.filter((s) => s.status === 'CONFIRMADA');

  return (
    <div className="space-y-8">
      {pendientes.length === 0 && confirmadas.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
            <CalendarClock size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Sin solicitudes</h3>
          <p className="text-slate-400 text-sm font-medium">No hay solicitudes de cita pendientes recibidas desde la página web.</p>
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm inline-block" />
            <h3 className="font-extrabold text-slate-700 dark:text-slate-200">Pendientes de confirmar</h3>
            <span className="ml-auto px-2.5 py-0.5 rounded-md bg-slate-200/50 text-slate-600 font-bold text-xs">{pendientes.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Solicitud / Notas</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Asignar fecha</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {pendientes.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{s.patient?.fullName ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5 text-xs font-medium text-slate-500">
                        {s.patient?.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400"/> {s.patient.phone}</div>}
                        {s.patient?.email && <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400"/> {s.patient.email}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 max-w-xs whitespace-pre-wrap leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {s.preNotes ?? 'Sin notas adicionales'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                        Recibido: {formatDate(s.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="datetime-local"
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-[#51abcd] focus:ring-2 focus:ring-[#51abcd]/20 transition-all w-full max-w-[200px]"
                        value={fechas[s.id] ?? ''}
                        onChange={(e) => setFechas((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-4 py-2 bg-[#2560aa] hover:bg-[#1c4b85] text-white font-bold rounded-xl shadow-lg shadow-[#2560aa]/20 transition-all text-xs disabled:opacity-50"
                          onClick={() => confirmar.mutate({ id: s.id, fecha: fechas[s.id] })}
                          disabled={confirmar.isPending}
                        >
                          Confirmar
                        </button>
                        <button
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-all text-xs disabled:opacity-50"
                          onClick={() => cancelar.mutate(s.id)}
                          disabled={cancelar.isPending}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmadas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 opacity-75">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm inline-block" />
            <h3 className="font-extrabold text-slate-700 dark:text-slate-200">Confirmadas recientes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Fecha cita</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {confirmadas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{s.patient?.fullName ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs font-medium text-slate-400">
                        {s.patient?.phone && <div className="flex items-center gap-1"><Phone size={12}/> {s.patient.phone}</div>}
                        {s.patient?.email && <div className="flex items-center gap-1"><Mail size={12}/> {s.patient.email}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-600">{formatDate(s.date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BatchesManager() {
  const [tab, setTab] = useState<'empresas' | 'web'>('empresas');

  return (
    <div className="space-y-6 pt-2 max-w-7xl mx-auto">
      <div className="flex gap-2">
        <button
          className={`px-6 py-2.5 text-sm font-extrabold rounded-xl transition-all ${
            tab === 'empresas'
              ? 'bg-[#2560aa] text-white shadow-lg shadow-[#2560aa]/30 hover:bg-[#1c4b85]'
              : 'bg-white text-slate-500 border border-slate-200 hover:border-[#51abcd] hover:text-[#51abcd] hover:bg-slate-50'
          }`}
          onClick={() => setTab('empresas')}
        >
          Citas de empresa
        </button>
        <button
          className={`px-6 py-2.5 text-sm font-extrabold rounded-xl transition-all ${
            tab === 'web'
              ? 'bg-[#2560aa] text-white shadow-lg shadow-[#2560aa]/30 hover:bg-[#1c4b85]'
              : 'bg-white text-slate-500 border border-slate-200 hover:border-[#51abcd] hover:text-[#51abcd] hover:bg-slate-50'
          }`}
          onClick={() => setTab('web')}
        >
          Solicitudes web
        </button>
      </div>

      <div className="transition-all">
        {tab === 'web' ? <SolicitudesWebTab /> : <BatchesTab />}
      </div>
    </div>
  );
}
