// =============================================================
// ARCHIVO: src/pages/master/SystemStatus.tsx
// DESCRIPCION: Panel de estado de integraciones, exclusivo de MASTER.
//              Solo lectura — no revela nada de esto a un ADMIN normal
//              (la ruta y el link de navegación ya están gateados a MASTER).
// =============================================================
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { CheckCircle2, XCircle, MinusCircle, RefreshCw } from 'lucide-react';

interface Check {
  key: string;
  label: string;
  status: true | false | null;
  detail?: string;
}

export default function SystemStatus() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => (await api.get('/system/status')).data as { checks: Check[]; checkedAt: string },
  });

  const statusStyle = (status: Check['status']) => {
    if (status === true) return { Icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'Funcionando' };
    if (status === false) return { Icon: XCircle, cls: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', text: 'Con error' };
    return { Icon: MinusCircle, cls: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', text: 'Desactivado' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data?.checkedAt ? `Última revisión: ${new Date(data.checkedAt).toLocaleString('es-MX')}` : ''}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 px-4 h-9 flex items-center gap-2 text-sm rounded-xl shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} /> Revisar de nuevo
        </button>
      </div>

      {isLoading && <div className="text-slate-400 text-sm">Cargando...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.checks.map((check) => {
          const { Icon, cls, bg, text } = statusStyle(check.status);
          return (
            <div key={check.key} className="card p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg} ${cls}`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{check.label}</div>
                <div className={`text-xs font-semibold mt-0.5 ${cls}`}>{text}</div>
                {check.detail && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 break-words">{check.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
