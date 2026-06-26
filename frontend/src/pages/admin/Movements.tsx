// =============================================================
// ARCHIVO: src/pages/admin/Movements.tsx
// SECCION: ADMIN (compañero)
// DESCRIPCION: Historial de movimientos de inventario.
//              Entradas, salidas y ajustes de productos.
// API: GET /api/movements, POST /api/movements
// =============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Movements() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: list = [] } = useQuery({ queryKey: ['movements'], queryFn: async () => (await api.get('/movements')).data });
  const { data: products = [] } = useQuery({ queryKey: ['products-all'], queryFn: async () => (await api.get('/inventory/products')).data });

  const create = useMutation({
    mutationFn: async (d: any) => (await api.post('/movements', d)).data,
    onSuccess: () => { toast.success('Movimiento registrado'); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <div className="page-title">Movimientos de inventario</div>
          <div className="page-subtitle">Entradas, salidas y ajustes</div>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary">+ Nuevo movimiento</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cant.</th><th>Usuario</th><th>Motivo</th></tr></thead>
          <tbody>
            {list.map((m: any) => (
              <tr key={m.id}>
                <td className="text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                <td><span className={`badge ${m.type === 'ENTRADA' ? 'badge-green' : m.type === 'SALIDA' ? 'badge-red' : 'badge-yellow'}`}>{m.type}</span></td>
                <td className="font-semibold">{m.product.name}</td>
                <td>{m.quantity}</td>
                <td className="text-xs">{m.user.fullName}</td>
                <td className="text-xs text-ink-muted">{m.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <MovForm products={products} onClose={() => setOpen(false)} onSubmit={(d: any) => create.mutate(d)} />
        </div>
      )}
    </div>
  );
}

function MovForm({ products, onClose, onSubmit }: any) {
  const [f, setF] = useState({ type: 'ENTRADA', productId: products[0]?.id || '', quantity: 1, unitCost: '', reason: '', reference: '' });
  return (
    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
      <h2 className="text-lg font-bold mb-4">Nuevo movimiento</h2>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, quantity: +f.quantity, unitCost: f.unitCost ? +f.unitCost : null }); }}>
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option>
        </select>
        <select className="input" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>)}
        </select>
        <input className="input" type="number" placeholder="Cantidad" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value as any })} />
        {f.type === 'ENTRADA' && <input className="input" type="number" step="0.01" placeholder="Costo unitario" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />}
        <input className="input" placeholder="Motivo" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <input className="input" placeholder="Referencia / factura" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button className="btn btn-primary">Registrar</button>
        </div>
      </form>
    </div>
  );
}
