// =============================================================
// ARCHIVO: src/pages/admin/Inventory.tsx
// SECCION: ADMIN (compañero)
// DESCRIPCION: Gestion de inventario de productos (lentes, armazones, etc).
//              Permite ver stock, agregar productos y subir imagen.
// API: GET/POST/PUT/DELETE /api/inventory
// =============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Package, PackageCheck, AlertTriangle, PackageX, Camera } from 'lucide-react';

const Icon = ({ name }: any) => <span className="material-symbols-rounded">{name}</span>;

export default function Inventory() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string>('');
  type ColDef = { name: string; type: 'text' | 'number' };
  const [extraCols, setExtraCols] = useState<ColDef[]>(() => {
    try { return JSON.parse(localStorage.getItem('inv-cols') || '[]'); } catch { return []; }
  });
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newCol, setNewCol] = useState<ColDef>({ name: '', type: 'text' });
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const colInputRef = useRef<HTMLInputElement>(null);

  const saveExtraCols = (cols: ColDef[]) => {
    setExtraCols(cols);
    localStorage.setItem('inv-cols', JSON.stringify(cols));
  };

  const { data: products = [] } = useQuery({
    queryKey: ['products', q, catFilter],
    queryFn: async () => (await api.get('/inventory/products', { params: { q, categoryId: catFilter || undefined } })).data,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/inventory/categories')).data });

  // Ventas del mes actual para calcular "vendido este mes" por producto
  const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
  const { data: salesMonth = [] } = useQuery({
    queryKey: ['sales-month'],
    queryFn: async () => (await api.get('/sales', { params: { from: mesInicio.toISOString(), status: undefined } })).data,
  });
  const soldThisMonth: Record<string, number> = {};
  for (const sale of salesMonth as any[]) {
    if (sale.status === 'CANCELADA') continue;
    for (const item of sale.items || []) {
      soldThisMonth[item.productId] = (soldThisMonth[item.productId] || 0) + item.quantity;
    }
  }

  const save = useMutation({
    mutationFn: async (payload: { json: any; file: File | null }) => {
      let res;
      if (editing) {
        res = (await api.put(`/inventory/products/${editing.id}`, payload.json)).data;
      } else {
        res = (await api.post('/inventory/products', payload.json)).data;
      }
      if (payload.file) {
        const fd = new FormData();
        fd.append('photo', payload.file);
        res = (await api.post(`/inventory/products/${res.id}/photo`, fd)).data;
      }
      return res;
    },
    onSuccess: () => { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['products'] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al guardar'),
  });
  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/inventory/products/${id}`)).data,
    onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['products'] }); },
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn btn-primary"><Icon name="add" /> Nuevo producto</button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package size={24} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Productos totales</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">{products.length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Todos los productos</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PackageCheck size={24} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">En stock</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">{products.filter((p: any) => p.stock > p.minStock).length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Disponibles</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Stock bajo</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">{products.filter((p: any) => p.stock > 0 && p.stock <= p.minStock).length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Próximos a agotarse</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <PackageX size={24} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Sin stock</p>
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">{products.filter((p: any) => p.stock <= 0).length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Agotados</p>
          </div>
        </div>
      </div>

      <div className="card">
        {/* Filtros por categoría */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setCatFilter('')}
            className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-lg transition-colors cursor-pointer border-none
              ${catFilter === '' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Todas <span className="opacity-70 ml-1">({products.length})</span>
          </button>
          {(categories as any[]).map((c: any) => {
            const active = catFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-lg transition-colors cursor-pointer border-none
                  ${active 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="relative max-w-xs mb-3">
          <input className="input" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Producto</th><th>Categoría</th><th>Stock</th><th className="text-right">Vendido mes</th><th className="text-right">Costo</th><th className="text-right">Venta</th>
                {extraCols.map((col, i) => (
                  <th key={i} className="text-center min-w-[120px]">
                    {editingCol === i ? (
                      <div className="flex flex-col gap-1 items-center">
                        <input autoFocus className="border border-slate-300 rounded px-1 py-0.5 text-xs w-24"
                          value={col.name}
                          onChange={(e) => { const c = [...extraCols]; c[i] = { ...c[i], name: e.target.value }; saveExtraCols(c); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEditingCol(null); if (e.key === 'Escape') setEditingCol(null); }}
                        />
                        <select className="border border-slate-300 rounded px-1 py-0.5 text-xs w-24"
                          value={col.type}
                          onChange={(e) => { const c = [...extraCols]; c[i] = { ...c[i], type: e.target.value as any }; saveExtraCols(c); }}>
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                        </select>
                        <button className="text-xs text-primary-600 font-semibold" onMouseDown={() => setEditingCol(null)}>✓ Ok</button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 justify-center">
                        <button onClick={() => setEditingCol(i)} className="hover:text-primary-600 transition font-semibold">
                          {col.name}
                          <span className="text-[9px] text-slate-400 ml-1">({col.type === 'number' ? '123' : 'abc'})</span>
                        </button>
                        <button onClick={() => saveExtraCols(extraCols.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-red-400 transition text-xs">✕</button>
                      </span>
                    )}
                  </th>
                ))}
                <th>
                  {addingCol ? (
                    <div className="flex flex-col gap-1 items-center">
                      <input ref={colInputRef} autoFocus className="border border-slate-300 rounded px-2 py-0.5 text-xs w-24"
                        placeholder="Nombre..." value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newCol.name.trim()) { saveExtraCols([...extraCols, { ...newCol, name: newCol.name.trim() }]); setNewCol({ name: '', type: 'text' }); setAddingCol(false); }
                          if (e.key === 'Escape') { setAddingCol(false); setNewCol({ name: '', type: 'text' }); }
                        }}
                      />
                      <select className="border border-slate-300 rounded px-1 py-0.5 text-xs w-24"
                        value={newCol.type} onChange={(e) => setNewCol({ ...newCol, type: e.target.value as any })}>
                        <option value="text">Texto</option>
                        <option value="number">Número</option>
                      </select>
                      <button className="text-xs text-primary-600 font-semibold" onClick={() => { if (newCol.name.trim()) { saveExtraCols([...extraCols, { ...newCol, name: newCol.name.trim() }]); } setNewCol({ name: '', type: 'text' }); setAddingCol(false); }}>✓ Ok</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingCol(true)}
                      className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-base font-bold transition">+</button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-11 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700/50">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="text-slate-300 dark:text-slate-600" size={20} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.name}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Código: {p.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-slate">{p.category?.name}</span></td>
                  <td>
                    {(() => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                      const isHighStock = p.stock > p.minStock;
                      
                      let colorClass = 'bg-emerald-500';
                      let textColor = 'text-emerald-600';
                      let statusText = 'Stock alto';
                      let percent = Math.min(100, (p.stock / Math.max(p.minStock * 2, 20)) * 100);

                      if (isOutOfStock) {
                        colorClass = 'bg-red-500';
                        textColor = 'text-red-600';
                        statusText = 'Agotado';
                        percent = 0;
                      } else if (isLowStock) {
                        colorClass = 'bg-amber-500';
                        textColor = 'text-amber-600';
                        statusText = 'Stock bajo';
                        percent = Math.max(10, Math.min(100, (p.stock / p.minStock) * 100));
                      }

                      return (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }}></div>
                            </div>
                            <span className={`text-xs font-bold ${textColor}`}>{p.stock} piezas</span>
                          </div>
                          <div className={`text-[11px] font-semibold flex items-center gap-1 ${textColor}`}>
                            <span className="text-[10px]">●</span> {statusText}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="text-right">
                    {soldThisMonth[p.id]
                      ? <span className="badge badge-blue">{soldThisMonth[p.id]}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-right">${p.costPrice}</td>
                  <td className="text-right font-semibold">${p.salePrice}</td>
                  {extraCols.map((col, i) => (
                    <td key={i} className="text-center text-sm text-slate-600">
                      {(p.attributes as any)?.[col.name] || '—'}
                    </td>
                  ))}
                  <td className="text-right flex items-center justify-end gap-2">
                    <button 
                      className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all" 
                      title="Editar"
                      aria-label="Editar"
                      onClick={() => { setEditing(p); setOpen(true); }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-all" 
                      title="Eliminar"
                      aria-label="Eliminar"
                      onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ProductForm initial={editing} categories={categories} extraCols={extraCols} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => save.mutate(d)} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-red-600">Confirmar eliminación</h2>
            <p className="text-sm text-slate-600">¿Estás seguro que deseas eliminar <span className="font-semibold">"{confirmDelete.name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => { del.mutate(confirmDelete.id); setConfirmDelete(null); }} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({ initial, categories, extraCols, onClose, onSubmit }: any) {
  const [f, setF] = useState({
    sku: initial?.sku || '', name: initial?.name || '', categoryId: initial?.categoryId || (categories[0]?.id || ''),
    brand: initial?.brand || '', costPrice: initial?.costPrice ?? 0, salePrice: initial?.salePrice ?? 0,
    stock: initial?.stock ?? 0, minStock: initial?.minStock ?? 0, description: initial?.description || '',
    attributes: initial?.attributes || {},
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold mb-4">{initial ? 'Editar producto' : 'Nuevo producto'}</h2>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const slug = f.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const sku = f.sku || `AUTO-${slug}-${Date.now()}`;
          onSubmit({ json: { ...f, sku, costPrice: +f.costPrice, salePrice: +f.salePrice, stock: +f.stock, minStock: +f.minStock }, file });
        }}>
          <div className="flex gap-4">
            <div 
              className="relative w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50 cursor-pointer overflow-hidden hover:bg-slate-100 transition-colors" 
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
              ) : initial?.imageUrl ? (
                <img src={initial.imageUrl} alt="product" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={24} />
                  <span className="text-[10px] mt-1 font-medium text-center leading-tight">Añadir<br/>Foto</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
            </div>

            <div className="flex-1 flex flex-col justify-end gap-1">
              <label className="text-xs text-slate-500">Nombre</label>
              <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Categoría</label>
            <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Costo</label>
              <input className="input" type="number" step="0.01" value={f.costPrice} onChange={(e) => setF({ ...f, costPrice: e.target.value as any })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Venta</label>
              <input className="input" type="number" step="0.01" value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value as any })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Stock</label>
              <input className="input" type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value as any })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Stock mínimo</label>
              <input className="input" type="number" value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value as any })} />
            </div>
          </div>
          {extraCols.length > 0 && (
            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
              {extraCols.map((col: any, i: number) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">{col.name}</label>
                  <input className="input" type={col.type === 'number' ? 'number' : 'text'}
                    value={(f.attributes as any)[col.name] || ''}
                    onChange={(e) => setF({ ...f, attributes: { ...(f.attributes as any), [col.name]: e.target.value } })} />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
