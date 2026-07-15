// =============================================================
// ARCHIVO: src/components/SalesHistory.tsx
// DESCRIPCION: Listado de compras (POS) reutilizable — resumen (compras, total
//   gastado, saldo) + tarjetas expandibles con productos, totales y abonos.
//   Lo usan la ficha del paciente (admin/doctor) y el portal del paciente.
// =============================================================
import { useState } from 'react';
import { ShoppingBag, ChevronDown } from 'lucide-react';

const money = (n: number) => (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const SALE_STATUS: Record<string, { label: string; cls: string }> = {
  PAGADA: { label: 'Pagada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  LIQUIDADA: { label: 'Liquidada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ENTREGADA: { label: 'Entregada', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PENDIENTE_ENTREGA: { label: 'Pendiente de entrega', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PENDIENTE: { label: 'Pendiente de pago', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

const PAYMENT_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', COMBINADO: 'Combinado', DEPOSITO: 'Depósito',
};

export default function SalesHistory({ sales, emptyText = 'No hay compras registradas.' }: { sales: any[]; emptyText?: string }) {
  const [abierta, setAbierta] = useState<string | null>(null);

  if (!sales || sales.length === 0) {
    return <div className="card text-sm text-slate-500">{emptyText}</div>;
  }

  const activas = sales.filter((s) => s.status !== 'CANCELADA');
  const totalGastado = activas.reduce((n, s) => n + (s.total || 0), 0);
  const saldoPendiente = activas.reduce((n, s) => n + (s.balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Compras</div>
          <div className="text-xl font-bold mt-0.5">{activas.length}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Total gastado</div>
          <div className="text-xl font-bold mt-0.5 text-emerald-600">{money(totalGastado)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Saldo pendiente</div>
          <div className={`text-xl font-bold mt-0.5 ${saldoPendiente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{money(saldoPendiente)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {sales.map((s) => {
          const st = SALE_STATUS[s.status] || { label: s.status, cls: 'bg-slate-100 text-slate-600' };
          const open = abierta === s.id;
          return (
            <div key={s.id} className="card p-0 overflow-hidden">
              <button type="button" onClick={() => setAbierta(open ? null : s.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <ShoppingBag size={18} className="text-[#3375c8] shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{s.folio}</div>
                  <div className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}{s.vendor?.fullName ? ` · ${s.vendor.fullName}` : ''}</div>
                </div>
                <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <span className="font-bold text-sm whitespace-nowrap">{money(s.total)}</span>
                <ChevronDown size={18} className={`transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3">
                  <div className="space-y-1">
                    {(s.items || []).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{it.product?.name || 'Producto'}</span>
                          <span className="text-slate-400"> × {it.quantity}</span>
                          {it.discount > 0 && <span className="text-xs text-amber-600"> (desc. {money(it.discount)})</span>}
                        </div>
                        <span className="whitespace-nowrap">{money(it.subtotal)}</span>
                      </div>
                    ))}
                    {(s.items || []).length === 0 && <div className="text-xs text-slate-400">Sin productos detallados.</div>}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-2 space-y-1 text-sm">
                    {s.discount > 0 && <div className="flex justify-between text-slate-500"><span>Descuento</span><span>-{money(s.discount)}</span></div>}
                    <div className="flex justify-between font-semibold"><span>Total</span><span>{money(s.total)}</span></div>
                    <div className="flex justify-between text-xs text-slate-400"><span>Método de pago</span><span>{PAYMENT_LABEL[s.paymentMethod] || s.paymentMethod}</span></div>
                    {s.balance > 0 && (
                      <>
                        <div className="flex justify-between text-slate-500"><span>Anticipo</span><span>{money(s.deposit)}</span></div>
                        <div className="flex justify-between text-amber-600 font-semibold"><span>Saldo pendiente</span><span>{money(s.balance)}</span></div>
                      </>
                    )}
                  </div>

                  {(s.abonos || []).length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Abonos</div>
                      {s.abonos.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between text-xs text-slate-500">
                          <span>{new Date(a.createdAt).toLocaleDateString('es-MX')} · {PAYMENT_LABEL[a.method] || a.method}</span>
                          <span>{money(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.notes && <div className="text-xs text-slate-400 italic">Nota: {s.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
