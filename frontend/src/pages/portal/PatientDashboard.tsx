// Dashboard del PACIENTE — mismo estilo que el de la doctora, pero limitado
// a ver su propio expediente y con una tarjeta para iniciar su encuesta.
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, FileText, FolderOpen, Download, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { downloadAuthedFile } from '../../utils/downloadFile';

const TYPE_LABEL: Record<string, string> = {
  CUESTIONARIO: 'Cuestionario', RESULTADOS: 'Resultados', CONSENTIMIENTO: 'Consentimiento', OTRO: 'Documento',
};

const getGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Buenos días';
  if (hr < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

export default function PatientDashboard() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['portal-results'],
    queryFn: async () => (await api.get('/portal/patient/results')).data,
  });

  const download = async (id: string, name: string) => {
    try { await downloadAuthedFile(`/portal/patient/results/${id}/download`, name); }
    catch { toast.error('No se pudo descargar el archivo'); }
  };

  const documents = data?.documents ?? [];
  const surveys = data?.surveys ?? [];
  const linked = data?.linked;

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      {/* Banner de bienvenida */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 p-8 md:p-10 flex justify-between items-center shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="z-10 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 flex items-center gap-3 drop-shadow-sm">
            ¡{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Paciente'}! <span className="text-3xl animate-bounce">👋</span>
          </h1>
          <p className="text-white/90 text-lg font-medium">Aquí puedes consultar tu expediente y llenar tu encuesta de salud.</p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
          <ClipboardList size={260} className="text-white" />
        </div>
      </div>

      {/* Tarjetas: iniciar encuesta + resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Iniciar encuesta (acción principal) */}
        <button onClick={() => nav('/mi-encuesta')}
          className="text-left bg-gradient-to-br from-[#2560aa] to-[#51abcd] rounded-3xl p-6 shadow-[0_8px_30px_rgb(37,96,170,0.25)] flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300 group">
          <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0">
            <ClipboardList size={28} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-sm text-white/80 font-semibold mb-1">Encuesta de salud</div>
            <div className="text-lg font-extrabold text-white flex items-center gap-2">Iniciar encuesta <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></div>
          </div>
        </button>
        {/* Documentos */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2560aa]/10 to-[#51abcd]/10 text-[#2560aa] flex items-center justify-center shrink-0">
            <FolderOpen size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Documentos</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{documents.length}</div>
          </div>
        </div>
        {/* Encuestas */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <FileText size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-semibold mb-1">Mis encuestas</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{surveys.length}</div>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center text-slate-400 py-8">Cargando…</div>}

      {!isLoading && !linked && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-8 text-center">
          <div className="text-3xl mb-2">🔗</div>
          <p className="text-amber-800 dark:text-amber-300 font-bold">Tu cuenta aún no está ligada a un expediente</p>
          <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">El personal de la clínica la ligará a tu historial. Mientras, ya puedes llenar tu encuesta.</p>
        </div>
      )}

      {!isLoading && linked && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-6">
            <FolderOpen size={20} className="text-[#2560aa]" /> Mi expediente
          </h3>
          {documents.length === 0 ? (
            <p className="text-slate-400 text-sm">Aún no hay documentos en tu expediente.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((d: any) => (
                <div key={d.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 flex justify-between items-center gap-3 hover:shadow-md hover:border-[#51abcd]/30 transition group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2560aa] to-[#51abcd] text-white flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-[#2560aa] transition-colors">{d.fileName}</div>
                      <div className="text-xs text-slate-500 font-medium">{TYPE_LABEL[d.type] || d.type} · {new Date(d.visitDate).toLocaleDateString('es-MX')}</div>
                    </div>
                  </div>
                  <button onClick={() => download(d.id, d.fileName)} className="shrink-0 w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-[#2560aa] hover:text-white flex items-center justify-center transition shadow-sm" title="Descargar">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
