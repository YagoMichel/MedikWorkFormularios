// =============================================================
// ARCHIVO: src/pages/shared/Patients.tsx
// SECCION: COMPARTIDA (ADMIN + DOCTOR)
// DESCRIPCION: Lista de pacientes con busqueda y filtros.
//              Accesible tanto para el doctor como el admin.
// API: GET /api/patients
// =============================================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="btn btn-primary"><Plus size={16} /> Nuevo</button>
      </div>
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <input className="input flex-1" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ maxWidth: 220 }} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">Todas las empresas</option>
            <option value={SIN_EMPRESA}>Sin empresa / Particulares</option>
            {companiesList.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs">
              <tr><th className="text-left py-2">Nombre</th><th className="text-left">Empresa</th><th></th><th></th></tr>
            </thead>
            <tbody>
              {patients.map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{p.fullName}</td>
                  <td>{p.company || '—'}</td>
                  <td className="text-right pr-2">
                    <Link to={`/patients/${p.id}`} className="text-blue-600 hover:underline text-xs">Ver más</Link>
                  </td>
                  <td className="text-right">
                    <button onClick={() => setEditPatient({ id: p.id, fullName: p.fullName, company: p.company || '' })} className="btn btn-secondary text-xs">Editar</button>
                  </td>
                  <td className="text-right">
                    <button onClick={() => setConfirmDelete({ id: p.id, name: p.fullName })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: '#e53e3e' }}>
                      <span className="material-symbols-rounded text-[15px]">delete</span>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500">Sin pacientes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <PatientForm onClose={() => setOpen(false)} onSubmit={(d) => create.mutate(d)} />}
      {editPatient && <EditPatientModal patient={editPatient} onClose={() => setEditPatient(null)} onSubmit={(d) => update.mutate({ id: editPatient.id, data: d })} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-red-600">Confirmar eliminación</h2>
            <p className="text-sm text-slate-600">¿Estás seguro que deseas eliminar <span className="font-semibold">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPatientModal({ patient, onClose, onSubmit }: { patient: any; onClose: () => void; onSubmit: (d: any) => void }) {
  const [form, setForm] = useState({ fullName: patient.fullName, company: patient.company });
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Editar paciente</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <input className="input" placeholder="Nombre completo" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <select className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
            <option value="">Empresa (opcional)</option>
            {companies.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PatientForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ fullName: '', company: '' });
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Nuevo paciente</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <input className="input" placeholder="Nombre completo" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <select className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
            <option value="">Empresa (opcional)</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
