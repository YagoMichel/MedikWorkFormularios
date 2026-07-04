import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Search, Receipt, CreditCard, ChevronRight } from 'lucide-react';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function SalesView({ darkAdmin = false }: { darkAdmin?: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: list = [] } = useQuery({ queryKey: ['sales'], queryFn: async () => (await api.get('/sales')).data });

  const create = useMutation({
    mutationFn: async (d: any) => (await api.post('/sales', d)).data,
    onSuccess: () => { toast.success('Venta registrada exitosamente'); qc.invalidateQueries({ queryKey: ['sales'] }); setShowForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al registrar la venta'),
  });

  return (
    <div className="space-y-6 pt-2">
      <div className="flex justify-end items-center">
        <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-[#2560aa] hover:bg-[#1c4b85] text-white font-bold rounded-xl shadow-lg shadow-[#2560aa]/30 transition-all flex items-center gap-2 hover:scale-105">
          <Plus size={18} />
          <span>Nueva Venta</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Folio</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Vendedor</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Método de Pago</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total</th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s: any) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                  <td className="py-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {s.folio}
                  </td>
                  <td className="py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {new Date(s.createdAt).toLocaleDateString('es-MX')} <span className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="py-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {s.patient?.fullName || 'Mostrador'}
                  </td>
                  <td className="py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {s.vendor?.fullName || 'N/A'}
                  </td>
                  <td className="py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                      <CreditCard size={12} /> {s.paymentMethod}
                    </span>
                  </td>
                  <td className="py-4 text-right font-black text-slate-800 dark:text-slate-100">
                    {fmt(s.total)}
                  </td>
                  <td className="py-4 text-center">
                    <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider
                      ${s.status === 'PAGADA' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                      : s.status === 'CANCELADA' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}
                    `}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt size={32} className="opacity-20" />
                      No hay ventas registradas en el sistema.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <SaleForm onClose={() => setShowForm(false)} onSubmit={(d: any) => create.mutate(d)} />}
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
    if (items.length === 0) { toast.error('Debes agregar al menos un producto a la venta'); return; }
    onSubmit({
      patientId: patientId || null, prescriptionId: prescriptionId || null,
      items: items.map(({ productId, quantity, unitPrice, discount }) => ({ productId, quantity, unitPrice, discount })),
      discount, paymentMethod, taxRate: 0.16, status: 'PAGADA',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col my-8">
        
        {/* Top border bar */}
        <div className="h-2 w-full rounded-t-2xl bg-gradient-to-r from-[#2560aa] to-[#51abcd]"></div>
        
        <div className="p-8">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
          
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            Nueva Venta
          </h2>
          
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente (Opcional)</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-[#2560aa]/50 outline-none transition-all" value={patientId} onChange={(e) => { setPatientId(e.target.value); setPrescriptionId(''); }}>
                  <option value="">Mostrador (Sin paciente)</option>
                  {patients.map((p: any) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receta Asociada</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-[#2560aa]/50 outline-none transition-all disabled:opacity-50" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} disabled={!patientId}>
                  <option value="">Ninguna</option>
                  {rxs.map((r: any) => <option key={r.id} value={r.id}>Receta {r.type} · {new Date(r.issuedAt).toLocaleDateString()}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-slate-400" />
                </div>
                <input 
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#51abcd]/30 bg-blue-50/30 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-[#51abcd] outline-none transition-all placeholder:text-slate-400" 
                  placeholder="Buscar producto por nombre o SKU para agregar a la venta..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              
              {search && (
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto bg-white dark:bg-slate-800 shadow-xl absolute w-full max-w-2xl z-20">
                  {products.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No se encontraron productos</div>
                  ) : (
                    products.slice(0, 8).map((p: any) => (
                      <div key={p.id} onClick={() => { add(p); setSearch(''); }} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                          <div className="text-xs text-slate-500 font-mono">SKU: {p.sku} <span className="mx-2">•</span> Stock: <span className={p.stock > 0 ? 'text-emerald-600' : 'text-red-500 font-bold'}>{p.stock}</span></div>
                        </div>
                        <div className="font-black text-[#2560aa] dark:text-[#51abcd]">{fmt(p.salePrice)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <table className="w-full text-left bg-white dark:bg-slate-900">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Cant.</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">P. Unit.</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Desc. ($)</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32 text-right">Subtotal</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200">{it.name}</td>
                      <td className="py-3 px-2">
                        <input type="number" min="1" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-semibold text-center focus:ring-2 focus:ring-[#2560aa]/50 outline-none transition-all" value={it.quantity} onChange={(e) => update(i, { quantity: +e.target.value })} />
                      </td>
                      <td className="py-3 px-2">
                        <input type="number" step="0.01" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-semibold text-right focus:ring-2 focus:ring-[#2560aa]/50 outline-none transition-all" value={it.unitPrice} onChange={(e) => update(i, { unitPrice: +e.target.value })} />
                      </td>
                      <td className="py-3 px-2">
                        <input type="number" step="0.01" min="0" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 text-sm font-semibold text-right focus:ring-2 focus:ring-red-500/50 outline-none transition-all" value={it.discount} onChange={(e) => update(i, { discount: +e.target.value })} />
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-black text-[#2560aa] dark:text-[#51abcd]">
                        {fmt((it.unitPrice * it.quantity) - it.discount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button type="button" onClick={() => remove(i)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                        No hay productos en la venta. Usa el buscador de arriba para agregar uno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="md:col-span-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Método de Pago</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#2560aa]/50 outline-none transition-all" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="EFECTIVO">💵 Efectivo</option>
                    <option value="TARJETA">💳 Tarjeta (Crédito/Débito)</option>
                    <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                    <option value="COMBINADO">🔀 Combinado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descuento Global Adicional ($)</label>
                  <input type="number" step="0.01" min="0" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold focus:ring-2 focus:ring-red-500/50 outline-none transition-all" placeholder="0.00" value={discount || ''} onChange={(e) => setDiscount(+e.target.value)} />
                </div>
              </div>
              
              <div className="md:col-span-7 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                    <span>Subtotal de productos:</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-red-500 text-sm font-bold">
                      <span>Descuento global aplicado:</span>
                      <span>- {fmt(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                    <span>IVA (16%):</span>
                    <span>{fmt(tax)}</span>
                  </div>
                  <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-2"></div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Total a Cobrar:</span>
                    <span className="text-3xl font-black text-[#2560aa] dark:text-[#51abcd] leading-none">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={items.length === 0} className="px-8 py-3 bg-[#2560aa] hover:bg-[#1c4b85] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-[#2560aa]/30 transition-all flex items-center gap-2 hover:-translate-y-0.5">
                Procesar Venta <ChevronRight size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
