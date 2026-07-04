// =============================================================
// ARCHIVO: src/pages/pos/CotizadorGuiado.tsx
// DESCRIPCION: Wizard paso a paso para cotizar lentes.
//   Flujos: Armazón (solo / HX AR / personalizado) | Lentes seguridad | Solo mica
//   Lógica de precios:
//     - "solo armazón": precio armazón
//     - "HX AR":        precio HX AR (ya incluye paquete)
//     - "personalizado": armazón + mica/tratamiento + extras
//     - lente seguridad: precio del producto seleccionado
// =============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

type CotStep = 'tipo' | 'armazon' | 'modo' | 'lenteseg' | 'mica' | 'tratamiento' | 'extras' | 'resumen';
type CotTipo = 'armazon' | 'lenteseg' | 'solo-mica';
type CotModo = 'solo' | 'hxar' | 'personalizado';
export type CotItem = { product: any; quantity: number };

const MICA_GRUPOS = [
  { key: 'mica-hx',            label: 'Micas HX' },
  { key: 'policarbonato',      label: 'Policarbonato' },
  { key: 'blue-ray',           label: 'Blue Ray' },
  { key: 'hi-index-terminada', label: 'Hi Index / Flat / Blend / Progresivo' },
  { key: 'procesada',          label: 'Micas Procesadas' },
];

const TIPO_LABELS: Record<string, string> = {
  blanco: 'Blanco', antirreflejante: 'Antirreflejante', 'foto-ar': 'Foto AR',
  terminado: 'Terminado', procesado: 'Procesado',
  'foto-ter': 'Foto Terminado', 'foto-proc': 'Foto Procesado',
  w: 'W (Blanco)', ar: 'AR (Antirreflejante)',
  'blue-ray': 'Blue Ray', 'blue-ray-foto': 'Blue Ray Foto',
  'w-hx': 'W HX', 'w-poli': 'W Poli',
  'ar-hx': 'AR HX', 'ar-poli': 'AR Poli',
  'foto-ar-hx': 'Foto AR HX', 'foto-ar-poli': 'Foto AR Poli',
  'blue-ray-hx': 'Blue Ray HX', 'blue-ray-poli': 'Blue Ray Poli',
  'blue-ray-foto-hx': 'Blue Ray Foto HX',
  'blue-ray-foto-poli': 'Blue Ray Foto Poli',
};

const TIPO_ORDER = [
  'blanco', 'w', 'w-hx', 'w-poli',
  'antirreflejante', 'ar', 'ar-hx', 'ar-poli',
  'foto-ar', 'foto-ar-hx', 'foto-ar-poli',
  'terminado', 'procesado', 'foto-ter', 'foto-proc',
  'blue-ray', 'blue-ray-hx', 'blue-ray-poli',
  'blue-ray-foto', 'blue-ray-foto-hx', 'blue-ray-foto-poli',
];

export default function CotizadorGuiado({ onAdd }: { onAdd: (items: CotItem[]) => void }) {
  const [step, setStep] = useState<CotStep>('tipo');
  const [tipo, setTipo] = useState<CotTipo | null>(null);

  const [armazonProd, setArmazonProd] = useState<any | null>(null);
  const [armazonModo, setArmazonModo] = useState<CotModo | null>(null);
  const [armazonSearch, setArmazonSearch] = useState('');

  const [lenteSegProd, setLenteSegProd] = useState<any | null>(null);

  const [micaBrand, setMicaBrand] = useState<{ grupo: string; brand: string } | null>(null);
  const [micaProd, setMicaProd] = useState<any | null>(null);

  const [extraIds, setExtraIds] = useState<Set<string>>(new Set());

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['cotizador-productos'],
    queryFn: async () => (await api.get('/inventory/products')).data as any[],
  });

  // ── Armazones ──
  const armazonesByBrand = new Map<string, { armazon?: any; hxar?: any }>();
  for (const p of productos) {
    const a = (p.attributes as any) || {};
    if (a.grupo === 'lente-seguridad') continue;
    if (a.tipo !== 'armazon' && a.tipo !== 'hxar') continue;
    const brand = p.brand || p.name;
    if (!armazonesByBrand.has(brand)) armazonesByBrand.set(brand, {});
    if (a.tipo === 'armazon') armazonesByBrand.get(brand)!.armazon = p;
    if (a.tipo === 'hxar')    armazonesByBrand.get(brand)!.hxar    = p;
  }

  // ── Lentes seguridad ──
  const lenteSegByBrand = new Map<string, { bajas?: any; altas?: any; procesado?: any }>();
  for (const p of productos) {
    const a = (p.attributes as any) || {};
    if (a.grupo !== 'lente-seguridad') continue;
    const brand = p.brand || p.name;
    if (!lenteSegByBrand.has(brand)) lenteSegByBrand.set(brand, {});
    if (a.tipo === 'bajas')     lenteSegByBrand.get(brand)!.bajas     = p;
    if (a.tipo === 'altas')     lenteSegByBrand.get(brand)!.altas     = p;
    if (a.tipo === 'procesado') lenteSegByBrand.get(brand)!.procesado = p;
  }

  // ── Micas (grupo → brand → tipo → producto) ──
  const micasPorGrupo = new Map<string, Map<string, Record<string, any>>>();
  for (const g of MICA_GRUPOS) micasPorGrupo.set(g.key, new Map());
  for (const p of productos) {
    const a = (p.attributes as any) || {};
    if (!MICA_GRUPOS.find(g => g.key === a.grupo)) continue;
    const brand = p.brand || p.name;
    const map = micasPorGrupo.get(a.grupo)!;
    if (!map.has(brand)) map.set(brand, {});
    if (a.tipo) map.get(brand)![a.tipo] = p;
  }

  // ── Extras ──
  const extrasSolares = productos.filter((p: any) => (p.attributes as any)?.grupo === 'tratamiento-solar');
  const extrasBiseles = productos.filter((p: any) => (p.attributes as any)?.grupo === 'bisel');
  const extrasAcc     = productos.filter((p: any) => (p.attributes as any)?.grupo === 'accesorio');
  const extrasAll     = [...extrasSolares, ...extrasBiseles, ...extrasAcc];

  // ── Construir items finales ──
  const buildItems = (): CotItem[] => {
    const out: CotItem[] = [];
    if (tipo === 'armazon' && armazonProd) {
      if (armazonModo === 'hxar') {
        // Paquete HX AR ya incluye armazón + mica HX AR — no duplicar
        const hxar = armazonesByBrand.get(armazonProd.brand || armazonProd.name)?.hxar;
        if (hxar) out.push({ product: hxar, quantity: 1 });
      } else {
        out.push({ product: armazonProd, quantity: 1 });
        if (armazonModo === 'personalizado' && micaProd) {
          out.push({ product: micaProd, quantity: 1 });
        }
      }
    } else if (tipo === 'lenteseg' && lenteSegProd) {
      out.push({ product: lenteSegProd, quantity: 1 });
    } else if (tipo === 'solo-mica' && micaProd) {
      out.push({ product: micaProd, quantity: 1 });
    }
    for (const id of Array.from(extraIds)) {
      const p = extrasAll.find(e => e.id === id);
      if (p) out.push({ product: p, quantity: 1 });
    }
    return out;
  };
  const itemsCot = buildItems();
  const total = itemsCot.reduce((s, it) => s + (it.product.salePrice || 0) * it.quantity, 0);

  const reset = () => {
    setStep('tipo'); setTipo(null);
    setArmazonProd(null); setArmazonModo(null); setArmazonSearch('');
    setLenteSegProd(null);
    setMicaBrand(null); setMicaProd(null);
    setExtraIds(new Set());
  };

  const agregar = () => {
    if (itemsCot.length === 0) { toast.error('La cotización está vacía'); return; }
    onAdd(itemsCot);
    toast.success('Cotización agregada al carrito');
    reset();
  };

  // ── Navegación ──
  const nextStep = () => {
    if (step === 'tipo') {
      if (!tipo) return toast.error('Selecciona un tipo');
      setStep(tipo === 'armazon' ? 'armazon' : tipo === 'lenteseg' ? 'lenteseg' : 'mica');
    } else if (step === 'armazon') {
      if (!armazonProd) return toast.error('Selecciona un armazón');
      setStep('modo');
    } else if (step === 'modo') {
      if (!armazonModo) return toast.error('Elige un modo');
      if (armazonModo === 'hxar') {
        const hxar = armazonesByBrand.get(armazonProd?.brand || armazonProd?.name)?.hxar;
        if (!hxar) return toast.error('Este armazón no tiene paquete HX AR');
      }
      setStep(armazonModo === 'personalizado' ? 'mica' : 'extras');
    } else if (step === 'lenteseg') {
      if (!lenteSegProd) return toast.error('Selecciona un lente');
      setStep('extras');
    } else if (step === 'mica') {
      if (!micaBrand) return toast.error('Selecciona una mica');
      setStep('tratamiento');
    } else if (step === 'tratamiento') {
      if (!micaProd) return toast.error('Selecciona un tratamiento');
      setStep('extras');
    } else if (step === 'extras') {
      setStep('resumen');
    }
  };

  const prevStep = () => {
    if (step === 'armazon' || step === 'lenteseg') setStep('tipo');
    else if (step === 'modo') setStep('armazon');
    else if (step === 'mica') setStep(tipo === 'solo-mica' ? 'tipo' : 'modo');
    else if (step === 'tratamiento') setStep('mica');
    else if (step === 'extras') {
      if (tipo === 'lenteseg') setStep('lenteseg');
      else if (tipo === 'solo-mica' || armazonModo === 'personalizado') setStep('tratamiento');
      else setStep('modo');
    } else if (step === 'resumen') setStep('extras');
  };

  // ── Indicador de pasos dinámico ──
  const getSteps = (): { key: CotStep; label: string }[] => {
    const arr: { key: CotStep; label: string }[] = [{ key: 'tipo', label: 'Tipo' }];
    if (tipo === 'armazon') {
      arr.push({ key: 'armazon', label: 'Armazón' });
      arr.push({ key: 'modo', label: 'Modo' });
      if (armazonModo === 'personalizado') {
        arr.push({ key: 'mica', label: 'Mica' });
        arr.push({ key: 'tratamiento', label: 'Tratamiento' });
      }
    } else if (tipo === 'lenteseg') {
      arr.push({ key: 'lenteseg', label: 'Lente seg.' });
    } else if (tipo === 'solo-mica') {
      arr.push({ key: 'mica', label: 'Mica' });
      arr.push({ key: 'tratamiento', label: 'Tratamiento' });
    }
    arr.push({ key: 'extras', label: 'Extras' });
    arr.push({ key: 'resumen', label: 'Resumen' });
    return arr;
  };
  const steps = getSteps();
  const stepIdx = steps.findIndex(s => s.key === step);

  if (isLoading) return <div className="card text-center py-12 text-slate-400">Cargando productos…</div>;

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base text-slate-800">Cotización guiada</h3>
        <button onClick={reset} className="text-xs text-slate-500 hover:text-red-600 underline">Limpiar todo</button>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className={`flex-1 min-w-[80px] px-2 py-1.5 rounded-md text-[11px] font-bold text-center transition-colors
            ${i === stepIdx 
              ? 'bg-blue-600 text-white' 
              : i < stepIdx 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' 
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
            {i + 1}. {s.label}
          </div>
        ))}
      </div>

      <div className="min-h-[260px]">
        {step === 'tipo' && <StepTipo selected={tipo} onSelect={setTipo} />}

        {step === 'armazon' && (
          <StepArmazon
            armazones={armazonesByBrand}
            selected={armazonProd}
            search={armazonSearch}
            setSearch={setArmazonSearch}
            onSelect={(p) => setArmazonProd(p)}
          />
        )}

        {step === 'modo' && armazonProd && (
          <StepModo
            armazon={armazonProd}
            hxar={armazonesByBrand.get(armazonProd.brand || armazonProd.name)?.hxar}
            selected={armazonModo}
            onSelect={setArmazonModo}
          />
        )}

        {step === 'lenteseg' && (
          <StepLenteSeg
            brandMap={lenteSegByBrand}
            selected={lenteSegProd}
            onSelect={setLenteSegProd}
          />
        )}

        {step === 'mica' && (
          <StepMica
            micasPorGrupo={micasPorGrupo}
            selected={micaBrand}
            onSelect={(grupo, brand) => { setMicaBrand({ grupo, brand }); setMicaProd(null); }}
          />
        )}

        {step === 'tratamiento' && micaBrand && (
          <StepTratamiento
            brand={micaBrand.brand}
            tipos={micasPorGrupo.get(micaBrand.grupo)?.get(micaBrand.brand) || {}}
            selected={micaProd}
            onSelect={setMicaProd}
          />
        )}

        {step === 'extras' && (
          <StepExtras
            solares={extrasSolares}
            biseles={extrasBiseles}
            accesorios={extrasAcc}
            selected={extraIds}
            onToggle={(id) => setExtraIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
          />
        )}

        {step === 'resumen' && <StepResumen items={itemsCot} total={total} />}
      </div>

      {/* Preview total */}
      {itemsCot.length > 0 && step !== 'resumen' && (
        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-xl text-[13px]">
          <span className="text-slate-600 dark:text-slate-400">{itemsCot.length} concepto{itemsCot.length !== 1 ? 's' : ''}</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold text-[15px]">{fmt(total)}</span>
        </div>
      )}

      <div className="flex justify-between pt-3 border-t" style={{ borderColor: '#e2e8f0' }}>
        <button onClick={prevStep} className="btn btn-secondary" disabled={step === 'tipo'}>← Atrás</button>
        {step !== 'resumen' ? (
          <button onClick={nextStep} className="btn btn-primary">Siguiente →</button>
        ) : (
          <button onClick={agregar} className="btn btn-primary">+ Agregar al carrito ({fmt(total)})</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepTipo({ selected, onSelect }: { selected: CotTipo | null; onSelect: (t: CotTipo) => void }) {
  const opc: { key: CotTipo; label: string; desc: string; icon: string }[] = [
    { key: 'armazon',   label: 'Armazón normal',       desc: 'Catálogo con opción de paquete HX AR o personalizado', icon: 'visibility' },
    { key: 'lenteseg',  label: 'Lentes de seguridad',  desc: 'Lente industrial graduado (bajas/altas/procesado)',     icon: 'shield' },
    { key: 'solo-mica', label: 'Solo micas / servicio', desc: 'Sin armazón, solo mica + tratamiento',                  icon: 'lens_blur' },
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 mb-3">¿Qué tipo de producto vas a cotizar?</p>
      {opc.map(o => (
        <button
          key={o.key}
          onClick={() => onSelect(o.key)}
          className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer
            ${selected === o.key 
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'}`}
        >
          <span className="material-symbols-rounded text-[28px]" style={{ color: selected === o.key ? 'var(--primary-600)' : 'var(--text-muted)' }}>{o.icon}</span>
          <div>
            <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{o.label}</div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400">{o.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepArmazon({ armazones, selected, search, setSearch, onSelect }: {
  armazones: Map<string, { armazon?: any; hxar?: any }>;
  selected: any | null;
  search: string;
  setSearch: (s: string) => void;
  onSelect: (p: any) => void;
}) {
  const lista = Array.from(armazones.entries())
    .filter(([_, v]) => !!v.armazon)
    .filter(([brand]) => !search || brand.toLowerCase().includes(search.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-2">
      <input className="input" placeholder="Buscar marca…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="rounded-lg border" style={{ borderColor: '#e2e8f0', maxHeight: 320, overflowY: 'auto' }}>
        {lista.length === 0 && <div className="text-center py-6 text-slate-400 text-sm">Sin resultados</div>}
        {lista.map(([brand, { armazon, hxar }]) => {
          const sel = selected?.id === armazon!.id;
          return (
            <button
              key={brand}
              onClick={() => onSelect(armazon)}
              className={`w-full grid items-center text-left px-3 py-2 text-[13px] border-b border-slate-100 dark:border-slate-700/50 cursor-pointer
                ${sel ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-slate-800'}`}
              style={{ gridTemplateColumns: '1fr 90px 110px' }}
            >
              <span className={`${sel ? 'font-bold' : 'font-medium'} text-slate-800 dark:text-slate-200`}>{brand}</span>
              <span className="text-right text-slate-600 dark:text-slate-400">Arm: ${armazon!.salePrice}</span>
              <span className={`text-right text-[12px] ${hxar ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                {hxar ? `HX AR: $${hxar.salePrice}` : 'sin HX AR'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepModo({ armazon, hxar, selected, onSelect }: {
  armazon: any; hxar?: any; selected: CotModo | null; onSelect: (m: CotModo) => void;
}) {
  const Opt = ({ k, title, desc, price, disabled }: { k: CotModo; title: string; desc: string; price?: string; disabled?: boolean }) => (
    <button
      onClick={() => !disabled && onSelect(k)}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all 
        ${disabled 
          ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-55' 
          : selected === k 
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 cursor-pointer' 
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700'}`}
    >
      <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{title} {price && <span className="text-blue-600">— {price}</span>}</div>
      <div className="text-[12px] text-slate-500 dark:text-slate-400">{desc}</div>
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Armazón seleccionado</div>
        <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{armazon.name}</div>
      </div>
      <p className="text-sm text-slate-600">¿Cómo lo vas a cotizar?</p>
      <Opt k="solo"          title="Solo armazón"     desc="Solo el armazón sin mica ni tratamiento"        price={`$${armazon.salePrice}`} />
      <Opt k="hxar"          title="Paquete HX AR"    desc="Armazón + mica HX antirreflejante incluida"      price={hxar ? `$${hxar.salePrice}` : 'No disponible'} disabled={!hxar} />
      <Opt k="personalizado" title="Personalizado"    desc="Armazón + elige mica y tratamiento aparte" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepLenteSeg({ brandMap, selected, onSelect }: {
  brandMap: Map<string, { bajas?: any; altas?: any; procesado?: any }>;
  selected: any | null;
  onSelect: (p: any) => void;
}) {
  const Cell = ({ p }: { p?: any }) => {
    if (!p) return <span style={{ color: '#cbd5e1', fontSize: 10, fontStyle: 'italic' }}>No disponible</span>;
    const sel = selected?.id === p.id;
    return (
      <button
        onClick={() => onSelect(p)}
        className={`w-full px-1.5 py-1 rounded-md text-[13px] font-bold border-2 cursor-pointer transition-colors
          ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-transparent border-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        ${p.salePrice}
      </button>
    );
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Selecciona tratamiento y rango</p>
      <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#e2e8f0' }}>
        <div className="grid grid-cols-[1fr_90px_90px_100px] bg-blue-500 text-white text-[11px] font-bold">
          <div style={{ padding: '6px 10px' }}>TRATAMIENTO</div>
          <div style={{ padding: '6px 4px', textAlign: 'center' }}>BAJAS</div>
          <div style={{ padding: '6px 4px', textAlign: 'center' }}>ALTAS</div>
          <div style={{ padding: '6px 4px', textAlign: 'center' }}>PROCESADO</div>
        </div>
        {Array.from(brandMap.entries()).map(([brand, { bajas, altas, procesado }], i) => (
          <div key={brand} className={`grid grid-cols-[1fr_90px_90px_100px] border-t border-slate-100 dark:border-slate-700/50 items-center ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
            <div className="px-2.5 py-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200">{brand}</div>
            <div style={{ padding: '4px' }}><Cell p={bajas} /></div>
            <div style={{ padding: '4px' }}><Cell p={altas} /></div>
            <div style={{ padding: '4px' }}><Cell p={procesado} /></div>
          </div>
        ))}
        {brandMap.size === 0 && <div className="text-center py-6 text-slate-400 text-sm">Sin lentes en catálogo</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepMica({ micasPorGrupo, selected, onSelect }: {
  micasPorGrupo: Map<string, Map<string, Record<string, any>>>;
  selected: { grupo: string; brand: string } | null;
  onSelect: (grupo: string, brand: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Selecciona el tipo de mica</p>
      {MICA_GRUPOS.map(g => {
        const map = micasPorGrupo.get(g.key) || new Map();
        const brands = Array.from(map.keys());
        if (brands.length === 0) return null;
        return (
          <div key={g.key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{g.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {brands.map(brand => {
                const sel = selected?.grupo === g.key && selected?.brand === brand;
                return (
                  <button
                    key={brand}
                    onClick={() => onSelect(g.key, brand)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-colors
                      ${sel ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepTratamiento({ brand, tipos, selected, onSelect }: {
  brand: string;
  tipos: Record<string, any>;
  selected: any | null;
  onSelect: (p: any) => void;
}) {
  const known = TIPO_ORDER.filter(k => tipos[k]);
  const rest = Object.keys(tipos).filter(k => !TIPO_ORDER.includes(k)).sort((a, b) => a.localeCompare(b));
  const available = [...known, ...rest];
  return (
    <div className="space-y-3">
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Mica seleccionada</div>
        <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{brand}</div>
      </div>
      <p className="text-sm text-slate-600">Selecciona el tratamiento</p>
      <div className="grid grid-cols-2 gap-2">
        {available.map(k => {
          const p = tipos[k];
          const sel = selected?.id === p.id;
          return (
            <button
              key={k}
              onClick={() => onSelect(p)}
              className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-colors
                ${sel ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'}`}
            >
              <div className="text-[12px] font-bold text-slate-800 dark:text-slate-200">{TIPO_LABELS[k] || k.toUpperCase()}</div>
              <div className="text-[14px] font-bold text-blue-600">${p.salePrice}</div>
            </button>
          );
        })}
      </div>
      {available.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">Sin tratamientos disponibles para esta mica</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepExtras({ solares, biseles, accesorios, selected, onToggle }: {
  solares: any[]; biseles: any[]; accesorios: any[];
  selected: Set<string>; onToggle: (id: string) => void;
}) {
  const Grupo = ({ label, items }: { label: string; items: any[] }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map(p => {
            const sel = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                className={`px-2.5 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer flex items-center gap-1.5 transition-colors
                  ${sel ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {sel && <span className="text-[11px]">✓</span>}
                {p.name}{p.salePrice > 0 && <span className="opacity-75">${p.salePrice}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Extras opcionales (puedes saltarte este paso)</p>
      <Grupo label="Tratamientos solares" items={solares} />
      <Grupo label="Biseles" items={biseles} />
      <Grupo label="Accesorios" items={accesorios} />
      {solares.length + biseles.length + accesorios.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm">No hay extras configurados.</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function StepResumen({ items, total }: { items: CotItem[]; total: number }) {
  if (items.length === 0) return <div className="text-center py-6 text-slate-400 text-sm">Cotización vacía. Regresa y agrega productos.</div>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Resumen de la cotización</p>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        {items.map((it, i) => (
          <div key={i} className={`grid grid-cols-[1fr_100px] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200
            ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}
            ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
            <div className="font-medium">{it.product.name}</div>
            <div className="text-right font-bold">${it.product.salePrice}</div>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_100px] px-3 py-2.5 bg-blue-50 dark:bg-blue-900/30 border-t-2 border-blue-600">
          <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Total</div>
          <div className="text-right text-[16px] font-extrabold text-blue-600 dark:text-blue-400">{fmt(total)}</div>
        </div>
      </div>
    </div>
  );
}
