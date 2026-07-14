import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Pencil, Trash2, Users as UsersIcon, UserCheck, UserX, Shield, Crown,
  Search, Filter, ArrowUpDown, Calendar, Tablet, User, Plus, Building2, Link2, Copy
} from 'lucide-react';
import { useAuth } from '../../stores/auth';

export default function Users() {
  const qc = useQueryClient();
  const currentUser = useAuth((s) => s.user);
  const isMaster = currentUser?.role === 'MASTER';
  const [open, setOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [linking, setLinking] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });

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
  const linkPatient = useMutation({
    mutationFn: async ({ id, patientId }: any) => (await api.patch(`/users/${id}/link-patient`, { patientId })).data,
    onSuccess: () => { toast.success('Expediente ligado'); qc.invalidateQueries({ queryKey: ['users'] }); setLinking(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'No se pudo ligar'),
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u: any) => u.active).length;
  const rolesInUse = new Set(users.map((u: any) => u.role)).size;

  const filtered = useMemo(() => {
    let result = (users as any[]).filter(u => 
      u.fullName.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortMode === 'name_asc') return a.fullName.localeCompare(b.fullName);
      if (sortMode === 'name_desc') return b.fullName.localeCompare(a.fullName);
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (sortMode === 'date_asc') return dateA - dateB;
      if (sortMode === 'date_desc') return dateB - dateA;
      return 0;
    });

    return result;
  }, [users, search, sortMode]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const formatDate = (isoString?: string) => {
    if (!isoString) return { date: 'Hoy', time: '' };
    const d = new Date(isoString);
    const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
    return { date, time };
  }

  const getRoleBadge = (role: string) => {
    if (role === 'PACIENTE_TABLET') return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
        <Tablet size={14} strokeWidth={2.5} /> Tablet
      </div>
    );
    if (role === 'PACIENTE') return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-xs font-bold">
        <User size={14} strokeWidth={2.5} /> Paciente
      </div>
    );
    if (role === 'EMPRESA') return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
        <Building2 size={14} strokeWidth={2.5} /> Empresa
      </div>
    );
    if (role === 'DOCTOR') return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
        <User size={14} strokeWidth={2.5} /> Doctor
      </div>
    );
    if (role === 'MASTER') return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
        <Crown size={14} strokeWidth={2.5} /> Master
      </div>
    );
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold">
        <Shield size={14} strokeWidth={2.5} /> Admin
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => setCompanyOpen(true)}
          className="btn bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          <Building2 size={18} strokeWidth={2.5} /> Cuenta de empresa
        </button>
        <button
          onClick={() => setOpen(true)}
          className="btn bg-[#3375c8] hover:bg-[#2860a5] text-white shadow-[0_4px_14px_rgba(51,117,200,0.3)] hover:shadow-[0_6px_20px_rgba(51,117,200,0.4)] hover:-translate-y-0.5 border-0"
        >
          <Plus size={18} strokeWidth={2.5} /> Nuevo usuario
        </button>
      </div>

      {/* ── STATS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Stat 1 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UsersIcon size={24} strokeWidth={2} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-0.5">Usuarios totales</div>
            <div className="text-2xl font-extrabold text-slate-800 leading-none mb-1">{totalUsers}</div>
            <div className="text-[11px] text-slate-400">Usuarios registrados</div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} strokeWidth={2} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-0.5">Usuarios activos</div>
            <div className="text-2xl font-extrabold text-slate-800 leading-none mb-1">{activeUsers}</div>
            <div className="text-[11px] text-slate-400">Cuentas activas</div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield size={24} strokeWidth={2} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-0.5">Roles asignados</div>
            <div className="text-2xl font-extrabold text-slate-800 leading-none mb-1">{rolesInUse}</div>
            <div className="text-[11px] text-slate-400">Roles en uso</div>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR & TABLE ── */}
      <div className="card p-0 overflow-hidden border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all dark:bg-slate-800 dark:border-slate-700"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto z-10">
            {/* Botón Ordenar */}
            <div className="relative">
              <button 
                onClick={() => { setShowSort(!showSort); }} 
                className={`btn bg-white border text-sm shadow-sm px-4 h-9 flex items-center gap-2 ${showSort ? 'border-blue-400 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <ArrowUpDown size={16} /> Ordenar
              </button>
              {showSort && (
                <div className="absolute top-full right-0 md:left-0 mt-2 w-56 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-1">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Ordenar por</div>
                  <button onClick={() => { setSortMode('date_desc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'date_desc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Más recientes primero</button>
                  <button onClick={() => { setSortMode('date_asc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'date_asc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Más antiguos primero</button>
                  <button onClick={() => { setSortMode('name_asc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'name_asc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Nombre (A-Z)</button>
                  <button onClick={() => { setSortMode('name_desc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'name_desc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Nombre (Z-A)</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha de registro</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white dark:bg-slate-900">
              {filtered.map((u: any) => {
                const initials = getInitials(u.fullName);
                const { date, time } = formatDate(u.createdAt);
                
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {initials}
                        </div>
                        <div className="font-bold text-slate-800 text-sm">{u.fullName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-600">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(u.role)}
                      {u.role === 'PACIENTE' && (
                        <div className="mt-1 text-[11px] font-semibold">
                          {u.patient
                            ? <span className="text-emerald-600">↳ {u.patient.fullName}</span>
                            : <span className="text-amber-500">↳ sin expediente</span>}
                        </div>
                      )}
                      {u.role === 'EMPRESA' && u.company && (
                        <div className="mt-1 text-[11px] font-semibold text-indigo-500">↳ {u.company.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.active ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Activo
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Inactivo
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-slate-700">{date}</div>
                          {time && <div className="text-xs text-slate-400">{time}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {u.role === 'PACIENTE' && (
                          <button
                            className="w-9 h-9 flex items-center justify-center bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition-all shadow-sm border border-sky-100"
                            title="Ligar expediente"
                            aria-label="Ligar expediente"
                            onClick={() => setLinking(u)}
                          >
                            <Link2 size={16} />
                          </button>
                        )}
                        <button
                          className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-600"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => setEditing(u)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-all shadow-sm border border-red-100 dark:border-red-900/50"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => setConfirmDelete({ id: u.id, name: u.fullName })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <UsersIcon size={40} className="text-slate-200" />
                      <p>No se encontraron usuarios.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <UserForm isMaster={isMaster} onClose={() => setOpen(false)} onSubmit={(d: any) => create.mutate(d)} />}
      {editing && <UserForm isMaster={isMaster} initial={editing} onClose={() => setEditing(null)} onSubmit={(d: any) => update.mutate({ id: editing.id, ...d })} />}
      {companyOpen && <CompanyAccountForm onClose={() => setCompanyOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['users'] })} />}
      {linking && <LinkPatientForm user={linking} onClose={() => setLinking(null)} onSubmit={(patientId: string | null) => linkPatient.mutate({ id: linking.id, patientId })} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Confirmar eliminación</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">¿Estás seguro que deseas eliminar <span className="font-semibold text-slate-700 dark:text-slate-200">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow-sm border-0">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Crear cuenta de EMPRESA (portal) --------
// El personal la crea y liga a una empresa; el sistema envía enlace de
// activación por correo. Sin SMTP, el backend devuelve el enlace para copiarlo.
function CompanyAccountForm({ onClose, onCreated }: any) {
  const { data: companies = [] } = useQuery({ queryKey: ['companies-min'], queryFn: async () => (await api.get('/companies')).data });
  const [f, setF] = useState({ email: '', fullName: '', companyId: '' });
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/users/company-account', f);
      onCreated();
      if (data.activationLink) {
        setLink(data.activationLink); // sin SMTP: mostrar para copiar
      } else {
        toast.success('Cuenta creada. Se envió el enlace de activación por correo.');
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo crear la cuenta');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Cuenta de empresa</h2>
        <p className="text-sm text-slate-500 mb-5">La empresa recibirá un enlace para definir su contraseña.</p>

        {link ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              No hay correo configurado (SMTP). Comparte este enlace de activación con la empresa:
              <div className="mt-2 flex items-center gap-2 bg-white border border-amber-200 rounded-lg p-2">
                <input readOnly value={link} className="flex-1 text-xs bg-transparent outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Copiado'); }} className="text-amber-600"><Copy size={16} /></button>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl border-0">Listo</button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Empresa *</label>
              <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm" required value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
                <option value="">Selecciona una empresa…</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nombre de contacto *</label>
              <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="Ej. Recursos Humanos" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Correo *</label>
              <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="rh@empresa.com" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl">Cancelar</button>
              <button type="submit" disabled={loading} className="btn bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl border-0 disabled:opacity-60">{loading ? 'Creando…' : 'Crear y enviar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// -------- Ligar una cuenta PACIENTE a un expediente --------
function LinkPatientForm({ user, onClose, onSubmit }: any) {
  const { data: patients = [] } = useQuery({ queryKey: ['patients-link'], queryFn: async () => (await api.get('/patients')).data });
  const [search, setSearch] = useState('');
  const list = (patients as any[]).filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Ligar expediente</h2>
        <p className="text-sm text-slate-500 mb-4">Cuenta: <span className="font-semibold">{user.fullName}</span> ({user.email})</p>
        <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mb-3" placeholder="Buscar paciente por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSubmit(p.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-sky-50 flex items-center justify-between">
              <span className="font-medium text-slate-700">{p.fullName}</span>
              <Link2 size={14} className="text-sky-400" />
            </button>
          ))}
          {list.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Sin coincidencias.</div>}
        </div>
        <div className="flex justify-between gap-3 mt-5">
          {user.patient
            ? <button onClick={() => onSubmit(null)} className="btn bg-white border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm">Desligar</button>
            : <span />}
          <button onClick={onClose} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function UserForm({ onClose, onSubmit, initial, isMaster }: any) {
  const isEdit = !!initial;
  const [f, setF] = useState({
    email: initial?.email || '',
    fullName: initial?.fullName || '',
    role: initial?.role || 'DOCTOR',
    password: '',
    active: initial?.active ?? true,
  });
  
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h2>
        
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const payload: any = { email: f.email, fullName: f.fullName, role: f.role, active: f.active };
          if (f.password) payload.password = f.password;
          onSubmit(isEdit ? payload : { ...payload, password: f.password });
        }}>
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nombre completo *</label>
            <input 
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" 
              placeholder="Ej. Juan Pérez" 
              required 
              value={f.fullName} 
              onChange={(e) => setF({ ...f, fullName: e.target.value })} 
            />
          </div>
          
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Email *</label>
            <input 
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" 
              type="email" 
              placeholder="correo@clinica.com" 
              required 
              value={f.email} 
              onChange={(e) => setF({ ...f, email: e.target.value })} 
            />
          </div>
          
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Rol *</label>
            <select 
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" 
              value={f.role} 
              onChange={(e) => setF({ ...f, role: e.target.value })}
            >
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Doctor</option>
              <option value="PACIENTE_TABLET">Tablet</option>
              {isMaster && <option value="MASTER">Master</option>}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Contraseña {!isEdit && '*'}</label>
            <input
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
              type="password"
              placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
              required={!isEdit}
              minLength={isEdit ? undefined : 8}
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </div>
          
          {isEdit && (
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                  checked={f.active} 
                  onChange={(e) => setF({ ...f, active: e.target.checked })} 
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Cuenta activa</span>
                  <span className="text-xs text-slate-500">Permitir acceso al sistema</span>
                </div>
              </label>
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-8 pt-4">
            <button type="button" onClick={onClose} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" className="btn bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm border-0">
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
