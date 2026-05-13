import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus } from 'lucide-react';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function SalesView({ darkAdmin = false }: { darkAdmin?: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: list = [] } = useQuery({ queryKey: ['sales'], queryFn: async () => (await api.get('/sales')).data });

  const create = useMutation({
    mutationFn: async (d: any) => (await api.post('/sales', d)).data,
    onSuccess: () => { toast.success('Venta registrada'); qc.invalidateQueries({ queryKey: ['sales'] }); setShowForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const containerCls = darkAdmin ? 'bg-admin-card border border-slate-800 text-slate-100' : 'card';
  const txt = darkAdmin ? 'text-slate-100' : '';

  return (
    <div className={`space-y-4 ${txt}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ventas</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> Nueva venta</button>
      </div>
      <div className={`${containerCls} rounded-xl p-4 overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className={darkAdmin ? 'text-slate-400 text-xs' : 'text-slate-500 text-xs'}>
            <tr><th className="text-left py-2">Folio</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Total</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {list.map((s: any) => (
              <tr key={s.id} className={darkAdmin ? 'border-t border-slate-800' : 'border-t border-slate-100'}>
                <td className="py-2 font-mono text-xs">{s.folio}</td>
                <td className="text-xs">{new Date(s.createdAt).toLocaleString()}</td>
                <td>{s.patient?.fullName || 'Mostrador'}</td>
                <td className="text-xs">{s.vendor.fullName}</td>
                <td className="text-xs">{s.paymentMethod}</td>
                <td>{fmt(s.total)}</td>
                <td><span className="badge bg-blue-100 text-blue-700">{s.status}</span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Sin ventas</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <SaleForm onClose={() => setShowForm(false)} onSubmit={(d) => create.mutate(d)} />}
    </div>
  );
}

function SaleForm({ onClose, onSubmit }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState('');

  const { data: products = [] } = useQuery({ queryKey: ['inv-search', search], queryFn: async () => (await api.get('/inventory/products', { params: { q: search } })).data });
  const { data: patients = [] } = useQuery({ queryKey: ['patients-list'], queryFn: async () => (await api.get('/patients')).data });
  const { data: rxs = [] } = useQuery({
    queryKey: ['rx', patientId], enabled: !!patientId,
    queryFn: async () => (await api.get('/prescriptions', { params: { patientId } })).data,
  });

  const add = (p: any) => {
    if (items.find((it) => it.productId === p.id)) return;
    setItems([...items, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.salePrice, discount: 0 }]);
  };
  const update = (i: number, patch: any) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity - it.discount, 0);
  const taxable = subtotal - discount;
  const tax = taxable * 0.16;
  const total = taxable + tax;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Agrega productos'); return; }
    onSubmit({
      patientId: patientId || null, prescriptionId: prescriptionId || null,
      items: items.map(({ productId, quantity, unitPrice, discount }) => ({ productId, quantity, unitPrice, discount })),
      discount, paymentMethod, taxRate: 0.16, status: 'PAGADA',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl my-8 text-slate-900">
        <h2 className="text-lg font-bold mb-4">Nueva Venta</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={patientId} onChange={(e) => { setPatientId(e.target.value); setPrescriptionId(''); }}>
              <option value="">Sin paciente (mostrador)</option>
              {patients.map((p: any) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
            <select className="input" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} disabled={!patientId}>
              <option value="">Sin receta</option>
              {rxs.map((r: any) => <option key={r.id} value={r.id}>{r.type} · {new Date(r.issuedAt).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <input className="input" placeholder="Buscar producto por nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-auto mt-1">
                {products.slice(0, 8).map((p: any) => (
                  <div key={p.id} onClick={() => { add(p); setSearch(''); }} className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between text-sm">
                    <span>{p.name} <span className="text-xs text-slate-400">({p.sku}) stock {p.stock}</span></span>
                    <span>${p.salePrice}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 text-xs"><th className="text-left py-1">Producto</th><th>Cant.</th><th>P. Unit.</th><th>Desc.</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2">{it.name}</td>
                  <td><input type="number" min="1" className="input w-16 py-1" value={it.quantity} onChange={(e) => update(i, { quantity: +e.target.value })} /></td>
                  <td><input type="number" step="0.01" className="input w-24 py-1" value={it.unitPrice} onChange={(e) => update(i, { unitPrice: +e.target.value })} /></td>
                  <td><input type="number" step="0.01" className="input w-20 py-1" value={it.discount} onChange={(e) => update(i, { discount: +e.target.value })} /></td>
                  <td>${(it.unitPrice * it.quantity - it.discount).toFixed(2)}</td>
                  <td><button type="button" onClick={() => remove(i)}><Trash2 size={14} className="text-red-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-2">
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="COMBINADO">Combinado</option>
              </select>
              <input type="number" step="0.01" className="input" placeholder="Descuento general" value={discount} onChange={(e) => setDiscount(+e.target.value)} />
            </div>
            <div className="text-sm space-y-1 bg-slate-50 p-3 rounded-lg">
              <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>Descuento:</span><span>- {fmt(discount)}</span></div>
              <div className="flex justify-between"><span>IVA 16%:</span><span>{fmt(tax)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>TOTAL:</span><span>{fmt(total)}</span></div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Registrar venta</button>
          </div>
        </form>
      </div>
    </div>
  );
}
