// =============================================================
// ARCHIVO: src/pages/pos/POS.tsx
// SECCION: ADMIN
// DESCRIPCION: Módulo Punto de Venta.
//   Tab 1 "Nueva Cuenta" — carrito + cliente + lente + anticipo
//   Tab 2 "Cuentas Pendientes" — lista PENDIENTE + pago final
// =============================================================

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Trash2, Search, ShoppingBag, User, Eye,
  CreditCard, CheckCircle2, Wallet, Banknote, Download,
  Glasses, Plus, Clock, Disc, Sparkles, Shield, VenetianMask, Disc3, Circle, Sparkle
} from 'lucide-react';
import CotizadorGuiado, { type CotItem } from './CotizadorGuiado';
import logoUrl from '../../assets/logo.png';

const fmt = (n: number) =>
  `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// Carga html2pdf una sola vez y reutiliza la promesa entre llamadas concurrentes.
let html2pdfPromise: Promise<void> | null = null;
function loadHtml2Pdf(): Promise<void> {
  if ((window as any).html2pdf) return Promise.resolve();
  if (!html2pdfPromise) {
    html2pdfPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve();
      script.onerror = () => { html2pdfPromise = null; reject(new Error('No se pudo cargar la librería PDF')); };
      document.head.appendChild(script);
    });
  }
  return html2pdfPromise;
}

const LENS_TYPES = [
  'Monofocal', 'Bifocal', 'Progresivo', 'Antirreflejante',
  'Fotocromático', 'Multifocal', 'Ocupacional', 'Otro',
];

type CartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  availableStock: number;
};

type PendingSale = {
  id: string;
  folio: string;
  patient?: {
    fullName: string;
    phone?: string;
    email?: string;
    gender?: string;
    birthDate?: string;
    nss?: string;
    address?: string;
    company?: string;
    companyId?: string;
    companyRel?: { name: string };
  };
  total: number;
  deposit: number;
  balance: number;
  depositMethod?: string;
  finalPaymentMethod?: string;
  lensType?: string;
  lensEye?: string;
  pd?: string;
  odEsf?: string;
  odCil?: string;
  odEje?: string;
  odAdd?: string;
  oiEsf?: string;
  oiCil?: string;
  oiEje?: string;
  oiAdd?: string;
  referralHospital?: string;
  status: string;
  createdAt: string;
  vendor: { fullName: string };
  notes?: string;
  items?: { id: string; product?: { name: string }; quantity: number; unitPrice: number; subtotal: number; discount: number }[];
  abonos?: { id: string; amount: number; method: string; notes?: string; createdAt: string; user: { fullName: string } }[];
};

async function printSaleDetail(id: string) {
  let container: HTMLDivElement | null = null;
  try {
    const { data: s } = await api.get(`/sales/${id}`);
    const p = s.patient || {};
    const rx = (label: string, esf?: string, cil?: string, eje?: string, add?: string) =>
      (esf || cil || eje || add)
        ? `<tr><td><b>${label}</b></td><td>${esf || '—'}</td><td>${cil || '—'}</td><td>${eje || '—'}</td><td>${add || '—'}</td></tr>`
        : '';
    const items = (s.items || []).map((it: any) =>
      `<tr><td>${it.product?.name || '—'}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${fmt(it.unitPrice)}</td><td style="text-align:right">${fmt(it.subtotal)}</td></tr>`
    ).join('');
    const abonos = (s.abonos || []).map((a: any) =>
      `<tr><td>${new Date(a.createdAt).toLocaleString('es-MX')}</td><td>${a.method}</td><td>${a.user?.fullName || ''}</td><td style="text-align:right"><b>+ ${fmt(a.amount)}</b></td></tr>`
    ).join('');

    const logoAbs = new URL(logoUrl, window.location.origin).href;

    const inner = `
<style>
  .pdf-wrap * { box-sizing: border-box; font-family: Arial, sans-serif; color: #111; }
  .pdf-wrap { width: 680px; padding: 20px; background: #fff; }
  .pdf-wrap .brand { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #3375c8; margin-bottom: 16px; }
  .pdf-wrap .brand-left { display: flex; align-items: center; gap: 12px; }
  .pdf-wrap .brand img { height: 48px; width: auto; }
  .pdf-wrap .brand h1 { font-size: 22px; margin: 0; color: #3375c8; letter-spacing: 1px; }
  .pdf-wrap .brand .sub { font-size: 11px; color: #666; margin-top: 2px; }
  .pdf-wrap .folio { text-align: right; font-size: 12px; color: #666; }
  .pdf-wrap .folio b { font-size: 14px; color: #111; }
  .pdf-wrap h2 { font-size: 13px; margin: 18px 0 8px; color: #3375c8; border-bottom: 1px solid #ddd; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pdf-wrap table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .pdf-wrap th, .pdf-wrap td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; }
  .pdf-wrap th { background: #f5f7fb; font-size: 11px; text-transform: uppercase; color: #666; }
  .pdf-wrap .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; }
  .pdf-wrap .kv > div { padding: 4px 0; border-bottom: 1px dotted #eee; }
  .pdf-wrap .kv label { color: #666; margin-right: 8px; }
  .pdf-wrap .totals td { padding: 4px 8px; }
  .pdf-wrap .totals .grand { font-weight: bold; font-size: 14px; border-top: 2px solid #333; }
  .pdf-wrap .foot { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #888; text-align: center; }
  .pdf-wrap .policies { list-style: none; padding: 0; margin: 0; font-size: 11px; color: #444; line-height: 1.6; }
  .pdf-wrap .policies li { padding: 2px 0; }
  .pdf-wrap .policies .blank { display: inline-block; min-width: 200px; border-bottom: 1px solid #333; }
</style>
<div class="pdf-wrap">
  <div class="brand">
    <div class="brand-left">
      <img src="${logoAbs}" alt="Mediwork" crossorigin="anonymous" />
      <div>
        <h1>MEDIWORK</h1>
        <div class="sub">Detalle de Cuenta</div>
        <div class="sub">WhatsApp: 492 101 2261</div>
      </div>
    </div>
    <div class="folio">
      Folio: <b>${s.folio}</b><br/>
      ${new Date(s.createdAt).toLocaleDateString('es-MX')}<br/>
      Estado: <b>${s.status}</b>
    </div>
  </div>

  <h2>Cliente / Paciente</h2>
  ${p.fullName ? `<div class="kv">
    <div><label>Nombre:</label>${p.fullName || '—'}</div>
    <div><label>Teléfono:</label>${p.phone || '—'}</div>
  </div>` : '<p style="color:#999">Venta de mostrador (sin cliente registrado)</p>'}

  <h2>Orden de Lente</h2>
  <div class="kv">
    <div><label>Tipo:</label>${s.lensType || '—'}</div>
    <div><label>DP:</label>${s.pd || '—'}</div>
    <div style="grid-column: span 2"><label>Notas:</label>${s.notes || '—'}</div>
  </div>
  ${(s.odEsf || s.oiEsf) ? `<table style="margin-top:10px">
    <thead><tr><th></th><th>ESF</th><th>CIL</th><th>EJE</th><th>ADD</th></tr></thead>
    <tbody>${rx('D', s.odEsf, s.odCil, s.odEje, s.odAdd)}${rx('I', s.oiEsf, s.oiCil, s.oiEje, s.oiAdd)}</tbody>
  </table>` : ''}

  ${items ? `<h2>Artículos / Servicios</h2>
  <table><thead><tr><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">P. Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
  <tbody>${items}</tbody></table>` : ''}

  <h2>Pagos</h2>
  <table class="totals">
    <tbody>
      <tr><td>Total</td><td style="text-align:right">${fmt(s.total)}</td></tr>
      <tr><td>Anticipo (${s.depositMethod || '—'})</td><td style="text-align:right">${fmt(s.deposit)}</td></tr>
      <tr class="grand"><td>Saldo pendiente</td><td style="text-align:right">${fmt(s.balance)}</td></tr>
    </tbody>
  </table>
  ${abonos ? `<h2>Historial de abonos</h2>
  <table><thead><tr><th>Fecha</th><th>Método</th><th>Usuario</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>${abonos}</tbody></table>` : ''}

  <h2>Políticas de la empresa</h2>
  <ul class="policies">
    <li>Facturación solo dentro del mes de compra.</li>
    <li>Para cualquier aclaración y garantía, presentar su nota de compra, sin nota no hay garantía.</li>
    <li>La empresa no se hace responsable en armazones usados o que no son de la empresa.</li>
    <li>La graduación cuenta con 15 días de garantía.</li>
  </ul>

  <div class="foot">
    MediWork · WhatsApp: 492 101 2261<br/>
    Atendió: ${s.vendor?.fullName || '—'} · Documento generado el ${new Date().toLocaleString('es-MX')}
  </div>
</div>`;

    await loadHtml2Pdf();
    const win = window as any;

    container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '680px';
    container.innerHTML = inner;
    document.body.appendChild(container);

    const wrapEl = container.querySelector('.pdf-wrap') as HTMLElement;
    const img = wrapEl.querySelector('img');
    if (img && !img.complete) {
      await new Promise((res) => { img.onload = res; img.onerror = res; });
    }

    const safeName = (s.patient?.fullName?.trim() || 'Mostrador')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');

    const margin = 10; // mm
    const pageW = 210; // A4 ancho mm
    const mmPerPx = (pageW - margin * 2) / 680;
    const pageH = wrapEl.scrollHeight * mmPerPx + margin * 2;

    const opts = {
      margin: [margin, margin, margin, margin],
      filename: `${safeName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 680,
        windowWidth: 680,
        x: 0,
        y: 0,
      },
      jsPDF: { unit: 'mm', format: [pageW, pageH], orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await win.html2pdf().set(opts).from(wrapEl).toPdf().get('pdf').then((pdf: any) => {
      const total = pdf.internal.getNumberOfPages();
      for (let i = total; i > 1; i--) pdf.deletePage(i);
    }).save();
    toast.success('PDF descargado');
  } catch (e: any) {
    console.error('PDF error:', e);
    toast.error(e.response?.data?.error || e.message || 'Error al generar el PDF');
  } finally {
    container?.remove();
  }
}

// ─────────────────────────────────────────────────────────────
export default function POS() {
  const [tab, setTab] = useState<'nueva' | 'activas' | 'pagadas'>('nueva');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Punto de Venta</h1>
          <p className="page-subtitle">Registro de ventas y cuentas de clientes</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`tab-btn flex items-center gap-2`}
            style={tab === 'nueva' ? { background: '#3375c8', color: '#fff' } : {}}
            onClick={() => setTab('nueva')}
          >
            <Plus size={16} /> Nueva Cuenta
          </button>
          <button
            className={`tab-btn flex items-center gap-2`}
            style={tab === 'activas' ? { background: '#3375c8', color: '#fff' } : {}}
            onClick={() => setTab('activas')}
          >
            <Clock size={16} /> Cuentas Pendientes
          </button>
          <button
            className={`tab-btn flex items-center gap-2`}
            style={tab === 'pagadas' ? { background: '#3375c8', color: '#fff' } : {}}
            onClick={() => setTab('pagadas')}
          >
            <CheckCircle2 size={16} /> Cuentas Pagadas
          </button>
        </div>
      </div>

      {tab === 'nueva' && <NuevaCuenta />}
      {tab === 'activas' && <CuentasActivas />}
      {tab === 'pagadas' && <CuentasPagadas />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab 1: Nueva Cuenta
// ─────────────────────────────────────────────────────────────
function NuevaCuenta() {
  const qc = useQueryClient();

  // Cart
  const [items, setItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  // Patient
  const [patient, setPatient] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);
  const [clientTab, setClientTab] = useState<'particular' | 'empresa'>('particular');
  const [companyFilter, setCompanyFilter] = useState('');

  // Lens
  const [lensType, setLensType] = useState('');
  const [lensTypeCustom, setLensTypeCustom] = useState('');
  const [lensEye, setLensEye] = useState('');
  const [pd, setPd] = useState('');
  const [odEsf, setOdEsf] = useState('');
  const [odCil, setOdCil] = useState('');
  const [odEje, setOdEje] = useState('');
  const [odAdd, setOdAdd] = useState('');
  const [oiEsf, setOiEsf] = useState('');
  const [oiCil, setOiCil] = useState('');
  const [oiEje, setOiEje] = useState('');
  const [oiAdd, setOiAdd] = useState('');

  // Payment
  const [discount, setDiscount] = useState<string>('');
  const [deposit, setDeposit] = useState<string>('');
  const [depositMethod, setDepositMethod] = useState('EFECTIVO');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: products = [] } = useQuery({
    queryKey: ['inv-search', productSearch],
    queryFn: async () =>
      productSearch.length >= 2
        ? (await api.get('/inventory/products', { params: { q: productSearch } })).data
        : [],
    enabled: productSearch.length >= 2,
  });

  const { data: allPatients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => (await api.get('/patients')).data,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const filteredPatients = (allPatients as any[])
    .filter((p) =>
      !patientSearch ||
      p.fullName?.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.phone?.includes(patientSearch),
    )
    .slice(0, 10);

  // Totals
  const subtotal = items.reduce(
    (s, it) => s + it.unitPrice * it.quantity - it.discount,
    0,
  );
  // El campo "discount" ahora es PORCENTAJE (0-100). Calculamos el monto real.
  const discountPct = Math.min(100, Math.max(0, parseFloat(discount) || 0));
  const discountNum = +(subtotal * discountPct / 100).toFixed(2);
  const total = subtotal - discountNum;
  const depositNum = parseFloat(deposit) || 0;
  const depositCapped = Math.min(depositNum, total);
  const balance = Math.max(0, total - depositCapped);
  // Anticipo mínimo del 30% para poder hacer el encargo de lentes
  const minAnticipo = +(total * 0.30).toFixed(2);
  const anticipoInsuficiente = total > 0 && depositCapped > 0 && depositCapped < minAnticipo;
  const sinAnticipo = total > 0 && depositCapped === 0;

  // Mutation
  const create = useMutation({
    mutationFn: (data: any) => api.post('/sales/pos', data).then((r) => r.data),
    onSuccess: (sale: any) => {
      toast.success(`Cuenta ${sale.folio} creada`);
      setItems([]);
      setPatient(null);
      setPatientSearch('');
      setCompanyFilter('');
      setClientTab('particular');
      setLensType('');
      setLensEye('');
      setDeposit('');
      setDiscount('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales-pending'] });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error || 'Error al crear la cuenta'),
  });

  // Cart helpers
  const addItem = (p: any) => {
    if (p.stock <= 0 && p.stock < 9000) {
      toast.error(`Sin stock: ${p.name}`);
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === p.id);
      if (idx >= 0) {
        const next = prev[idx].quantity + 1;
        if (p.stock < 9000 && next > p.stock) {
          toast.error(`Stock máximo: ${p.stock}`);
          return prev;
        }
        return prev.map((it, i) => i === idx ? { ...it, quantity: next } : it);
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, quantity: 1, unitPrice: p.salePrice, discount: 0, availableStock: p.stock },
      ];
    });
    setProductSearch('');
    setShowProductDrop(false);
  };

  // Toggle para la tabla: si ya está en carrito lo quita, si no lo agrega.
  // singleGroupIds: si se pasa, garantiza que solo UN producto de ese grupo
  // pueda estar en el carrito (al agregar, quita cualquier otro del grupo).
  const toggleItem = (p: any, singleGroupIds?: string[]) => {
    const idx = items.findIndex((it) => it.productId === p.id);
    if (idx >= 0) {
      setItems((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    if (singleGroupIds && singleGroupIds.length > 0) {
      const groupSet = new Set(singleGroupIds);
      setItems((prev) => {
        const filtered = prev.filter((it) => !groupSet.has(it.productId));
        return [
          ...filtered,
          {
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitPrice: p.salePrice,
            discount: 0,
            availableStock: p.stock,
          },
        ];
      });
      return;
    }
    addItem(p);
  };

  const updateItem = (i: number, patch: Partial<CartItem>) =>
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const merged = { ...it, ...patch };
      if (patch.quantity !== undefined && it.availableStock < 9000) {
        merged.quantity = Math.min(patch.quantity, it.availableStock);
      }
      return merged;
    }));

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error('Agrega al menos un producto o servicio');
      return;
    }
    const overStock = items.find(
      (it) => it.availableStock < 9000 && it.quantity > it.availableStock,
    );
    if (overStock) {
      toast.error(`Stock insuficiente: ${overStock.name} (disponible: ${overStock.availableStock})`);
      return;
    }
    create.mutate({
      patientId: patient?.id || null,
      items: items.map(({ productId, quantity, unitPrice, discount: d }) => ({
        productId,
        quantity,
        unitPrice,
        discount: d,
      })),
      discount: discountNum,
      deposit: depositCapped,
      depositMethod: depositCapped > 0 ? depositMethod : undefined,
      lensType: lensType === 'Otro' ? (lensTypeCustom.trim() || 'Otro') : (lensType || null),
      lensEye: lensEye || null,
      pd: pd || null,
      odEsf: odEsf || null,
      odCil: odCil || null,
      odEje: odEje || null,
      odAdd: odAdd || null,
      oiEsf: oiEsf || null,
      oiCil: oiCil || null,
      oiEje: oiEje || null,
      oiAdd: oiAdd || null,
      notes: notes || null,
      taxRate: 0,
    });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!productRef.current?.contains(e.target as Node)) setShowProductDrop(false);
      if (!patientRef.current?.contains(e.target as Node)) setShowPatientDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [catTab, setCatTab] = useState<'armazones' | 'lentes' | 'micas' | 'tratamientos'>('armazones');
  const [modoVista, setModoVista] = useState<'libre' | 'guiada'>('libre');

  const CAT_TABS = [
    { key: 'armazones',    label: 'Armazones',           icon: <Glasses size={16} /> },
    { key: 'lentes',       label: 'Lentes de Seguridad', icon: <Glasses size={16} /> },
    { key: 'micas',        label: 'Micas',               icon: <Disc3 size={16} /> },
    { key: 'tratamientos', label: 'Tratamientos',        icon: <div className="relative inline-flex items-center justify-center w-4 h-4"><Circle size={14} /><Sparkle size={8} className="absolute -top-0.5 -right-0.5 fill-current" /></div> },
  ] as const;

  // Agrega items del cotizador al carrito (con merge por productId)
  const handleAddFromCotizador = (cotItems: CotItem[]) => {
    setItems(prev => {
      const merged = [...prev];
      for (const { product, quantity } of cotItems) {
        const idx = merged.findIndex(it => it.productId === product.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + quantity };
        } else {
          merged.push({
            productId: product.id,
            name: product.name,
            quantity,
            unitPrice: product.salePrice,
            discount: 0,
            availableStock: product.stock,
          });
        }
      }
      return merged;
    });
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_360px]">
      {/* ── LEFT: Catálogo + Carrito ── */}
      <div className="space-y-4">
        {/* Toggle modo vista */}
        <div className="flex gap-2">
          <button
            onClick={() => setModoVista('libre')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm
              ${modoVista === 'libre' 
                ? 'bg-blue-600 text-white shadow-blue-500/25' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <Search size={16} /> Selección libre
          </button>
          <button
            onClick={() => setModoVista('guiada')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm
              ${modoVista === 'guiada' 
                ? 'bg-blue-600 text-white shadow-blue-500/25' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <span className="material-symbols-rounded text-[18px]">route</span>
            Cotización guiada
          </button>
        </div>

        {modoVista === 'guiada' && (
          <CotizadorGuiado onAdd={handleAddFromCotizador} />
        )}

        {modoVista === 'libre' && <>
        {/* Buscador global */}
        <div className="card">
          <div className="relative" ref={productRef}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nombre…"
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); }}
              onFocus={() => setShowProductDrop(true)}
            />
            {showProductDrop && products.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-52 overflow-auto">
                {(products as any[]).slice(0, 10).map((p: any) => (
                  <div
                    key={p.id}
                    onMouseDown={() => addItem(p)}
                    className="px-4 py-2.5 flex justify-between items-center text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="font-semibold" style={{ color: 'var(--primary-600)' }}>{fmt(p.salePrice)}</span>
                  </div>
                ))}
              </div>
            )}
            {showProductDrop && productSearch.length >= 2 && products.length === 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow px-4 py-3 text-sm text-slate-400">
                Sin resultados
              </div>
            )}
          </div>
        </div>

        {/* Tabs de categoría */}
        <div className="flex flex-wrap gap-2">
          {CAT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setCatTab(t.key)}
              className={`py-1.5 px-3.5 text-[13px] font-semibold rounded-lg flex items-center gap-1.5 transition-all
                ${catTab === t.key 
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {catTab === 'armazones' && (
          <SeccionColapsable titulo="Catálogo de Armazones" defaultOpen={true}>
            <TablaPreciosArmazones cartItems={items} onToggle={toggleItem} />
          </SeccionColapsable>
        )}

        {catTab === 'lentes' && (
          <SeccionColapsable titulo="Lentes de Seguridad" defaultOpen={true}>
            <TablaLentesSeguridad cartItems={items} onToggle={toggleItem} />
          </SeccionColapsable>
        )}

        {catTab === 'micas' && (
          <>
            <SeccionColapsable titulo="Micas HX" defaultOpen={true}>
              <TablaMatriz
                grupo="mica-hx"
                colHeader="MICA"
                columnas={[
                  { tipo: 'blanco',          label: 'BLANCO' },
                  { tipo: 'antirreflejante', label: 'ANTIRREFLEJANTE' },
                  { tipo: 'foto-ar',         label: 'FOTO AR' },
                ]}
                grupoLabel="TRATAMIENTO"
                cartItems={items}
                onToggle={toggleItem}
              />
            </SeccionColapsable>

            <SeccionColapsable titulo="Policarbonato" defaultOpen={false}>
              <TablaMatriz
                grupo="policarbonato"
                colHeader="MICA"
                columnas={[
                  { tipo: 'blanco',          label: 'BLANCO' },
                  { tipo: 'antirreflejante', label: 'ANTIRREFLEJANTE' },
                  { tipo: 'foto-ar',         label: 'FOTO AR' },
                ]}
                grupoLabel="TRATAMIENTO"
                cartItems={items}
                onToggle={toggleItem}
              />
            </SeccionColapsable>

            <SeccionColapsable titulo="Blue Ray" defaultOpen={false}>
              <TablaMatriz
                grupo="blue-ray"
                colHeader="MICA"
                columnas={[
                  { tipo: 'terminado', label: 'BLUE RAY TERMINADO' },
                  { tipo: 'procesado', label: 'BLUE RAY PROCESADO' },
                  { tipo: 'foto-ter',  label: 'BLUE RAY FOTO TER' },
                  { tipo: 'foto-proc', label: 'BLUE RAY FOTO PROC' },
                ]}
                grupoLabel="TRATAMIENTO"
                nota="Policarbonato blue ray especial arriba de −6.25 sph / −6.25x  $2000"
                cartItems={items}
                onToggle={toggleItem}
              />
            </SeccionColapsable>

            <SeccionColapsable titulo="Terminada HI INDEX" defaultOpen={false}>
              <TablaMatriz
                grupo="hi-index-terminada"
                colHeader="MICA"
                columnas={[
                  { tipo: 'w',             label: 'W' },
                  { tipo: 'ar',            label: 'AR' },
                  { tipo: 'foto-ar',       label: 'FOTO AR' },
                  { tipo: 'blue-ray',      label: 'BLUE RAY' },
                  { tipo: 'blue-ray-foto', label: 'BLUE RAY FOTO' },
                ]}
                grupoLabel="TRATAMIENTO"
                cartItems={items}
                onToggle={toggleItem}
              />
            </SeccionColapsable>
          </>
        )}

        {catTab === 'tratamientos' && (
          <>
            <SeccionColapsable titulo="Tratamientos Solares Fijos" defaultOpen={true}>
              <TablaLista grupo="tratamiento-solar" colHeader="TRATAMIENTO" cartItems={items} onToggle={toggleItem} />
            </SeccionColapsable>

            <SeccionColapsable titulo="Biseles" defaultOpen={false}>
              <TablaLista grupo="bisel" colHeader="BISEL" cartItems={items} onToggle={toggleItem} />
            </SeccionColapsable>
          </>
        )}
        </>}

        {/* Carrito (aparece cuando hay items, en ambos modos) */}
        {items.length > 0 && (
          <div className="card">
            <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={15} /> Carrito
            </p>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ width: 72 }}>Cant.</th>
                    <th style={{ width: 112 }}>Precio</th>
                    <th style={{ width: 112, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const overStock = it.availableStock < 9000 && it.quantity > it.availableStock;
                    return (
                      <tr key={i} style={overStock ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                        <td><div className="font-medium">{it.name}</div></td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className={`input py-1 px-2 text-center ${overStock ? 'border-red-400' : ''}`}
                            value={it.quantity}
                            onChange={(e) => updateItem(i, { quantity: Math.max(1, +e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            className="input py-1 px-2"
                            value={it.unitPrice === 0 ? '' : it.unitPrice}
                            onChange={(e) => updateItem(i, { unitPrice: e.target.value === '' ? 0 : +e.target.value })}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-semibold">
                          {fmt(it.unitPrice * it.quantity)}
                        </td>
                        <td>
                          <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totales */}
        {items.length > 0 && (
          <div className="card">
            <div className="space-y-2 text-sm">
              {discountNum > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Descuento ({discountPct}%)</span>
                    <span style={{ color: 'var(--success)' }}>− {fmt(discountNum)}</span>
                  </div>
                </>
              )}
              <div
                className="flex justify-between font-bold text-base border-t pt-2"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span>TOTAL</span>
                <span style={{ color: 'var(--primary-600)' }}>{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Cliente + Lente + Pago ── */}
      <div className="space-y-4">
        {/* Cliente */}
        <div className="card">
          <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={15} /> Cliente / Paciente
          </p>

          {patient ? (
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-elevated)' }}>
              <div>
                <div className="font-semibold text-sm">{patient.fullName}</div>
                {(patient.companyRel?.name || patient.company) && (
                  <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--primary-600)' }}>
                    🏢 {patient.companyRel?.name || patient.company}
                  </div>
                )}
                {patient.phone && (
                  <div className="text-xs text-slate-500 mt-0.5">{patient.phone}</div>
                )}
              </div>
              <button
                onClick={() => { setPatient(null); setPatientSearch(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative" ref={patientRef}>
              <input
                className="input w-full"
                placeholder="Buscar por nombre o teléfono…"
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
                onFocus={() => setShowPatientDrop(true)}
              />
              {showPatientDrop && patientSearch.length > 0 && filteredPatients.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-52 overflow-auto">
                  {filteredPatients.map((p: any) => (
                    <div
                      key={p.id}
                      onMouseDown={() => { setPatient(p); setPatientSearch(''); setShowPatientDrop(false); }}
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <div className="font-medium">{p.fullName}</div>
                      {(p.companyRel?.name || p.company) && (
                        <div className="text-xs font-medium" style={{ color: 'var(--primary-600)' }}>
                          {p.companyRel?.name || p.company}
                        </div>
                      )}
                      {p.phone && <div className="text-xs text-slate-400">{p.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
              {showPatientDrop && patientSearch.length > 0 && filteredPatients.length === 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow px-4 py-3 text-sm text-slate-400">
                  No se encontró el cliente
                </div>
              )}
            </div>
          )}
          {!patient && (
            <p className="text-xs text-slate-400 mt-2">
              Opcional — puedes vender sin asociar cliente
            </p>
          )}
        </div>

        {/* Tipo de lente */}
        <div className="card">
          <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={15} /> Especificación de Lente
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tipo de lente</label>
              <select
                className="input"
                value={lensType}
                onChange={(e) => { setLensType(e.target.value); setLensTypeCustom(''); }}
              >
                <option value="">— Sin especificar —</option>
                {LENS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {lensType === 'Otro' && (
                <input
                  className="input mt-2"
                  placeholder="Especifica el tipo de lente"
                  value={lensTypeCustom}
                  onChange={(e) => setLensTypeCustom(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            {/* Tabla de graduación */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500">Graduación</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">DP</span>
                  <input
                    className="input text-xs text-center"
                    style={{ width: 56 }}
                    placeholder="62"
                    value={pd}
                    onChange={(e) => setPd(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      <th className="text-xs font-semibold py-1.5 px-2 text-left" style={{ color: 'var(--text-muted)', width: 28 }}></th>
                      {['ESF', 'CIL', 'EJE', 'ADD'].map((h) => (
                        <th key={h} className="text-xs font-semibold py-1.5 px-1 text-center" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'D', esf: odEsf, setEsf: setOdEsf, cil: odCil, setCil: setOdCil, eje: odEje, setEje: setOdEje, add: odAdd, setAdd: setOdAdd },
                      { label: 'I', esf: oiEsf, setEsf: setOiEsf, cil: oiCil, setCil: setOiCil, eje: oiEje, setEje: setOiEje, add: oiAdd, setAdd: setOiAdd },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td className="px-2 py-1.5">
                          <span className="text-xs font-bold" style={{ color: 'var(--primary-600)' }}>{row.label}</span>
                        </td>
                        <td className="px-1 py-1.5">
                          <input className="input text-xs text-center" style={{ padding: '4px 2px' }} placeholder="0.00" value={row.esf} onChange={(e) => row.setEsf(e.target.value)} />
                        </td>
                        <td className="px-1 py-1.5">
                          <input className="input text-xs text-center" style={{ padding: '4px 2px' }} placeholder="0.00" value={row.cil} onChange={(e) => row.setCil(e.target.value)} />
                        </td>
                        <td className="px-1 py-1.5">
                          <input className="input text-xs text-center" style={{ padding: '4px 2px' }} placeholder="0" value={row.eje} onChange={(e) => row.setEje(e.target.value)} />
                        </td>
                        <td className="px-1 py-1.5">
                          <input className="input text-xs text-center" style={{ padding: '4px 2px' }} placeholder="0.00" value={row.add} onChange={(e) => row.setAdd(e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Referido */}
        {/* Pago */}
        <div className="card">
          <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={15} /> Pago
          </p>
          <div className="space-y-3">
            {/* Descuento general (porcentaje) */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Descuento
                {discountPct > 0 && (
                  <span className="text-[10px] ml-1" style={{ color: 'var(--success)' }}>
                    (− {fmt(discountNum)})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  className="input pr-8"
                  value={discount}
                  placeholder="0"
                  style={{ color: !discount || discount === '0' ? 'rgba(150,160,180,0.35)' : undefined }}
                  onChange={(e) => setDiscount(e.target.value)}
                />
                <span
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)', fontSize: 12,
                    color: '#94a3b8', fontWeight: 600, pointerEvents: 'none',
                  }}
                >
                  %
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Anticipo
                  {total > 0 && (
                    <span className="text-[10px] ml-1" style={{ color: '#94a3b8' }}>
                      (mín. 30% = {fmt(minAnticipo)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  placeholder={total > 0 ? String(minAnticipo) : '0'}
                  value={deposit}
                  style={{ color: !deposit || deposit === '0' ? 'rgba(150,160,180,0.35)' : undefined }}
                  onChange={(e) => setDeposit(e.target.value)}
                />
                {total > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeposit(String(minAnticipo))}
                    className="text-[10px] mt-1 underline"
                    style={{ color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Usar 30% ({fmt(minAnticipo)})
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Método</label>
                <div className="flex flex-col gap-1">
                  {[
                    { value: 'EFECTIVO', label: 'Efectivo' },
                    { value: 'TRANSFERENCIA', label: 'Transferencia' },
                    { value: 'TARJETA', label: 'Tarjeta' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setDepositMethod(m.value)}
                      className="py-1.5 rounded-lg text-xs font-semibold transition"
                      style={depositMethod === m.value
                        ? { background: 'var(--primary-600)', color: '#fff' }
                        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumen de saldo */}
            <div
              className="rounded-xl p-3 space-y-1 text-sm bg-slate-50"
            >
              <div className="flex justify-between text-slate-500">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Anticipo</span>
                <span style={{ color: 'var(--success)' }}>
                  − {fmt(depositCapped)}
                </span>
              </div>
              <div
                className="flex justify-between font-bold border-t pt-1"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span>Saldo pendiente</span>
                <span style={{ color: balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {fmt(balance)}
                </span>
              </div>
            </div>

            {items.length > 0 && (sinAnticipo || anticipoInsuficiente) && (
              <div
                className="flex items-start gap-1.5 text-xs rounded-lg px-3 py-2"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: '#b91c1c',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                <Wallet size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Para hacer el encargo de los lentes se requiere
                  <strong> mínimo 30%</strong> de anticipo ({fmt(minAnticipo)}).
                  {anticipoInsuficiente && (
                    <> Faltan <strong>{fmt(minAnticipo - depositCapped)}</strong>.</>
                  )}
                </span>
              </div>
            )}

            {items.length > 0 && (
              <div
                className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-2"
                style={{
                  background: balance > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                  color: balance > 0 ? 'var(--warning)' : 'var(--success)',
                }}
              >
                {balance > 0 ? (
                  <>
                    <Wallet size={12} /> Se registrará como PENDIENTE · saldo por cobrar
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} /> Se registrará como LIQUIDADA
                  </>
                )}
              </div>
            )}

            <textarea
              className="input resize-none text-xs"
              rows={2}
              placeholder="Notas adicionales…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <button
              onClick={handleSubmit}
              disabled={items.length === 0 || create.isPending}
              className="btn btn-primary w-full py-3"
            >
              {create.isPending
                ? 'Creando cuenta…'
                : balance > 0
                ? 'Crear Cuenta (con saldo pendiente)'
                : 'Registrar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sección colapsable reutilizable
// ─────────────────────────────────────────────────────────────
function SeccionColapsable({
  titulo,
  defaultOpen = true,
  children,
}: {
  titulo: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <ShoppingBag size={15} /> {titulo}
        </p>
        <span
          className="material-symbols-rounded text-slate-400 transition-transform"
          style={{ fontSize: 20, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Celda de precio: toggle al carrito + edición inline + creación en vacíos
// ─────────────────────────────────────────────────────────────
function PrecioCelda({
  producto, seleccionado, onToggle, grupo, brand, tipo, categoryIdFallback, onSaved,
}: {
  producto: any | null;
  seleccionado: boolean;
  onToggle: (p: any) => void;
  grupo?: string;
  brand?: string;
  tipo?: string;
  categoryIdFallback?: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVal(producto ? String(producto.salePrice) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const save = async () => {
    const price = parseFloat(val);
    setEditing(false);
    if (isNaN(price) || price < 0) return;
    try {
      if (producto) {
        await api.put(`/inventory/products/${producto.id}`, { salePrice: price });
      } else {
        const slugBase = `${brand}-${tipo}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await api.post('/inventory/products', {
          sku: `AUTO-${slugBase}-${Date.now()}`,
          name: `${brand} ${(tipo || '').toUpperCase()}`,
          categoryId: categoryIdFallback,
          brand,
          salePrice: price,
          costPrice: 0,
          stock: 9999,
          minStock: 0,
          attributes: { tipo, grupo },
        });
      }
      onSaved();
    } catch { /* silent */ }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={save}
        style={{ width: '100%', maxWidth: 90, padding: '4px 6px', fontSize: 13, fontWeight: 700, border: '2px solid #2563eb', borderRadius: 6, textAlign: 'center', outline: 'none' }}
      />
    );
  }

  if (!producto) {
    return (
      <button
        type="button"
        onClick={startEdit}
        style={{ color: '#94a3b8', fontSize: 11, cursor: 'pointer', background: 'none', border: '1px dashed #cbd5e1', borderRadius: 6, padding: '4px 8px', width: '100%' }}
        title="Agregar precio"
      >+ precio</button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
      <button
        type="button"
        onClick={() => onToggle(producto)}
        style={{
          flex: 1, fontSize: 13, fontWeight: 700,
          padding: '5px 8px', borderRadius: 6,
          border: seleccionado ? '2px solid #2563eb' : '2px solid transparent',
          cursor: 'pointer', transition: 'all 0.15s',
          background: seleccionado ? '#2563eb' : 'transparent',
          color: seleccionado ? '#ffffff' : 'var(--pos-price)',
          position: 'relative',
        }}
        title={seleccionado ? 'Clic para quitar' : 'Clic para agregar'}
      >
        {seleccionado && (
          <span style={{ position: 'absolute', top: -7, right: -7, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>×</span>
        )}
        {producto.salePrice.toLocaleString('es-MX')}
      </button>
      <button
        type="button"
        onClick={startEdit}
        style={{ padding: '3px 4px', borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, flexShrink: 0, lineHeight: 1 }}
        title="Editar precio"
      >✏</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TablaMatriz: genérica para tablas con brand × tipo (N columnas)
// ─────────────────────────────────────────────────────────────
function TablaMatriz({
  grupo, colHeader, columnas, grupoLabel, nota, cartItems, onToggle,
}: {
  grupo: string;
  colHeader: string;
  columnas: { tipo: string; label: string }[];
  grupoLabel?: string;
  nota?: string;
  cartItems: CartItem[];
  onToggle: (p: any) => void;
}) {
  const qc = useQueryClient();
  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['tabla-matriz', grupo],
    queryFn: async () => (await api.get('/inventory/products')).data as any[],
  });

  const enCarrito = new Set(cartItems.map((it) => it.productId));
  const brandMap = new Map<string, Record<string, any>>();
  for (const p of productos) {
    const a = (p.attributes as any) || {};
    if (a.grupo !== grupo) continue;
    const brand = p.brand || p.name;
    if (!brandMap.has(brand)) brandMap.set(brand, {});
    if (a.tipo) brandMap.get(brand)![a.tipo] = p;
  }
  const categoryIdFallback = (productos.find((p) => (p.attributes as any)?.grupo === grupo) as any)?.categoryId ?? '';

  if (isLoading) return <div className="text-center py-6 text-slate-400 text-sm">Cargando…</div>;

  const gridCols = `1fr ${columnas.map(() => '1fr').join(' ')}`;
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['tabla-matriz', grupo] }); qc.invalidateQueries({ queryKey: ['products'] }); };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {grupoLabel && (
        <div className="grid bg-blue-500 dark:bg-blue-600 text-white font-bold text-[12px]" style={{ gridTemplateColumns: gridCols }}>
          <div></div>
          <div className="text-center border-l border-blue-400 dark:border-blue-500" style={{ gridColumn: `span ${columnas.length}`, padding: '6px 8px' }}>
            {grupoLabel}
          </div>
        </div>
      )}
      <div className="grid bg-blue-400 dark:bg-blue-500 text-white font-bold text-[12px]" style={{ gridTemplateColumns: gridCols }}>
        <div style={{ padding: '6px 12px' }}>{colHeader}</div>
        {columnas.map((c) => (
          <div key={c.tipo} style={{ padding: '6px 8px', textAlign: 'center' }}>{c.label}</div>
        ))}
      </div>

      {Array.from(brandMap.entries()).map(([brand, prods], idx) => {
        const filaActiva = columnas.some((c) => prods[c.tipo] && enCarrito.has(prods[c.tipo].id));
        return (
          <div
            key={brand}
            className={`grid border-t border-slate-200 dark:border-slate-700 items-center transition-colors ${filaActiva ? 'bg-blue-50 dark:bg-blue-900/30' : idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className={`px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 ${filaActiva ? 'font-bold' : 'font-medium'}`}>{brand}</div>
            {columnas.map((c) => {
              const p = prods[c.tipo] ?? null;
              return (
                <div key={c.tipo} style={{ textAlign: 'center', padding: '4px 8px' }}>
                  <PrecioCelda
                    producto={p}
                    seleccionado={p ? enCarrito.has(p.id) : false}
                    onToggle={onToggle}
                    grupo={grupo}
                    brand={brand}
                    tipo={c.tipo}
                    categoryIdFallback={categoryIdFallback}
                    onSaved={onSaved}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {brandMap.size === 0 && (
        <div className="text-center py-6 text-slate-400 text-[13px]">
          Sin productos en este grupo
        </div>
      )}
      {nota && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[12px] font-semibold border-t border-amber-100 dark:border-amber-900/30">
          ⚠ {nota}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TablaLista: una sola columna de precio (tratamientos, biseles)
// ─────────────────────────────────────────────────────────────
function TablaLista({
  grupo, colHeader, cartItems, onToggle,
}: {
  grupo: string;
  colHeader: string;
  cartItems: CartItem[];
  onToggle: (p: any) => void;
}) {
  const qc = useQueryClient();
  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['tabla-lista', grupo],
    queryFn: async () => (await api.get('/inventory/products')).data as any[],
  });
  const enCarrito = new Set(cartItems.map((it) => it.productId));
  const filtrados = productos.filter((p) => (p.attributes as any)?.grupo === grupo);
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['tabla-lista', grupo] }); qc.invalidateQueries({ queryKey: ['products'] }); };

  if (isLoading) return <div className="text-center py-6 text-slate-400 text-sm">Cargando…</div>;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="grid bg-blue-500 dark:bg-blue-600 text-white font-bold text-[13px]" style={{ gridTemplateColumns: '1fr 160px' }}>
        <div style={{ padding: '8px 12px' }}>{colHeader}</div>
        <div style={{ padding: '8px 12px', textAlign: 'center' }}>COSTO</div>
      </div>
      {filtrados.map((p, idx) => {
        const sel = enCarrito.has(p.id);
        return (
          <div
            key={p.id}
            className={`grid border-t border-slate-200 dark:border-slate-700 items-center transition-colors ${sel ? 'bg-blue-50 dark:bg-blue-900/30' : idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}
            style={{ gridTemplateColumns: '1fr 160px' }}
          >
            <div className={`px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 ${sel ? 'font-bold' : 'font-semibold'}`}>{p.name}</div>
            <div style={{ padding: '4px 8px' }}>
              <PrecioCelda producto={p} seleccionado={sel} onToggle={onToggle} onSaved={onSaved} />
            </div>
          </div>
        );
      })}
      {filtrados.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-[13px]">Sin elementos</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla de Lentes de Seguridad (3 columnas: BAJAS / ALTAS / PROCESADO)
// ─────────────────────────────────────────────────────────────
function TablaLentesSeguridad({
  cartItems,
  onToggle,
}: {
  cartItems: CartItem[];
  onToggle: (p: any, singleGroupIds?: string[]) => void;
}) {
  const qc = useQueryClient();
  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['lentes-seguridad-tabla'],
    queryFn: async () => (await api.get('/inventory/products')).data as any[],
  });

  const enCarrito = new Set(cartItems.map((it) => it.productId));

  const brandMap = new Map<string, { bajas?: any; altas?: any; procesado?: any }>();
  const grupoIds: string[] = [];
  for (const p of productos) {
    const attrs = (p.attributes as any) || {};
    if (attrs.grupo !== 'lente-seguridad') continue;
    grupoIds.push(p.id);
    const brand = p.brand || p.name;
    if (!brandMap.has(brand)) brandMap.set(brand, {});
    if (attrs.tipo === 'bajas') brandMap.get(brand)!.bajas = p;
    if (attrs.tipo === 'altas') brandMap.get(brand)!.altas = p;
    if (attrs.tipo === 'procesado') brandMap.get(brand)!.procesado = p;
  }
  const onToggleUnico = (p: any) => onToggle(p, grupoIds);
  const categoryIdFallback = (productos.find((p) => (p.attributes as any)?.grupo === 'lente-seguridad') as any)?.categoryId ?? '';
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['lentes-seguridad-tabla'] }); qc.invalidateQueries({ queryKey: ['products'] }); };

  if (isLoading) return <div className="text-center py-6 text-slate-400 text-sm">Cargando…</div>;

  const cols = ['1fr', '130px', '130px', '130px'].join(' ');
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="grid bg-blue-500 dark:bg-blue-600 text-white font-bold text-[13px]" style={{ gridTemplateColumns: '1fr 390px' }}>
        <div style={{ padding: '8px 12px' }}></div>
        <div className="text-center border-l border-blue-400 dark:border-blue-500" style={{ padding: '8px 12px' }}>TRATAMIENTO</div>
      </div>
      <div className="grid bg-blue-400 dark:bg-blue-500 text-white font-bold text-[12px]" style={{ gridTemplateColumns: cols }}>
        <div style={{ padding: '6px 12px' }}>LENTE</div>
        <div style={{ padding: '6px 8px', textAlign: 'center' }}>BAJAS</div>
        <div style={{ padding: '6px 8px', textAlign: 'center' }}>ALTAS</div>
        <div style={{ padding: '6px 8px', textAlign: 'center' }}>PROCESADO</div>
      </div>

      {Array.from(brandMap.entries()).map(([brand, { bajas, altas, procesado }], idx) => {
        const filaActiva =
          (bajas && enCarrito.has(bajas.id)) ||
          (altas && enCarrito.has(altas.id)) ||
          (procesado && enCarrito.has(procesado.id));
        return (
          <div
            key={brand}
            className={`grid border-t border-slate-200 dark:border-slate-700 items-center transition-colors ${filaActiva ? 'bg-blue-50 dark:bg-blue-900/30' : idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}
            style={{ gridTemplateColumns: cols }}
          >
            <div className={`px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 ${filaActiva ? 'font-bold' : 'font-medium'}`}>{brand}</div>
            <div style={{ padding: '4px 8px' }}>
              <PrecioCelda producto={bajas ?? null} seleccionado={bajas ? enCarrito.has(bajas.id) : false} onToggle={onToggleUnico} grupo="lente-seguridad" brand={brand} tipo="bajas" categoryIdFallback={categoryIdFallback} onSaved={onSaved} />
            </div>
            <div style={{ padding: '4px 8px' }}>
              <PrecioCelda producto={altas ?? null} seleccionado={altas ? enCarrito.has(altas.id) : false} onToggle={onToggleUnico} grupo="lente-seguridad" brand={brand} tipo="altas" categoryIdFallback={categoryIdFallback} onSaved={onSaved} />
            </div>
            <div style={{ padding: '4px 8px' }}>
              <PrecioCelda producto={procesado ?? null} seleccionado={procesado ? enCarrito.has(procesado.id) : false} onToggle={onToggleUnico} grupo="lente-seguridad" brand={brand} tipo="procesado" categoryIdFallback={categoryIdFallback} onSaved={onSaved} />
            </div>
          </div>
        );
      })}

      {brandMap.size === 0 && (
        <div className="text-center py-6 text-slate-400 text-[13px]">Sin lentes en catálogo</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla de precios de armazones con selección toggle
// ─────────────────────────────────────────────────────────────
function TablaPreciosArmazones({
  cartItems,
  onToggle,
}: {
  cartItems: CartItem[];
  onToggle: (p: any, singleGroupIds?: string[]) => void;
}) {
  const qc = useQueryClient();
  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['armazones-tabla'],
    queryFn: async () => (await api.get('/inventory/products')).data as any[],
  });

  const enCarrito = new Set(cartItems.map((it) => it.productId));

  const brandMap = new Map<string, { armazon?: any; hxar?: any }>();
  const grupoIds: string[] = [];
  for (const p of productos) {
    const attrs = (p.attributes as any) || {};
    const tipo = attrs.tipo;
    if (tipo !== 'armazon' && tipo !== 'hxar') continue;
    grupoIds.push(p.id);
    const brand = p.brand || p.name;
    if (!brandMap.has(brand)) brandMap.set(brand, {});
    if (tipo === 'armazon') brandMap.get(brand)!.armazon = p;
    if (tipo === 'hxar') brandMap.get(brand)!.hxar = p;
  }
  const onToggleUnico = (p: any) => onToggle(p, grupoIds);
  const categoryIdFallback = (productos.find((p) => {
    const a = (p.attributes as any) || {};
    return a.tipo === 'armazon';
  }) as any)?.categoryId ?? '';
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['armazones-tabla'] }); qc.invalidateQueries({ queryKey: ['products'] }); };

  if (isLoading) return <div className="text-center py-6 text-slate-400 text-sm">Cargando…</div>;

  const cols = '1fr 150px 150px';
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="grid bg-blue-500 dark:bg-blue-600 text-white font-bold text-[13px]" style={{ gridTemplateColumns: cols }}>
        <div style={{ padding: '8px 12px' }}>MARCA</div>
        <div style={{ padding: '8px 12px', textAlign: 'center' }}>ARMAZÓN</div>
        <div style={{ padding: '8px 12px', textAlign: 'center' }}>HX AR</div>
      </div>
      <div className="bg-blue-100 dark:bg-blue-900/40 text-center text-[11px] text-blue-900 dark:text-blue-300 px-2 py-1 font-medium leading-relaxed">
        Lente con graduación baja, y antirreflejante. <strong>ESTUCHE, MICROFIBRA</strong>
      </div>

      {Array.from(brandMap.entries()).map(([brand, { armazon, hxar }], idx) => {
        const hxarNote = (armazon?.attributes as any)?.hxarNote as string | undefined;
        const filaActiva = (armazon && enCarrito.has(armazon.id)) || (hxar && enCarrito.has(hxar.id));
        return (
          <div
            key={brand}
            className={`grid border-t border-slate-200 dark:border-slate-700 items-center transition-colors ${filaActiva ? 'bg-blue-50 dark:bg-blue-900/30' : idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}
            style={{ gridTemplateColumns: cols }}
          >
            <div className={`px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 ${filaActiva ? 'font-bold' : 'font-medium'}`}>{brand}</div>
            <div style={{ padding: '4px 8px' }}>
              <PrecioCelda producto={armazon ?? null} seleccionado={armazon ? enCarrito.has(armazon.id) : false} onToggle={onToggleUnico} grupo="armazon" brand={brand} tipo="armazon" categoryIdFallback={categoryIdFallback} onSaved={onSaved} />
            </div>
            <div style={{ padding: '4px 8px' }}>
              {hxarNote && !hxar ? (
                <span className="text-[10px] text-slate-600 dark:text-slate-400 italic font-semibold">{hxarNote}</span>
              ) : (
                <PrecioCelda producto={hxar ?? null} seleccionado={hxar ? enCarrito.has(hxar.id) : false} onToggle={onToggleUnico} grupo="armazon" brand={brand} tipo="hxar" categoryIdFallback={categoryIdFallback} onSaved={onSaved} />
              )}
            </div>
          </div>
        );
      })}

      {brandMap.size === 0 && (
        <div className="text-center py-6 text-slate-400 text-[13px]">Sin armazones en catálogo</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab 2: Cuentas Pendientes
// ─────────────────────────────────────────────────────────────
function CuentasActivas() {
  const qc = useQueryClient();
  const [payingSale, setPayingSale] = useState<PendingSale | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('EFECTIVO');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-pending'],
    queryFn: async () =>
      (await api.get('/sales', { params: { status: 'PENDIENTE' } })).data as PendingSale[],
  });

  const { data: detailSale, isLoading: detailLoading } = useQuery({
    queryKey: ['sale-detail', detailId],
    queryFn: async () => (await api.get(`/sales/${detailId}`)).data,
    enabled: !!detailId,
  });

  const registerAbono = useMutation({
    mutationFn: ({ id, amount, method, notes }: { id: string; amount: string; method: string; notes: string }) =>
      api.post(`/sales/${id}/abono`, { amount: parseFloat(amount), method, notes }).then((r) => r.data),
    onSuccess: (sale: any) => {
      if (sale.status === 'LIQUIDADA') {
        toast.success(`Cuenta ${sale.folio} liquidada`);
      } else {
        toast.success(`Abono registrado · Saldo restante: ${fmt(sale.balance)}`);
      }
      setPayingSale(null);
      setAbonoAmount('');
      setAbonoNotes('');
      qc.invalidateQueries({ queryKey: ['sales-pending'] });
      qc.invalidateQueries({ queryKey: ['sale-detail', sale.id] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error || 'Error al registrar el abono'),
  });

  const SalesTable = ({ rows, label }: { rows: PendingSale[]; label: string }) => (
    <div className="card overflow-x-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">👤</span>
        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="ml-auto badge badge-blue">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Sin cuentas pendientes</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Lente</th>
              <th>Total</th>
              <th>Anticipo</th>
              <th>Saldo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs font-bold">{s.folio}</td>
                <td className="text-xs">{new Date(s.createdAt).toLocaleDateString('es-MX')}</td>
                <td>
                  {s.patient ? (
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold">{s.patient.fullName}</span>
                      {s.patient.phone && (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {s.patient.phone}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">Mostrador</span>
                  )}
                </td>
                <td className="text-sm">{s.lensType ?? <span className="text-slate-300">—</span>}</td>
                <td className="font-semibold">{fmt(s.total)}</td>
                <td style={{ color: 'var(--success)' }}>{fmt(s.deposit)}</td>
                <td><span className="font-bold" style={{ color: 'var(--warning)' }}>{fmt(s.balance)}</span></td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDetailId(s.id)}
                      className="p-1 inline-flex items-center justify-center hover:opacity-70 transition"
                      style={{ color: 'var(--text-muted)' }}
                      title="Ver detalles del cliente"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => printSaleDetail(s.id)}
                      className="p-1 inline-flex items-center justify-center hover:opacity-70 transition"
                      style={{ color: 'var(--primary-600)' }}
                      title="Descargar detalle de cuenta"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => { setPayingSale(s); setAbonoMethod('EFECTIVO'); setAbonoAmount(''); }}
                      className="p-1 inline-flex items-center justify-center hover:opacity-70 transition"
                      style={{ color: 'var(--success)' }}
                      title="Registrar abono"
                    >
                      <Banknote size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.patient?.fullName?.toLowerCase().includes(q) ||
      s.patient?.phone?.includes(q) ||
      s.folio?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Buscador de pacientes */}
      <div className="max-w-sm">
        <input
          type="text"
          className="input w-full"
          placeholder="Buscar por paciente, teléfono o folio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="card text-center py-10 text-slate-400">Cargando…</div>
      ) : sales.length === 0 ? (
        <div className="card text-center py-14 text-slate-400">
          <CheckCircle2 size={40} className="mx-auto mb-2 opacity-20" />
          <p className="font-semibold">Sin cuentas pendientes</p>
          <p className="text-sm mt-1">Todas las cuentas están liquidadas</p>
        </div>
      ) : (
        <SalesTable rows={filteredSales} label={search ? `${filteredSales.length} resultado${filteredSales.length !== 1 ? 's' : ''}` : 'Cuentas pendientes'} />
      )}

      {/* Modal detalle de cuenta */}
      {detailId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4" style={{ color: 'var(--text-primary)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="text-base font-bold">Detalle de Cuenta</h3>
                {detailSale && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detailSale.folio} · {new Date(detailSale.createdAt).toLocaleString('es-MX')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detailSale && detailSale.status === 'PENDIENTE' && (
                  <button
                    onClick={() => { const s = sales.find(x => x.id === detailId); if (s) { setPayingSale(s); setAbonoMethod('EFECTIVO'); setAbonoAmount(''); setDetailId(null); } }}
                    className="btn btn-primary py-1.5 px-3 text-xs"
                  >
                    Registrar abono
                  </button>
                )}
                <button onClick={() => setDetailId(null)} className="btn btn-secondary py-1.5 px-3 text-xs">
                  Cerrar
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="text-center py-12 text-slate-400">Cargando…</div>
            ) : detailSale ? (
              <div className="p-6 space-y-5">

                {/* Sección cliente */}
                <Section icon="person" title="Cliente / Paciente">
                  {detailSale.patient ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <InfoRow label="Nombre" value={detailSale.patient.fullName} />
                      <InfoRow label="Teléfono" value={detailSale.patient.phone} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Venta de mostrador (sin cliente registrado)</p>
                  )}
                </Section>

                {/* Sección orden */}
                <Section icon="visibility" title="Orden de Lente">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow label="Tipo de lente" value={detailSale.lensType} />
                    <InfoRow label="DP" value={detailSale.pd} />
                    <InfoRow label="Notas" value={detailSale.notes} span />
                  </div>
                  {(detailSale.odEsf || detailSale.oiEsf) && (
                    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-elevated)' }}>
                            <th className="text-xs font-semibold py-1.5 px-2 text-left" style={{ color: 'var(--text-muted)' }}></th>
                            {['ESF', 'CIL', 'EJE', 'ADD'].map((h) => (
                              <th key={h} className="text-xs font-semibold py-1.5 px-2 text-center" style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'D', esf: detailSale.odEsf, cil: detailSale.odCil, eje: detailSale.odEje, add: detailSale.odAdd },
                            { label: 'I', esf: detailSale.oiEsf, cil: detailSale.oiCil, eje: detailSale.oiEje, add: detailSale.oiAdd },
                          ].map((row) => (
                            <tr key={row.label} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <td className="px-2 py-1.5 text-xs font-bold" style={{ color: 'var(--primary-600)' }}>{row.label}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.esf || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.cil || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.eje || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.add || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* Artículos */}
                {detailSale.items?.length > 0 && (
                  <Section icon="shopping_bag" title="Artículos / Servicios">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th style={{ width: 60, textAlign: 'center' }}>Cant.</th>
                          <th style={{ width: 100, textAlign: 'right' }}>P. Unit.</th>
                          <th style={{ width: 100, textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSale.items.map((it: any) => (
                          <tr key={it.id}>
                            <td className="text-sm">{it.product?.name ?? '—'}</td>
                            <td className="text-center text-sm">{it.quantity}</td>
                            <td className="text-right text-sm">{fmt(it.unitPrice)}</td>
                            <td className="text-right font-semibold text-sm">{fmt(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                )}

                {/* Pagos */}
                <Section icon="payments" title="Pagos">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow label="Total" value={fmt(detailSale.total)} />
                    <InfoRow label="Estado" value={detailSale.status} />
                    <InfoRow label="Anticipo" value={detailSale.deposit > 0 ? fmt(detailSale.deposit) : null} />
                    <InfoRow label="Método anticipo" value={detailSale.depositMethod} />
                    <InfoRow label="Saldo pendiente" value={fmt(detailSale.balance)} highlight={detailSale.balance > 0} />
                    <InfoRow label="Atendió" value={detailSale.vendor?.fullName} />
                  </div>
                  {detailSale.abonos?.length > 0 && (
                    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        Historial de abonos
                      </div>
                      {detailSale.abonos.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <div>
                            <span className="font-semibold" style={{ color: 'var(--success)' }}>+ {fmt(a.amount)}</span>
                            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{a.method}</span>
                            {a.notes && <span className="ml-2 text-xs italic" style={{ color: 'var(--text-muted)' }}>{a.notes}</span>}
                          </div>
                          <div className="text-right">
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.user?.fullName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal de abono */}
      {payingSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-1">Registrar Abono</h3>
            <p className="text-sm text-slate-500 mb-4">
              {payingSale.folio} · {payingSale.patient?.fullName ?? 'Mostrador'}
            </p>

            {/* Resumen saldo */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Total</span>
                <span>{fmt(payingSale.total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total abonado</span>
                <span style={{ color: 'var(--success)' }}>− {fmt(payingSale.deposit)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2 text-base" style={{ borderColor: 'var(--border-subtle)' }}>
                <span>Saldo pendiente</span>
                <span style={{ color: 'var(--warning)' }}>{fmt(payingSale.balance)}</span>
              </div>
            </div>

            {/* Monto del abono */}
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1.5 block">Monto del abono</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={payingSale.balance}
                  className="input flex-1"
                  placeholder="0.00"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-xs px-3"
                  onClick={() => setAbonoAmount(String(payingSale.balance))}
                >
                  Todo
                </button>
              </div>
            </div>

            {/* Método */}
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1.5 block">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'EFECTIVO', label: 'Efectivo' },
                  { value: 'TRANSFERENCIA', label: 'Transferencia' },
                  { value: 'TARJETA', label: 'Tarjeta' },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setAbonoMethod(m.value)}
                    className="py-2 rounded-xl text-xs font-semibold border transition"
                    style={
                      abonoMethod === m.value
                        ? { background: 'var(--primary-600)', color: '#fff', border: 'none' }
                        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nota opcional */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block">Nota (opcional)</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: segunda mensualidad"
                value={abonoNotes}
                onChange={(e) => setAbonoNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPayingSale(null)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => registerAbono.mutate({ id: payingSale.id, amount: abonoAmount, method: abonoMethod, notes: abonoNotes })}
                disabled={registerAbono.isPending || !abonoAmount || parseFloat(abonoAmount) <= 0}
                className="btn btn-primary flex-1"
              >
                {registerAbono.isPending ? 'Procesando…' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab 3: Cuentas Pagadas
// ─────────────────────────────────────────────────────────────
function CuentasPagadas() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-pagadas'],
    queryFn: async () =>
      (await api.get('/sales', { params: { status: 'LIQUIDADA' } })).data as PendingSale[],
  });

  const { data: detailSale, isLoading: detailLoading } = useQuery({
    queryKey: ['sale-detail', detailId],
    queryFn: async () => (await api.get(`/sales/${detailId}`)).data,
    enabled: !!detailId,
  });

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.folio.toLowerCase().includes(q) ||
      s.patient?.fullName?.toLowerCase().includes(q) ||
      s.lensType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="card">
        <input
          className="input"
          placeholder="Buscar por folio, cliente o tipo de lente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="card text-center py-10 text-slate-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14 text-slate-400">
          <CheckCircle2 size={40} className="mx-auto mb-2 opacity-20" />
          <p className="font-semibold">Sin cuentas pagadas</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Lente</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-bold">{s.folio}</td>
                    <td className="text-xs">{new Date(s.createdAt).toLocaleDateString('es-MX')}</td>
                    <td>{s.patient?.fullName ?? <span className="text-slate-400">Mostrador</span>}</td>
                    <td className="text-sm">{s.lensType ?? <span className="text-slate-300">—</span>}</td>
                    <td className="text-right font-semibold" style={{ color: 'var(--success)' }}>{fmt(s.total)}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setDetailId(s.id)}
                          className="p-1 inline-flex items-center justify-center hover:opacity-70 transition"
                          style={{ color: 'var(--text-muted)' }}
                          title="Ver detalles del cliente"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => printSaleDetail(s.id)}
                          className="p-1 inline-flex items-center justify-center hover:opacity-70 transition"
                          style={{ color: 'var(--primary-600)' }}
                          title="Descargar detalle de cuenta"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detailId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4" style={{ color: 'var(--text-primary)' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="text-base font-bold">Detalle de Cuenta</h3>
                {detailSale && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detailSale.folio} · {new Date(detailSale.createdAt).toLocaleString('es-MX')}
                  </p>
                )}
              </div>
              <button onClick={() => setDetailId(null)} className="btn btn-secondary py-1.5 px-3 text-xs">
                Cerrar
              </button>
            </div>

            {detailLoading ? (
              <div className="text-center py-12 text-slate-400">Cargando…</div>
            ) : detailSale ? (
              <div className="p-6 space-y-5">
                <Section icon="person" title="Cliente / Paciente">
                  {detailSale.patient ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <InfoRow label="Nombre" value={detailSale.patient.fullName} />
                      <InfoRow label="Teléfono" value={detailSale.patient.phone} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Venta de mostrador</p>
                  )}
                </Section>

                <Section icon="visibility" title="Orden de Lente">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow label="Tipo de lente" value={detailSale.lensType} />
                    <InfoRow label="DP" value={detailSale.pd} />
                    <InfoRow label="Notas" value={detailSale.notes} span />
                  </div>
                  {(detailSale.odEsf || detailSale.oiEsf) && (
                    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-elevated)' }}>
                            <th className="text-xs font-semibold py-1.5 px-2 text-left" style={{ color: 'var(--text-muted)' }}></th>
                            {['ESF', 'CIL', 'EJE', 'ADD'].map((h) => (
                              <th key={h} className="text-xs font-semibold py-1.5 px-2 text-center" style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'D', esf: detailSale.odEsf, cil: detailSale.odCil, eje: detailSale.odEje, add: detailSale.odAdd },
                            { label: 'I', esf: detailSale.oiEsf, cil: detailSale.oiCil, eje: detailSale.oiEje, add: detailSale.oiAdd },
                          ].map((row) => (
                            <tr key={row.label} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <td className="px-2 py-1.5 text-xs font-bold" style={{ color: 'var(--primary-600)' }}>{row.label}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.esf || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.cil || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.eje || '—'}</td>
                              <td className="px-2 py-1.5 text-xs text-center">{row.add || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {detailSale.items?.length > 0 && (
                  <Section icon="shopping_bag" title="Artículos / Servicios">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th style={{ width: 60, textAlign: 'center' }}>Cant.</th>
                          <th style={{ width: 100, textAlign: 'right' }}>P. Unit.</th>
                          <th style={{ width: 100, textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSale.items.map((it: any) => (
                          <tr key={it.id}>
                            <td className="text-sm">{it.product?.name ?? '—'}</td>
                            <td className="text-center text-sm">{it.quantity}</td>
                            <td className="text-right text-sm">{fmt(it.unitPrice)}</td>
                            <td className="text-right font-semibold text-sm">{fmt(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                )}

                <Section icon="payments" title="Pagos">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow label="Total" value={fmt(detailSale.total)} />
                    <InfoRow label="Estado" value={detailSale.status} />
                    <InfoRow label="Atendió" value={detailSale.vendor?.fullName} />
                  </div>
                  {detailSale.abonos?.length > 0 && (
                    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        Historial de abonos
                      </div>
                      {detailSale.abonos.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <div>
                            <span className="font-semibold" style={{ color: 'var(--success)' }}>+ {fmt(a.amount)}</span>
                            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{a.method}</span>
                            {a.notes && <span className="ml-2 text-xs italic" style={{ color: 'var(--text-muted)' }}>{a.notes}</span>}
                          </div>
                          <div className="text-right">
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.user?.fullName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-rounded text-base" style={{ color: 'var(--primary-600)' }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, span, highlight }: { label: string; value?: any; span?: boolean; highlight?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className={span ? 'col-span-2' : ''}>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}: </span>
      <span className={`text-xs font-medium ${highlight ? 'text-red-600' : ''}`} style={!highlight ? { color: 'var(--text-primary)' } : {}}>
        {String(value)}
      </span>
    </div>
  );
}
