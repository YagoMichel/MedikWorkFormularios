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

const Icon = ({ name }: any) => <span className="material-symbols-rounded">{name}</span>;

export default function Inventory() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [q, setQ] = useState('');
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

  const { data: products = [] } = useQuery({ queryKey: ['products', q], queryFn: async () => (await api.get('/inventory/products', { params: { q } })).data });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/inventory/categories')).data });

  const save = useMutation({
    mutationFn: async (d: any) => editing ? (await api.put(`/inventory/products/${editing.id}`, d)).data : (await api.post('/inventory/products', d)).data,
    onSuccess: () => { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['products'] }); setOpen(false); setEditing(null); },
    onError: () => toast.error('Error al guardar'),
  });
  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/inventory/products/${id}`)).data,
    onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['products'] }); },
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn btn-primary"><Icon name="add" /> Nuevo producto</button>
      </div>
      <div className="card">
        <div className="relative max-w-xs mb-3">
          <input className="input" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th><th>Categoría</th><th className="text-right">Stock</th><th className="text-right">Costo</th><th className="text-right">Venta</th>
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
                  <td className="font-semibold">{p.name}</td>
                  <td><span className="badge badge-slate">{p.category?.name}</span></td>
                  <td className="text-right">
                    <span className={`badge ${p.stock <= p.minStock ? 'badge-red' : 'badge-green'}`}>{p.stock}/{p.minStock}</span>
                  </td>
                  <td className="text-right">${p.costPrice}</td>
                  <td className="text-right font-semibold">${p.salePrice}</td>
                  {extraCols.map((col, i) => (
                    <td key={i} className="text-center text-sm text-slate-600">
                      {(p.attributes as any)?.[col.name] || '—'}
                    </td>
                  ))}
                  <td className="text-right">
                    <button className="btn btn-secondary text-xs mr-1" onClick={() => { setEditing(p); setOpen(true); }}>Editar</button>
                    <button className="btn btn-danger text-xs" onClick={() => setConfirmDelete({ id: p.id, name: p.name })}>×</button>
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
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-bold mb-4">{initial ? 'Editar producto' : 'Nuevo producto'}</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, costPrice: +f.costPrice, salePrice: +f.salePrice, stock: +f.stock, minStock: +f.minStock }); }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Nombre</label>
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
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
