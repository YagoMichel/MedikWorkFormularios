import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Users() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });

  const create = useMutation({
    mutationFn: async (d: any) => (await api.post('/users', d)).data,
    onSuccess: () => { toast.success('Usuario creado'); qc.invalidateQueries({ queryKey: ['users'] }); setOpen(false); },
    onError: () => toast.error('Datos inválidos'),
  });
  const update = useMutation({
    mutationFn: async ({ id, ...d }: any) => (await api.put(`/users/${id}`, d)).data,
    onSuccess: () => { toast.success('Usuario actualizado'); qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null); },
    onError: () => toast.error('Datos inválidos'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => { toast.success('Usuario eliminado'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'No se pudo eliminar'),
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="btn btn-primary">+ Nuevo usuario</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.fullName}</td>
                <td>{u.email}</td>
                <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-blue' : 'badge-green'}`}>{u.role === 'PACIENTE' ? 'Tablet' : u.role}</span></td>
                <td>{u.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-secondary text-xs" onClick={() => setEditing(u)}>Editar</button>
                    <button
                      className="btn btn-danger text-xs"
                      onClick={() => setConfirmDelete({ id: u.id, name: u.fullName })}
                    >Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <UserForm onClose={() => setOpen(false)} onSubmit={(d: any) => create.mutate(d)} />}
      {editing && <UserForm initial={editing} onClose={() => setEditing(null)} onSubmit={(d: any) => update.mutate({ id: editing.id, ...d })} />}

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

function UserForm({ onClose, onSubmit, initial }: any) {
  const isEdit = !!initial;
  const [f, setF] = useState({
    email: initial?.email || '',
    fullName: initial?.fullName || '',
    role: initial?.role || 'DOCTOR',
    password: '',
    active: initial?.active ?? true,
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h2>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const payload: any = { email: f.email, fullName: f.fullName, role: f.role, active: f.active };
          if (f.password) payload.password = f.password;
          onSubmit(isEdit ? payload : { ...payload, password: f.password });
        }}>
          <input className="input" placeholder="Nombre completo" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          <input className="input" type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="ADMIN">Admin</option>
            <option value="DOCTOR">Doctor</option>
            <option value="PACIENTE">Tablet</option>
          </select>
          <input
            className="input"
            type="password"
            placeholder={isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña (mín. 8)'}
            required={!isEdit}
            minLength={isEdit ? undefined : 8}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
              Activo
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">{isEdit ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
