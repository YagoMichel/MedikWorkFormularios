// =============================================================
// ARCHIVO: src/pages/admin/Companies.tsx
// SECCION: ADMIN
// DESCRIPCION: Gestión de empresas cliente con diseño de alta fidelidad.
// =============================================================
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth, isAdminRole } from '../../stores/auth';
import toast from 'react-hot-toast';
import {
  Plus, Building2, CheckCircle2, Phone, Calendar,
  Search, Filter, ArrowUpDown, List, MoreVertical,
  ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, LayoutGrid
} from 'lucide-react';

const EMPTY = { name: '', contactName: '', phone: '', email: '', address: '', notes: '' };

export default function Companies() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const canManage = isAdminRole(user?.role);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | 'new' | any>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);

  // Funcionalidad de filtros y orden
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'missing'>('all');
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const save = useMutation({
    mutationFn: async (data: any) =>
      data.id ? (await api.put(`/companies/${data.id}`, data)).data
               : (await api.post('/companies', data)).data,
    onSuccess: () => { toast.success('Guardado exitosamente'); qc.invalidateQueries({ queryKey: ['companies'] }); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error?.fieldErrors?.name?.[0] || 'Error al guardar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/companies/${id}`)).data,
    onSuccess: () => { toast.success('Empresa eliminada'); qc.invalidateQueries({ queryKey: ['companies'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  // Calculate stats
  const totalCompanies = companies.length;
  const missingPhone = companies.filter((c: any) => !c.phone).length;
  const activeCompanies = totalCompanies - missingPhone;
  
  const filtered = useMemo(() => {
    let result = (companies as any[]).filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Aplicar Filtro
    if (filterMode === 'active') result = result.filter(c => !!c.phone);
    if (filterMode === 'missing') result = result.filter(c => !c.phone);

    // Aplicar Orden
    result.sort((a, b) => {
      if (sortMode === 'name_asc') return a.name.localeCompare(b.name);
      if (sortMode === 'name_desc') return b.name.localeCompare(a.name);
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (sortMode === 'date_asc') return dateA - dateB;
      if (sortMode === 'date_desc') return dateB - dateA;
      return 0;
    });

    return result;
  }, [companies, search, filterMode, sortMode]);

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex justify-end gap-2 mt-4">
        {canManage ? <button
          onClick={() => setModal(EMPTY)} 
          className="btn bg-[#3375c8] hover:bg-[#2860a5] text-white shadow-[0_4px_14px_rgba(51,117,200,0.3)] hover:shadow-[0_6px_20px_rgba(51,117,200,0.4)] hover:-translate-y-0.5 border-0"
        >
          <Plus size={18} strokeWidth={2.5} /> Nueva empresa
        </button> : (
          <div className="w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Consulta de empresas. La creación y edición corresponde a administración.
          </div>
        )}
      </div>

      {/* ── STATS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 size={24} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresas registradas</div>
            <div className="text-2xl font-bold text-slate-800 leading-tight mt-0.5">{totalCompanies}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total en el sistema</div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresas activas</div>
            <div className="text-2xl font-bold text-slate-800 leading-tight mt-0.5">{activeCompanies}</div>
            <div className="text-xs text-slate-400 mt-0.5">Con información completa</div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Phone size={24} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sin teléfono</div>
            <div className="text-2xl font-bold text-slate-800 leading-tight mt-0.5">{missingPhone}</div>
            <div className="text-xs text-slate-400 mt-0.5">Pendientes por completar</div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="card p-5 flex gap-4 items-center border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar size={24} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Última empresa agregada</div>
            <div className="text-lg font-bold text-slate-800 leading-tight mt-0.5">Hoy</div>
            <div className="text-xs text-slate-400 mt-0.5">Recientemente</div>
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
              placeholder="Buscar empresa por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto z-10">
            {/* Botón Filtros */}
            <div className="relative">
              <button 
                onClick={() => { setShowFilters(!showFilters); setShowSort(false); }} 
                className={`btn bg-white border text-sm shadow-sm px-4 h-9 flex items-center gap-2 ${showFilters || filterMode !== 'all' ? 'border-blue-400 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter size={16} /> Filtros {filterMode !== 'all' && '• 1'}
              </button>
              {showFilters && (
                <div className="absolute top-full right-0 md:left-0 mt-2 w-56 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-1">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar por estado</div>
                  <button onClick={() => { setFilterMode('all'); setShowFilters(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${filterMode === 'all' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Todas las empresas</button>
                  <button onClick={() => { setFilterMode('active'); setShowFilters(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${filterMode === 'active' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Completas (Activas)</button>
                  <button onClick={() => { setFilterMode('missing'); setShowFilters(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${filterMode === 'missing' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Sin datos</button>
                </div>
              )}
            </div>

            {/* Botón Ordenar */}
            <div className="relative">
              <button 
                onClick={() => { setShowSort(!showSort); setShowFilters(false); }} 
                className={`btn bg-white border text-sm shadow-sm px-4 h-9 flex items-center gap-2 ${showSort ? 'border-blue-400 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <ArrowUpDown size={16} /> Ordenar
              </button>
              {showSort && (
                <div className="absolute top-full right-0 md:left-0 mt-2 w-56 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-1">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Ordenar por</div>
                  <button onClick={() => { setSortMode('date_desc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'date_desc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Más recientes primero</button>
                  <button onClick={() => { setSortMode('date_asc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'date_asc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Más antiguas primero</button>
                  <button onClick={() => { setSortMode('name_asc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'name_asc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Nombre (A-Z)</button>
                  <button onClick={() => { setSortMode('name_desc'); setShowSort(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortMode === 'name_desc' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}>Nombre (Z-A)</button>
                </div>
              )}
            </div>

            {/* Toggle Lista/Grid */}
            <button 
              onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} 
              className={`w-9 h-9 flex items-center justify-center rounded-xl border text-sm shadow-sm transition-all shrink-0 ${viewMode === 'grid' ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} 
              title={viewMode === 'list' ? "Ver como cuadrícula" : "Ver como lista"}
            >
              {viewMode === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha de registro</th>
                {canManage && <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white dark:bg-slate-900">
              {filtered.map((c: any) => {
                const hasData = !!c.phone;
                const initials = c.name.substring(0, 2).toUpperCase();
                
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                          <div className="text-xs text-slate-400">{hasData ? 'Empresa registrada' : 'Sin información'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {hasData ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Phone size={14} className="text-blue-500" />
                          {c.phone}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {hasData ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Activa
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Sin datos
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Calendar size={14} className="text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-slate-700">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Hoy'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '10:00 a.m.'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {canManage && <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setModal(c)} 
                          className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                          className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-all"
                          title="Eliminar"
                          aria-label="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>}
                  </tr>
                );
              })}
              
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Building2 size={40} className="text-slate-200" />
                      <p>No se encontraron empresas.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-100">
            {filtered.map((c: any) => {
              const hasData = !!c.phone;
              const initials = c.name.substring(0, 2).toUpperCase();
              return (
                <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                      {initials}
                    </div>
                    {canManage && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md bg-white border border-slate-100 shadow-sm">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete({ id: c.id, name: c.name })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md bg-white border border-slate-100 shadow-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>}
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-lg mb-1 truncate">{c.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <Phone size={14} className={hasData ? 'text-blue-500' : 'text-slate-300'} />
                    {hasData ? c.phone : 'Sin teléfono'}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {hasData ? (
                        <span className="text-green-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Activa</span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Sin datos</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={12} /> {c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Hoy'}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filtered.length === 0 && !isLoading && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
                <p>No se encontraron empresas.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {canManage && confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Eliminar empresa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">¿Estás seguro que deseas eliminar <span className="font-semibold text-slate-700 dark:text-slate-200">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl">Cancelar</button>
              <button onClick={() => { remove.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow-sm border-0">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {canManage && modal !== null && (
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{form.id ? 'Editar empresa' : 'Nueva empresa'}</h2>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nombre *</label>
            <input 
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" 
              placeholder="Ej. Acme Corp"
              value={form.name} 
              onChange={f('name')} 
              required 
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Teléfono</label>
            <input 
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" 
              placeholder="10 dígitos"
              value={form.phone || ''} 
              onChange={f('phone')} 
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl">Cancelar</button>
          <button disabled={saving || !form.name} onClick={() => onSave(form)} className="btn bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm border-0 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar empresa'}
          </button>
        </div>
      </div>
    </div>
  );
}
