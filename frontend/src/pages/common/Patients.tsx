// =============================================================
// ARCHIVO: src/pages/common/Patients.tsx
// SECCION: COMPARTIDA (ADMIN + DOCTOR)
// DESCRIPCION: Lista de pacientes con busqueda y filtros.
//              Accesible tanto para el doctor como el admin.
// API: GET /api/patients
// =============================================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Building2, Eye, Edit2, Trash2, UserPlus, AlertCircle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// Mismo valor centinela usado en la tablet para "sin empresa / particular"
const SIN_EMPRESA = '__sin_empresa__';

export default function Patients() {
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [open, setOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<null | { id: string; fullName: string; company: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  const qc = useQueryClient();

  const { data: companiesList = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients', q, company],
    queryFn: async () => (await api.get('/patients', { params: { q, company } })).data,
  });

  const create = useMutation({
    mutationFn: async (data: any) => (await api.post('/patients', data)).data,
    onSuccess: () => { toast.success('Paciente creado'); qc.invalidateQueries({ queryKey: ['patients'] }); setOpen(false); },
    onError: () => toast.error('Error al crear'),
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: any) => (await api.put(`/patients/${id}`, data)).data,
    onSuccess: () => { toast.success('Paciente actualizado'); qc.invalidateQueries({ queryKey: ['patients'] }); setEditPatient(null); },
    onError: () => toast.error('Error al actualizar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/patients/${id}`)).data,
    onSuccess: () => { toast.success('Paciente eliminado'); qc.invalidateQueries({ queryKey: ['patients'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 fade-in space-y-6">
      {/* Header / Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div className="z-10 relative max-w-xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 flex items-center gap-3">
            <User size={36} className="opacity-90" />
            Directorio de Pacientes
          </h1>
          <p className="text-blue-100 font-medium text-lg">
            Gestiona la información y el historial clínico de tus pacientes.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
          <User size={200} className="text-white" />
        </div>
      </div>

      {/* Barra de Búsqueda y Acción */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2560aa] shadow-sm transition-shadow"
              placeholder="Buscar por nombre..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Building2 size={18} className="text-slate-400" />
            </div>
            <select
              className="w-full pl-11 pr-12 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2560aa] shadow-sm transition-shadow font-medium cursor-pointer appearance-none"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">Todas las empresas</option>
              <option value={SIN_EMPRESA}>Sin empresa / Particulares</option>
              {companiesList.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <ChevronDown size={18} className="text-slate-400" />
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)} 
          className="w-full sm:w-auto px-6 py-3 bg-[#2560aa] hover:bg-[#1e4d8a] text-white font-bold rounded-2xl shadow-lg shadow-[#2560aa]/30 transition-all hover:scale-105 flex items-center justify-center gap-2"
        >
          <UserPlus size={20} /> Nuevo Paciente
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Paciente</th>
                <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-center">Cuestionario</th>
                <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {patients.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2560aa]/10 to-[#51abcd]/10 text-[#2560aa] dark:from-[#2560aa]/20 dark:to-[#51abcd]/20 dark:text-blue-400 flex items-center justify-center font-bold shadow-sm shrink-0">
                        {p.fullName?.charAt(0).toUpperCase() || 'P'}
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{p.fullName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold text-sm">
                      {p.company ? (
                        <><Building2 size={16} className="text-[#51abcd]" /> {p.company}</>
                      ) : (
                        <span className="text-slate-400 italic font-medium">Sin empresa</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Link 
                      to={`/patients/${p.id}`} 
                      className="inline-flex w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white items-center justify-center transition-colors shadow-sm"
                      title="Ver historial / cuestionario"
                    >
                      <Eye size={18} />
                    </Link>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 transition-opacity">
                      <button 
                        onClick={() => setEditPatient({ id: p.id, fullName: p.fullName, company: p.company || '' })} 
                        className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm"
                        title="Editar paciente"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ id: p.id, name: p.fullName })}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm"
                        title="Eliminar paciente"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                        <Search size={28} className="text-slate-300" />
                      </div>
                      No se encontraron pacientes que coincidan con la búsqueda.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <PatientForm onClose={() => setOpen(false)} onSubmit={(d) => create.mutate(d)} />}
      {editPatient && <EditPatientModal patient={editPatient} onClose={() => setEditPatient(null)} onSubmit={(d) => update.mutate({ id: editPatient.id, data: d })} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-2">¿Eliminar paciente?</h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6">
              Estás a punto de eliminar a <span className="font-bold text-slate-800 dark:text-white">{confirmDelete.name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors w-full">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="px-5 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors w-full">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPatientModal({ patient, onClose, onSubmit }: { patient: any; onClose: () => void; onSubmit: (d: any) => void }) {
  const [form, setForm] = useState({ fullName: patient.fullName, company: patient.company });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get('/companies')).data });
  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center justify-center">
            <Edit2 size={24} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">Editar paciente</h2>
        </div>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre completo</label>
            <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2560aa] transition-all" placeholder="Ej. Juan Pérez" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Empresa (Opcional)</label>
            <select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2560aa] transition-all font-medium" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
              <option value="">Ninguna</option>
              {companies.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors">Cancelar</button>
            <button className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-lg shadow-slate-900/20 transition-all">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PatientForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ fullName: '', company: '' });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get('/companies')).data });
  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#2560aa]/10 text-[#2560aa] rounded-2xl flex items-center justify-center">
            <UserPlus size={24} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">Nuevo paciente</h2>
        </div>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre completo</label>
            <input className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2560aa] transition-all" placeholder="Ej. Juan Pérez" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Empresa (Opcional)</label>
            <select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2560aa] transition-all font-medium" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
              <option value="">Ninguna</option>
              {companies.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors">Cancelar</button>
            <button className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#2560aa] hover:bg-[#1e4d8a] shadow-lg shadow-[#2560aa]/30 transition-all">Crear paciente</button>
          </div>
        </form>
      </div>
    </div>
  );
}
