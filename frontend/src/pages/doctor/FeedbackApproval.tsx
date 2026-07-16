import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { MessageSquare, Star, Trash2, Eye, EyeOff } from 'lucide-react';

export default function FeedbackApproval() {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<null | any>(null);

  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: async () => (await api.get('/feedback')).data,
    refetchInterval: 5000,
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      return (await api.patch(`/feedback/${id}/approve`, { approved })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbacks'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  const deleteFeedback = useMutation({
    mutationFn: async (id: string) => {
      return (await api.delete(`/feedback/${id}`)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbacks'] });
      toast.success('Testimonio eliminado');
    },
    onError: () => toast.error('Error al eliminar testimonio'),
  });

  if (isLoading) return <div className="text-sm text-slate-400">Cargando sugerencias...</div>;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 flex flex-col h-full mt-6 relative">
      <h3 className="text-lg font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-50 dark:border-slate-700 pb-5">
        <MessageSquare size={20} className="text-[#2560aa]" /> Sugerencias y Críticas (Web)
      </h3>
      
      <div className="overflow-auto max-h-[400px] rounded-xl border border-slate-100 dark:border-slate-700 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-600">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-slate-800 shadow-sm z-10">
            <tr className="border-b border-slate-100 dark:border-slate-700">
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paciente</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Calificación</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comentario</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {feedbacks?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm font-medium">No hay sugerencias registradas.</td>
              </tr>
            ) : (
              feedbacks?.map((fb: any) => (
                <tr key={fb.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(fb.createdAt).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm">{fb.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} fill={i < fb.rating ? "currentColor" : "transparent"} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={fb.comment}>
                    "{fb.comment}"
                  </td>
                  <td className="px-4 py-3">
                    {fb.approved ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Aprobado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleApproval.mutate({ id: fb.id, approved: !fb.approved })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm ${fb.approved ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}
                        title={fb.approved ? 'Ocultar de la web' : 'Aprobar para la web'}
                      >
                        {fb.approved ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(fb)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL DE CONFIRMACIÓN ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Eliminar testimonio</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              ¿Estás seguro que deseas eliminar el testimonio de <span className="font-semibold text-slate-700 dark:text-slate-200">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { 
                  deleteFeedback.mutate(confirmDelete.id); 
                  setConfirmDelete(null); 
                }} 
                className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow-sm border-0"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
