// Dashboard de EMPRESA — mismo estilo que el de la doctora, limitado a ver
// los expedientes de SUS empleados y buscar por empleado.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Users, FileText, Search, FolderOpen, ChevronDown, Download } from 'lucide-react';
import { api } from '../../services/api';
import { downloadAuthedFile } from '../../utils/downloadFile';

const TYPE_LABEL: Record<string, string> = {
  CUESTIONARIO: 'Cuestionario', RESULTADOS: 'Resultados', CONSENTIMIENTO: 'Consentimiento', OTRO: 'Documento',
};

const maskedNss = (nss?: string | null) => {
  if (!nss) return 'Sin registrar';
  const clean = nss.replace(/\s/g, '');
  return clean.length <= 4 ? clean : `${'•'.repeat(clean.length - 4)}${clean.slice(-4)}`;
};

export default function CompanyDashboard() {
  const [search, setSearch] = useState('');
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['portal-company'],
    queryFn: async () => (await api.get('/portal/company')).data,
  });

  const download = async (id: string, name: string) => {
    try { await downloadAuthedFile(`/portal/company/results/${id}/download`, name); }
    catch { toast.error('El archivo no está disponible o su autorización fue revocada'); }
  };

  const allPatients = data?.patients ?? [];
  const searchTerm = search.trim().toLowerCase();
  const patients = allPatients.filter((p: any) =>
    p.fullName.toLowerCase().includes(searchTerm));
  const totalResults = allPatients.reduce((n: number, p: any) => n + p.documents.length, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 p-8 md:p-10 flex justify-between items-center shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="z-10 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 drop-shadow-sm">{data?.company?.name || 'Tu empresa'}</h1>
          <p className="text-white/90 text-lg font-medium">Consulta la disponibilidad de resultados de tus empleados.</p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
          <Building2 size={260} className="text-white" />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2560aa]/10 to-[#51abcd]/10 text-[#2560aa] flex items-center justify-center shrink-0">
            <Users size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Empleados</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{allPatients.length}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <FileText size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Resultados disponibles</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{totalResults}</div>
          </div>
        </div>
      </div>

      {/* Buscador + lista de empleados */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <FolderOpen size={20} className="text-[#2560aa]" /> Resultados por empleado
          </h3>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading && <p className="text-slate-400 text-sm">Cargando…</p>}

        {!isLoading && patients.length === 0 && (
          <p className="text-slate-400 text-sm py-4 text-center">
            {allPatients.length ? 'Ningún empleado coincide con la búsqueda.' : 'Aún no hay empleados registrados para tu empresa.'}
          </p>
        )}

        <div className="space-y-3">
          {patients.map((p: any) => {
            const open = openPatientId === p.id;
            return (
            <div key={p.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenPatientId(open ? null : p.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2560aa] to-[#51abcd] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {p.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{p.fullName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    NSS: <span className="font-semibold">{maskedNss(p.nss)}</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-400">{p.documents.length} resultado(s)</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {open && (
                <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-white/70 dark:bg-slate-900/20">
                  {p.documents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 pl-12">Sin resultados disponibles todavía.</p>
                  ) : (
                    <div className="space-y-2 pl-0 sm:pl-12">
                  {p.documents.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3 text-sm rounded-xl border border-slate-100 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-700 dark:text-slate-200 font-semibold truncate">{d.fileName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{TYPE_LABEL[d.type] || d.type} · {new Date(d.visitDate).toLocaleDateString('es-MX')}</div>
                      </div>
                      <button onClick={() => download(d.id, d.fileName)}
                        className="ml-auto shrink-0 w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-[#2560aa] hover:text-white flex items-center justify-center transition"
                        title="Descargar archivo autorizado">
                        <Download size={15} />
                      </button>
                    </div>
                  ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
