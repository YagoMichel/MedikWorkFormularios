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

interface Batch {
  id: string;
  date: string;
  expectedCount: number;
  status: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
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
  if (status === 'CONFIRMADO' || status === 'CONFIRMADA') return <span className="badge badge-green">{status}</span>;
  if (status === 'CANCELADO' || status === 'CANCELADA') return <span className="badge badge-red">{status}</span>;
  return <span className="badge badge-slate">{status}</span>;
}

function BatchesTab() {
  const qc = useQueryClient();

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

  if (isLoading) return <p className="text-slate-500 p-4">Cargando...</p>;

  return (
    <div className="card p-0 overflow-hidden">
      <table className="tbl">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Fecha</th>
            <th>Trabajadores</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-8">
                Sin solicitudes de cita empresarial.
              </td>
            </tr>
          ) : (
            batches.map((b) => (
              <tr key={b.id}>
                <td>{b.company.name}</td>
                <td>{formatDate(b.date)}</td>
                <td>{b.expectedCount}</td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  {b.status === 'BORRADOR' && (
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => confirm.mutate(b.id)}
                        disabled={confirm.isPending}
                      >
                        Confirmar
                      </button>
                      <button className="btn btn-secondary opacity-50 cursor-not-allowed" disabled>
                        Contactar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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

  if (isLoading) return <p className="text-slate-500 p-4">Cargando...</p>;

  const pendientes = solicitudes.filter((s) => s.status === 'AGENDADA');
  const confirmadas = solicitudes.filter((s) => s.status === 'CONFIRMADA');

  return (
    <div className="space-y-6">
      {pendientes.length === 0 && confirmadas.length === 0 && (
        <div className="card p-8 text-center text-slate-400">
          No hay solicitudes de cita recibidas desde la página web.
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="font-semibold text-sm text-slate-700">Pendientes de confirmar</span>
            <span className="ml-auto badge badge-slate">{pendientes.length}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Contacto</th>
                <th>Solicitud</th>
                <th>Asignar fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.patient?.fullName ?? '—'}</td>
                  <td>
                    <div className="text-xs text-slate-500">
                      {s.patient?.phone && <div>📞 {s.patient.phone}</div>}
                      {s.patient?.email && <div>✉ {s.patient.email}</div>}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-500 max-w-[200px] whitespace-pre-wrap">
                      {s.preNotes ?? '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Recibido: {formatDate(s.createdAt)}
                    </div>
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      className="border border-slate-200 rounded px-2 py-1 text-xs"
                      value={fechas[s.id] ?? ''}
                      onChange={(e) => setFechas((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary text-xs"
                        onClick={() => confirmar.mutate({ id: s.id, fecha: fechas[s.id] })}
                        disabled={confirmar.isPending}
                      >
                        Confirmar
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
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
      )}

      {confirmadas.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span className="font-semibold text-sm text-slate-700">Confirmadas recientes</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Contacto</th>
                <th>Fecha cita</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((s) => (
                <tr key={s.id}>
                  <td>{s.patient?.fullName ?? '—'}</td>
                  <td>
                    <div className="text-xs text-slate-500">
                      {s.patient?.phone && <div>📞 {s.patient.phone}</div>}
                      {s.patient?.email && <div>✉ {s.patient.email}</div>}
                    </div>
                  </td>
                  <td>{formatDate(s.date)}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BatchesManager() {
  const [tab, setTab] = useState<'empresas' | 'web'>('web');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'web'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('web')}
        >
          Solicitudes web
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'empresas'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('empresas')}
        >
          Citas de empresa
        </button>
      </div>

      {tab === 'web' ? <SolicitudesWebTab /> : <BatchesTab />}
    </div>
  );
}
