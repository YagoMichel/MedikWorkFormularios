// =============================================================
// ARCHIVO: src/pages/admin/AuditLog.tsx
// DESCRIPCION: Bitácora de auditoría (solo ADMIN/MASTER). Muestra
//   quién accedió al sistema y qué operaciones hizo sobre datos
//   sensibles (accesos, archivos, consultas de expediente, cuentas),
//   con filtros por acción y rango de fechas. Solo lectura.
// =============================================================
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../services/api';
import { History, Shield, Search } from 'lucide-react';

// Etiquetas legibles + color por tipo de acción.
const ACTION_META: Record<string, { label: string; cls: string }> = {
  LOGIN_SUCCESS:    { label: 'Inicio de sesión',      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  LOGIN_FAILED:     { label: 'Login fallido',         cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  LOGOUT:           { label: 'Cierre de sesión',      cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  DOCUMENT_UPLOAD:  { label: 'Subida de archivo',     cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  DOCUMENT_DOWNLOAD:{ label: 'Descarga de archivo',   cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  DOCUMENT_DELETE:  { label: 'Borrado de archivo',    cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  EXPEDIENTE_VIEW:  { label: 'Consulta expediente',   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  PATIENT_VIEW:     { label: 'Consulta paciente',     cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  USER_CREATE:      { label: 'Alta de usuario',       cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  USER_UPDATE:      { label: 'Edición de usuario',    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  USER_DELETE:      { label: 'Borrado de usuario',    cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  PASSWORD_CHANGE:  { label: 'Cambio de contraseña',  cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  ROLE_CHANGE:      { label: 'Cambio de rol',         cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

// Tamaños de página que el usuario puede pedir (para no cargar de más).
const PAGE_SIZES = [10, 50, 100];

interface AuditItem {
  id: string;
  action: string;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  targetType: string | null;
  patientId: string | null;
  patientName: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');

  const { data: actions = [] } = useQuery<string[]>({
    queryKey: ['audit-actions'],
    queryFn: async () => (await api.get('/audit/actions')).data,
  });

  const { data, isLoading } = useQuery<{ items: AuditItem[]; total: number }>({
    queryKey: ['audit', action, from, to, pageSize, page],
    queryFn: async () =>
      (await api.get('/audit', {
        params: { action: action || undefined, from: from || undefined, to: to || undefined, take: pageSize, skip: page * pageSize },
      })).data,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const desde = total === 0 ? 0 : page * pageSize + 1;
  const hasta = Math.min(page * pageSize + items.length, total);

  // Filtro de texto local (usuario/detalle/paciente) sobre la página cargada.
  const filtered = q
    ? items.filter((i) =>
        [i.userEmail, i.userName, i.detail, i.patientName].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))
    : items;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <History size={18} /> Bitácora de auditoría
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro de accesos y operaciones sobre datos sensibles (LFPDPPP / NOM-024). Solo lectura.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Buscar (usuario / detalle)</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="correo, nombre, archivo…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-400" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Acción</label>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-400">
            <option value="">Todas</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-400" />
        </div>
        {(action || from || to || q) && (
          <button onClick={() => { setAction(''); setFrom(''); setTo(''); setQ(''); setPage(0); }}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="px-4 py-3 font-bold">Fecha y hora</th>
                <th className="px-4 py-3 font-bold">Usuario</th>
                <th className="px-4 py-3 font-bold">Acción</th>
                <th className="px-4 py-3 font-bold">Paciente / objetivo</th>
                <th className="px-4 py-3 font-bold">Detalle</th>
                <th className="px-4 py-3 font-bold">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Sin registros para estos filtros</td></tr>
              ) : filtered.map((i) => {
                const meta = ACTION_META[i.action] ?? { label: i.action, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={i.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">{fmt(i.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{i.userName ?? i.userEmail ?? '—'}</div>
                      <div className="text-[11px] text-slate-400">{i.userEmail && i.userName ? i.userEmail : ''}{i.userRole ? ` · ${i.userRole}` : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{i.patientName ?? (i.targetType ?? '—')}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[280px] truncate" title={i.detail ?? ''}>{i.detail ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums whitespace-nowrap">{i.ip ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación con selector de tamaño (10 / 50 / 100) */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-400">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="tabular-nums">· {desde}–{hasta} de {total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">
            Anterior
          </button>
          <span className="tabular-nums">Página {page + 1} de {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
