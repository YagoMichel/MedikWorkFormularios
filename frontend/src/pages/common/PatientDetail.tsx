import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState, useEffect } from 'react';
import { useAuth } from '../../stores/auth';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, ArrowDown, HeartPulse, Droplet, FlaskConical, Baby, Stethoscope, Activity, Bone, FileDown } from 'lucide-react';
import { SurveyEditorForm } from '../../components/SurveyEditorForm';
import { downloadSurveyPdf } from '../../utils/surveyPdf';

export default function PatientDetail() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<'survey' | 'results' | 'clinical' | 'documentos' | 'sales'>('survey');
  const { data: p, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data,
  });

  const { data: survey } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      const { data } = await api.get('/surveys', { params: { patientId: id } });
      return data[0] || null;
    },
  });

  if (isLoading || !p) return <div>Cargando...</div>;

  const tabs: any[] = [
    { k: 'survey', l: 'Datos del paciente' },
    { k: 'results', l: 'Resultados' },
    { k: 'clinical', l: 'Historial clínico' },
    { k: 'documentos', l: 'Documentos' },
  ];
  if (user?.role === 'ADMIN') tabs.push({ k: 'sales', l: 'Compras' });

  return (
    <div className="space-y-4">
      <Link to="/patients" className="text-sm text-slate-500 flex items-center gap-1"><ArrowLeft size={14} /> Volver</Link>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'survey' && (
        <SurveyTab patientId={p.id} survey={survey} />
      )}

      {tab === 'documentos' && <DocumentosTab survey={survey} patient={p} />}

      {tab === 'results' && <MedicalExamTab patientId={p.id} />}

      {tab === 'clinical' && (
        <div className="card">
          <h3 className="font-semibold mb-3">Citas</h3>
          {p.appointments.map((a: any) => (
            <div key={a.id} className="flex justify-between py-2 text-sm border-t border-slate-100">
              <span>{new Date(a.date).toLocaleString()}</span>
              <span>{a.doctor.fullName}</span>
              <span>{a.status}</span>
            </div>
          ))}
          {p.appointments.length === 0 && <p className="text-slate-500 text-sm">Sin consultas registradas.</p>}
        </div>
      )}

      {tab === 'sales' && (
        <div className="card">
          {p.sales.map((s: any) => (
            <div key={s.id} className="flex justify-between py-2 text-sm border-t border-slate-100">
              <span className="font-mono">{s.folio}</span>
              <span>{new Date(s.createdAt).toLocaleDateString()}</span>
              <span>${s.total.toFixed(2)}</span>
              <span className="text-xs">{s.status}</span>
            </div>
          ))}
          {p.sales.length === 0 && <p className="text-slate-500 text-sm">Sin compras.</p>}
        </div>
      )}

    </div>
  );
}

// ── Medical Exam Tab ────────────────────────────────────────────────
function MedicalExamTab({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['medical-exams', patientId],
    queryFn: async () => (await api.get('/medical-exams', { params: { patientId } })).data,
  });

  if (isLoading) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando...</p>;

  const latest = exams[0] as any | undefined;

  const save = async (data: any) => {
    if (latest?.id) {
      await api.put(`/medical-exams/${latest.id}`, data);
    } else {
      await api.post('/medical-exams', { patientId, ...data });
    }
    await qc.invalidateQueries({ queryKey: ['medical-exams', patientId] });
    toast.success('Resultados guardados');
  };

  return <MedicalExamForm initial={latest} onSave={save} />;
}

const EMPTY_AV = { sinLentes: '', conLentes: '', recuperacion: '' };
const EMPTY_EXAM = {
  agudezaVisual: { od: { ...EMPTY_AV }, oi: { ...EMPTY_AV }, ambos: { ...EMPTY_AV }, cercana: { ...EMPTY_AV } },
  opcionesLentes: { seguridad: false, usoDiario: false, ambos: false, actualizacion: false, fotosensible: false, cirugias: '', astigmatismo: false, miopia: false, hipermetropia: false, presbicia: false, pterigionOd: '', pterigionOi: '', lubricante: '', campimetria: '', campimetriaAst: '', rejilla: '', ishihara: '', errores: '', haceUsoLentes: '', ultimaActualizacion: '', otros: '' },
  signosVitales: { peso: '', talla: '', imc: '', ta: '', fc: '', fr: '', temperatura: '', sao2: '', cintura: '', cadera: '', torax: '', imcClasificacion: '' },
  antGineco: { menarca: '', fum: '', ritmo: '', ivs: '', g: '', p: '', c: '', a: '', fup: '', mpf: '', its: '', otros: '' },
  antAndro: { hijos: '', hijosMujeres: '', hijosHombres: '', ivs: '', mpf: '', its: '', otros: '' },
  riesgoCardio: { hdl: '', colesterol: '', edadCv: '', porcentajeRiesgo: '', riesgo: '' },
  examenes: { audiometria: '', espirometria: '', otoscopia: '', dientes: '', otros: '', tiempo: '' },
  ruffier: { reposoP: '', reposoR: '', esfuerzoP: '', esfuerzoR: '', minutoP: '', minutoR: '', calificacion: '' },
  rayosX: { ic: '', anterior: '', sagital: '', ferguson: '', lordotico: '', coob: '', dismetria: '', l3: '', hallazgos: '' },
  recibeRadiografias: '', fechaRadiografias: '', indicacionesConocidas: false, notas: '',
};

function MedicalExamForm({ initial, onSave }: { initial?: any; onSave: (d: any) => void }) {
  const [f, setF] = useState<any>(() => initial ? {
    ...EMPTY_EXAM, ...initial,
    agudezaVisual: { ...EMPTY_EXAM.agudezaVisual, ...(initial.agudezaVisual || {}) },
    opcionesLentes: { ...EMPTY_EXAM.opcionesLentes, ...(initial.opcionesLentes || {}) },
    signosVitales: { ...EMPTY_EXAM.signosVitales, ...(initial.signosVitales || {}) },
    antGineco: { ...EMPTY_EXAM.antGineco, ...(initial.antGineco || {}) },
    antAndro: { ...EMPTY_EXAM.antAndro, ...(initial.antAndro || {}) },
    riesgoCardio: { ...EMPTY_EXAM.riesgoCardio, ...(initial.riesgoCardio || {}) },
    examenes: { ...EMPTY_EXAM.examenes, ...(initial.examenes || {}) },
    rayosX: { ...EMPTY_EXAM.rayosX, ...(initial.rayosX || {}) },
  } : EMPTY_EXAM);

  const [genderTab, setGenderTab] = useState<'F' | 'M'>('F');

  useEffect(() => {
    const peso = parseFloat(f.signosVitales.peso);
    const talla = parseFloat(f.signosVitales.talla);
    if (peso > 0 && talla > 0) {
      const imcVal = peso / (talla * talla);
      let clasificacion = '';
      if (imcVal < 18.5) clasificacion = 'Bajo peso';
      else if (imcVal < 25) clasificacion = 'Peso normal';
      else if (imcVal < 30) clasificacion = 'Sobrepeso';
      else if (imcVal < 35) clasificacion = 'Obesidad I';
      else if (imcVal < 40) clasificacion = 'Obesidad II';
      else if (imcVal < 50) clasificacion = 'Obesidad III';
      else clasificacion = 'Obesidad IV';

      if (f.signosVitales.imc !== imcVal.toFixed(1) || f.signosVitales.imcClasificacion !== clasificacion) {
        setF((prev: any) => ({
          ...prev,
          signosVitales: {
            ...prev.signosVitales,
            imc: imcVal.toFixed(1),
            imcClasificacion: clasificacion
          }
        }));
      }
    } else if (!f.signosVitales.peso || !f.signosVitales.talla) {
      if (f.signosVitales.imc !== '' || f.signosVitales.imcClasificacion !== '') {
        setF((prev: any) => ({
          ...prev,
          signosVitales: {
            ...prev.signosVitales,
            imc: '',
            imcClasificacion: ''
          }
        }));
      }
    }
  }, [f.signosVitales.peso, f.signosVitales.talla, f.signosVitales.imc, f.signosVitales.imcClasificacion]);

  useEffect(() => {
    const p1 = parseFloat(f.ruffier.reposoP);
    const p2 = parseFloat(f.ruffier.esfuerzoP);
    const p3 = parseFloat(f.ruffier.minutoP);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      const calc = ((p1 + p2 + p3) - 200) / 10;
      if (f.ruffier.calificacion !== calc.toFixed(1)) {
        setF((prev: any) => ({ ...prev, ruffier: { ...prev.ruffier, calificacion: calc.toFixed(1) } }));
      }
    } else {
      if (f.ruffier.calificacion !== '') {
        setF((prev: any) => ({ ...prev, ruffier: { ...prev.ruffier, calificacion: '' } }));
      }
    }
  }, [f.ruffier.reposoP, f.ruffier.esfuerzoP, f.ruffier.minutoP, f.ruffier.calificacion]);

  const set = (section: string, key: string, val: any) =>
    setF((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: val } }));

  const inp = (section: string, key: string, placeholder?: string) => (
    <input className="input text-xs" placeholder={placeholder || key} value={(f[section] as any)[key] || ''} onChange={(e) => set(section, key, e.target.value)} />
  );
  const chk = (section: string, key: string, label: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium invisible hidden md:block">_</label>
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer h-[38px]" style={{ color: 'var(--text-muted)' }}>
        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={(f[section] as any)[key] || false} onChange={(e) => set(section, key, e.target.checked)} />
        {label}
      </label>
    </div>
  );

  const inpLabeled = (section: string, key: string, label: string, placeholder?: string, type: string = 'text') => (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-sm font-medium truncate" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} className="input min-w-0" placeholder={placeholder} value={(f[section] as any)[key] || ''} onChange={(e) => set(section, key, e.target.value)} />
    </div>
  );

  const selLabeled = (section: string, key: string, label: string, options: string[]) => (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-sm font-medium truncate" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select className="input min-w-0 bg-white dark:bg-slate-800" value={(f[section] as any)[key] || ''} onChange={(e) => set(section, key, e.target.value)}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const IMC_OPTS = ['Bajo peso', 'Peso normal', 'Sobrepeso', 'Obesidad I', 'Obesidad II', 'Obesidad III', 'Obesidad IV'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base">Resultados del examen</h3>
        <button onClick={() => onSave(f)} className="btn btn-primary text-sm">Guardar</button>
      </div>

      {/* AGUDEZA VISUAL */}
      <div className="card">
        <h4 className="flex items-center gap-2 card-title text-base font-bold mb-5" style={{ color: 'var(--text-normal, #1e293b)' }}>
          <Eye size={20} className="text-blue-500" />
          Agudeza visual
        </h4>
        <div className="grid grid-cols-[100px_1fr_1fr_1fr] md:grid-cols-[120px_1fr_1fr_1fr] gap-x-4 gap-y-3 items-center mb-6">
          <div className="col-start-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Sin lentes</div>
          <div className="text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Con lentes</div>
          <div className="text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Recuperación</div>

          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Derecho</div>
          <input className="input" value={(f.agudezaVisual as any)['od']?.sinLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, od: { ...p.agudezaVisual.od, sinLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['od']?.conLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, od: { ...p.agudezaVisual.od, conLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['od']?.recuperacion || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, od: { ...p.agudezaVisual.od, recuperacion: e.target.value } } }))} />

          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Izquierdo</div>
          <input className="input" value={(f.agudezaVisual as any)['oi']?.sinLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, oi: { ...p.agudezaVisual.oi, sinLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['oi']?.conLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, oi: { ...p.agudezaVisual.oi, conLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['oi']?.recuperacion || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, oi: { ...p.agudezaVisual.oi, recuperacion: e.target.value } } }))} />

          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Ambos ojos</div>
          <input className="input" value={(f.agudezaVisual as any)['ambos']?.sinLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, ambos: { ...p.agudezaVisual.ambos, sinLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['ambos']?.conLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, ambos: { ...p.agudezaVisual.ambos, conLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['ambos']?.recuperacion || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, ambos: { ...p.agudezaVisual.ambos, recuperacion: e.target.value } } }))} />

          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cercana</div>
          <input className="input" value={(f.agudezaVisual as any)['cercana']?.sinLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, cercana: { ...p.agudezaVisual.cercana, sinLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['cercana']?.conLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, cercana: { ...p.agudezaVisual.cercana, conLentes: e.target.value } } }))} />
          <input className="input" value={(f.agudezaVisual as any)['cercana']?.recuperacion || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, cercana: { ...p.agudezaVisual.cercana, recuperacion: e.target.value } } }))} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {chk('opcionesLentes', 'seguridad', 'Seguridad')}
          {chk('opcionesLentes', 'usoDiario', 'Uso diario')}
          {chk('opcionesLentes', 'ambos', 'Ambos')}
          {chk('opcionesLentes', 'actualizacion', 'Actualización')}
          {chk('opcionesLentes', 'fotosensible', 'Fotosensible')}
          <div className="col-span-2 md:col-span-3">
            {inpLabeled('opcionesLentes', 'cirugias', 'Cirugías')}
          </div>
          {chk('opcionesLentes', 'astigmatismo', 'Astigmatismo')}
          {chk('opcionesLentes', 'miopia', 'Miopía')}
          {chk('opcionesLentes', 'hipermetropia', 'Hipermetropía')}
          {chk('opcionesLentes', 'presbicia', 'Presbicia')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 mb-4">
          {inpLabeled('opcionesLentes', 'pterigionOd', 'Pterigion OD')}
          {inpLabeled('opcionesLentes', 'pterigionOi', 'Pterigion OI')}
          {inpLabeled('opcionesLentes', 'lubricante', 'Lubricante')}

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Campimetría</label>
            <div className="flex items-center gap-2">
              <input className="input w-full" value={f.opcionesLentes.campimetria || ''} onChange={(e) => set('opcionesLentes', 'campimetria', e.target.value)} />
              <span className="text-slate-400 font-bold px-1">*</span>
              <input className="input w-full" value={f.opcionesLentes.campimetriaAst || ''} onChange={(e) => set('opcionesLentes', 'campimetriaAst', e.target.value)} />
            </div>
          </div>

          {inpLabeled('opcionesLentes', 'rejilla', 'Rejilla')}

          {inpLabeled('opcionesLentes', 'ishihara', 'Ishihara')}
          {inpLabeled('opcionesLentes', 'errores', 'Errores', '0/25')}
          {inpLabeled('opcionesLentes', 'haceUsoLentes', 'Hace cuánto usa lentes')}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Última actualización</label>
            <input className="input text-sm" type="date" value={f.opcionesLentes.ultimaActualizacion || ''} onChange={(e) => set('opcionesLentes', 'ultimaActualizacion', e.target.value)} />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Otros</label>
              <span className="w-5 h-5 flex items-center justify-center rounded-full border border-slate-300" style={{ color: 'var(--text-muted)' }}>
                <ArrowDown size={12} />
              </span>
            </div>
            <textarea className="input" rows={2} value={f.opcionesLentes.otros || ''} onChange={(e) => set('opcionesLentes', 'otros', e.target.value)}></textarea>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4">
        {/* SIGNOS VITALES */}
        <div className="card min-w-0">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
            <HeartPulse size={16} /> Signos vitales
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {inpLabeled('signosVitales', 'peso', 'Peso (kg)')}
            {inpLabeled('signosVitales', 'talla', 'Talla (m)')}
            {inpLabeled('signosVitales', 'ta', 'TA (mmHg)')}
            {inpLabeled('signosVitales', 'fc', 'FC (lpm)')}
            {inpLabeled('signosVitales', 'fr', 'FR (rpm)')}

            {inpLabeled('signosVitales', 'temperatura', 'Tº (ºC)')}
            {inpLabeled('signosVitales', 'sao2', 'SaO2 (%)')}
            {inpLabeled('signosVitales', 'cintura', 'Cintura (cm)')}
            {inpLabeled('signosVitales', 'cadera', 'Cadera (cm)')}
            {inpLabeled('signosVitales', 'torax', 'Tórax (cm)')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-center border border-slate-200">
              <label className="text-[11px] text-slate-500 mb-0.5 block font-medium">IMC (calculado)</label>
              <div className="text-2xl font-bold text-slate-800">{f.signosVitales.imc || '—'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-center border border-slate-200">
              <label className="text-[11px] text-slate-500 mb-0.5 block font-medium">Clasificación (auto)</label>
              <div className="text-lg font-semibold text-primary-600 dark:text-blue-400">{f.signosVitales.imcClasificacion || '—'}</div>
            </div>
          </div>
        </div>

        {/* RIESGO CARDIOVASCULAR */}
        <div className="card min-w-0">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
            <Droplet size={16} /> Riesgo cardiovascular
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {inpLabeled('riesgoCardio', 'hdl', 'HDL')}
            {inpLabeled('riesgoCardio', 'colesterol', 'Colesterol')}
            {inpLabeled('riesgoCardio', 'edadCv', 'Edad CV')}
            {inpLabeled('riesgoCardio', 'porcentajeRiesgo', '% Riesgo')}
            {inpLabeled('riesgoCardio', 'riesgo', 'Riesgo')}
          </div>
        </div>
      </div>

      {/* ANTECEDENTES GINECO / ANDRO */}
      <div className="card mb-4 min-w-0">
        <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
          <Baby size={16} /> Antecedentes gineco-obstétricos / andrológicos
        </h4>

        <div className="flex items-center gap-6 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-slate-800 dark:text-slate-200">
            <input type="radio" name="genderTab" value="F" checked={genderTab === 'F'} onChange={() => setGenderTab('F')} className="w-4 h-4 text-primary-600 focus:ring-primary-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            Mujer
          </label>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-slate-800 dark:text-slate-200">
            <input type="radio" name="genderTab" value="M" checked={genderTab === 'M'} onChange={() => setGenderTab('M')} className="w-4 h-4 text-primary-600 focus:ring-primary-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            Hombre
          </label>
        </div>

        {genderTab === 'F' && (
          <div>
            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Gineco-obstétricos</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {inpLabeled('antGineco', 'menarca', 'Menarca')}
              {inpLabeled('antGineco', 'fum', 'FUM', '', 'date')}
              {inpLabeled('antGineco', 'ritmo', 'Ritmo')}
              {inpLabeled('antGineco', 'ivs', 'IVS')}

              {inpLabeled('antGineco', 'g', 'G')}
              {inpLabeled('antGineco', 'p', 'P')}
              {inpLabeled('antGineco', 'c', 'C')}
              {inpLabeled('antGineco', 'a', 'A')}

              {inpLabeled('antGineco', 'fup', 'FUP', '', 'date')}
              {inpLabeled('antGineco', 'mpf', 'MPF')}
              {inpLabeled('antGineco', 'its', 'ITS')}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {inpLabeled('antGineco', 'otros', 'Otros')}
            </div>
          </div>
        )}

        {genderTab === 'M' && (
          <div>
            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Andrológicos</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {inpLabeled('antAndro', 'hijos', 'Hijos')}
              {inpLabeled('antAndro', 'hijosMujeres', 'Mujeres')}
              {inpLabeled('antAndro', 'hijosHombres', 'Hombres')}

              {inpLabeled('antAndro', 'ivs', 'IVS')}
              {inpLabeled('antAndro', 'mpf', 'MPF')}
              {inpLabeled('antAndro', 'its', 'ITS')}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {inpLabeled('antAndro', 'otros', 'Otros')}
            </div>
          </div>
        )}
      </div>

      {/* EXAMENES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card min-w-0">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
            <Stethoscope size={16} /> Exploración complementaria
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {inpLabeled('examenes', 'audiometria', 'Audiometría')}
            {selLabeled('examenes', 'espirometria', 'Espirometría', ['A — Normal', 'B', 'C', 'D', 'E — Obstructivo', 'Restrictivo'])}
            {inpLabeled('examenes', 'otoscopia', 'Otoscopía')}
            {inpLabeled('examenes', 'dientes', 'Dientes')}
            {inpLabeled('examenes', 'tiempo', 'Tiempo')}
            {inpLabeled('examenes', 'otros', 'Otros')}
          </div>
        </div>

        {/* PRUEBA RUFFIER */}
        <div className="card min-w-0">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
            <Activity size={16} /> Prueba de Ruffier y Dickson
          </h4>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-2 text-xs font-bold text-slate-500">
            <div>Momento</div>
            <div className="text-center">Pulso</div>
            <div className="text-center">Respiración</div>
          </div>
          <div className="space-y-2 mb-6">
            {[['reposo', 'En reposo'], ['esfuerzo', 'Post-esfuerzo'], ['minuto', '1 min. después']].map(([k, l]) => (
              <div key={k} className="grid grid-cols-[1fr_1fr_1fr] gap-4 items-center">
                <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{l}</div>
                <div>
                  <input type="number" className="input text-center font-medium" value={(f.ruffier as any)[`${k}P`] || ''} onChange={(e) => set('ruffier', `${k}P`, e.target.value)} />
                </div>
                <div>
                  <input type="text" className="input text-center" value={(f.ruffier as any)[`${k}R`] || ''} onChange={(e) => set('ruffier', `${k}R`, e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-[#141414] rounded-lg p-4 flex flex-col justify-center border border-slate-200 dark:border-[#2a2a2a]">
            <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block font-medium">Calificación (calculada)</label>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{f.ruffier.calificacion || '—'}</div>
          </div>
        </div>
      </div>

      {/* RAYOS X */}
      <div className="card min-w-0 mb-4">
        <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
          <Bone size={16} /> Rayos X
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-8 gap-4 mb-4">
          {inpLabeled('rayosX', 'ic', 'IC')}
          {inpLabeled('rayosX', 'anterior', 'Anterior')}
          {inpLabeled('rayosX', 'sagital', 'Sagital')}
          {inpLabeled('rayosX', 'ferguson', 'Fergusón')}
          {inpLabeled('rayosX', 'lordotico', 'Lordótico')}

          {inpLabeled('rayosX', 'coob', 'Coob')}
          {inpLabeled('rayosX', 'dismetria', 'Dismetría')}
          {inpLabeled('rayosX', 'l3', 'L3')}
        </div>

        <div className="flex flex-col gap-1 mb-6">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hallazgos</label>
          <textarea className="input min-w-0 h-24 resize-none" value={f.rayosX.hallazgos || ''} onChange={(e) => set('rayosX', 'hallazgos', e.target.value)} />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Recibo radiografías impresas</label>
            <input type="text" className="input w-full md:w-64" value={typeof f.recibeRadiografias === 'boolean' ? '' : f.recibeRadiografias || ''} onChange={(e) => setF((p: any) => ({ ...p, recibeRadiografias: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Fecha</label>
            <input type="date" className="input w-full md:w-48" value={f.fechaRadiografias || ''} onChange={(e) => setF((p: any) => ({ ...p, fechaRadiografias: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="card space-y-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={f.indicacionesConocidas || false} onChange={(e) => setF((p: any) => ({ ...p, indicacionesConocidas: e.target.checked }))} />
          Se me dieron a conocer las indicaciones antes de acudir al examen médico por parte de la empresa de procedencia
        </label>
        <div className="flex justify-end">
          <button onClick={() => onSave(f)} className="btn btn-primary">Guardar resultados</button>
        </div>
      </div>
    </div>
  );
}

// ── Survey Tab ──────────────────────────────────────────────────────
function SurveyTab({ patientId, survey }: { patientId: string; survey: any }) {
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const handleSave = async (payload: any) => {
    if (survey?.id) {
      await api.put(`/surveys/${survey.id}`, payload);
    } else {
      await api.post('/surveys', payload);
    }
    await qc.invalidateQueries({ queryKey: ['survey', patientId] });
  };

  return (
    <SurveyEditorForm
      survey={survey}
      patientId={patientId}
      companies={companies}
      onSave={handleSave}
    />
  );
}

// ── Documentos ────────────────────────────────────────────────────────
function DocumentosTab({ survey, patient }: { survey: any; patient: any }) {
  const [generando, setGenerando] = useState(false);

  const handleClick = async () => {
    if (!survey || generando) return;
    setGenerando(true);
    try {
      await downloadSurveyPdf(survey, patient);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        className={`card flex flex-col items-center gap-2 p-6 text-center ${survey ? 'cursor-pointer hover:shadow-md transition' : 'opacity-50'}`}
        onClick={handleClick}
      >
        <FileDown size={32} className={survey ? 'text-blue-600' : 'text-slate-300'} />
        <div className="font-semibold text-sm">Encuesta</div>
        <div className="text-xs text-slate-400">
          {!survey ? 'El paciente aún no tiene encuesta capturada' : generando ? 'Generando PDF…' : 'Descargar historia clínica (PDF)'}
        </div>
      </div>
    </div>
  );
}
