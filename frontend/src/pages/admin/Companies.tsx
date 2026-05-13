import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', contactName: '', phone: '', email: '', address: '', notes: '' };

export default function Companies() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'new' | any>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const filtered = companies.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const save = useMutation({
    mutationFn: async (data: any) =>
      data.id ? (await api.put(`/companies/${data.id}`, data)).data
               : (await api.post('/companies', data)).data,
    onSuccess: () => { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['companies'] }); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error?.fieldErrors?.name?.[0] || 'Error'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/companies/${id}`)).data,
    onSuccess: () => { toast.success('Eliminada'); qc.invalidateQueries({ queryKey: ['companies'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal(EMPTY)} className="btn btn-primary">
          <span className="material-symbols-rounded text-base">add_circle</span> Nueva empresa
        </button>
      </div>

      <div className="card">
        <input className="input max-w-xs mb-4" placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="overflow-x-auto">
          <table className="tbl w-full">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Teléfono</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td>{c.phone || '—'}</td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setModal(c)} className="btn btn-secondary text-xs">Editar</button>
                      <button onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                        className="btn btn-danger text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="text-center text-ink-muted py-8">Sin empresas registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-red-600">Eliminar empresa</h2>
            <p className="text-sm text-slate-600">¿Estás seguro que deseas eliminar <span className="font-semibold">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {modal !== null && (
        <CompanyModal
          initial={modal}
          onClose={() => setModal(null)}
          onSave={(data: any) => save.mutate(data)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function CompanyModal({ initial, onClose, onSave, saving }: any) {
  const [form, setForm] = useState({ ...initial });
  const f = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
        <h2 className="text-lg font-bold">{form.id ? 'Editar empresa' : 'Nueva empresa'}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-500">Nombre *</label>
            <input className="input" value={form.name} onChange={f('name')} required />
          </div>
          <div>
            <label className="text-xs text-slate-500">Teléfono</label>
            <input className="input" value={form.phone || ''} onChange={f('phone')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button disabled={saving || !form.name} onClick={() => onSave(form)} className="btn btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
