import { useParams, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useState } from 'react';
import { useAuth } from '../../stores/auth';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export default function PatientDetail() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<'survey' | 'results' | 'clinical' | 'sales'>('survey');
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
        <SurveyTab patientId={p.id} survey={survey} patientName={p.fullName} patientCompany={p.company || ''} />
      )}

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
  antGineco: { menarca: '', fum: '', ritmo: '', ivs: '', g: '', p: '', c: '', a: '', fup: '', mpf: '', pap: '', its: '', otros: '' },
  antAndro: { espermaquia: '', ivs: '', hijosMujeres: '', hijosHombres: '', mpf: '', psa: '', its: '', otros: '' },
  riesgoCardio: { hdl: '', colesterol: '', edadCv: '', porcentajeRiesgo: '', riesgo: '' },
  examenes: { audiometria: '', espirometria: '', otoscopia: '', dientes: '', otros: '', tiempo: '' },
  ruffier: { reposoP: '', reposoR: '', esfuerzoP: '', esfuerzoR: '', minutoP: '', minutoR: '', calificacion: '' },
  rayosX: { ic: '', anterior: '', sagital: '', ferguson: '', lordotico: '', coob: '', dismetria: '', l3: '', hallazgos: '' },
  recibeRadiografias: false, fechaRadiografias: '', indicacionesConocidas: false, notas: '',
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
    ruffier: { ...EMPTY_EXAM.ruffier, ...(initial.ruffier || {}) },
    rayosX: { ...EMPTY_EXAM.rayosX, ...(initial.rayosX || {}) },
  } : EMPTY_EXAM);

  const set = (section: string, key: string, val: any) =>
    setF((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: val } }));

  const inp = (section: string, key: string, placeholder?: string) => (
    <input className="input text-xs" placeholder={placeholder || key} value={(f[section] as any)[key] || ''} onChange={(e) => set(section, key, e.target.value)} />
  );
  const chk = (section: string, key: string, label: string) => (
    <label className="flex items-center gap-1 text-xs cursor-pointer">
      <input type="checkbox" checked={(f[section] as any)[key] || false} onChange={(e) => set(section, key, e.target.checked)} />
      {label}
    </label>
  );

  const avRow = (eye: string, label: string) => (
    <tr>
      <td className="px-2 py-1 font-semibold text-xs uppercase">{label}</td>
      <td className="px-1 py-1"><input className="input text-xs" value={(f.agudezaVisual as any)[eye]?.sinLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, [eye]: { ...p.agudezaVisual[eye], sinLentes: e.target.value } } }))} /></td>
      <td className="px-1 py-1"><input className="input text-xs" value={(f.agudezaVisual as any)[eye]?.conLentes || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, [eye]: { ...p.agudezaVisual[eye], conLentes: e.target.value } } }))} /></td>
      <td className="px-1 py-1"><input className="input text-xs" value={(f.agudezaVisual as any)[eye]?.recuperacion || ''} onChange={(e) => setF((p: any) => ({ ...p, agudezaVisual: { ...p.agudezaVisual, [eye]: { ...p.agudezaVisual[eye], recuperacion: e.target.value } } }))} /></td>
    </tr>
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
        <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Agudeza visual</h4>
        <div className="overflow-x-auto">
          <table className="tbl w-full">
            <thead><tr>
              <th></th>
              <th className="text-center">Sin lentes</th>
              <th className="text-center">Con lentes</th>
              <th className="text-center">Recuperación</th>
            </tr></thead>
            <tbody>
              {avRow('od', 'Derecho')}
              {avRow('oi', 'Izquierdo')}
              {avRow('ambos', 'Ambos ojos')}
              {avRow('cercana', 'Cercana')}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {chk('opcionesLentes', 'seguridad', 'Seguridad')}
          {chk('opcionesLentes', 'usoDiario', 'Uso diario')}
          {chk('opcionesLentes', 'ambos', 'Ambos')}
          {chk('opcionesLentes', 'actualizacion', 'Actualización')}
          {chk('opcionesLentes', 'fotosensible', 'Fotosensible')}
          {chk('opcionesLentes', 'astigmatismo', 'Astigmatismo')}
          {chk('opcionesLentes', 'miopia', 'Miopía')}
          {chk('opcionesLentes', 'hipermetropia', 'Hipermetropía')}
          {chk('opcionesLentes', 'presbicia', 'Presbicia')}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {inp('opcionesLentes', 'cirugias', 'Cirugías')}
          {inp('opcionesLentes', 'pterigionOd', 'Pterigion OD')}
          {inp('opcionesLentes', 'pterigionOi', 'Pterigion OI')}
          {inp('opcionesLentes', 'lubricante', 'Lubricante')}
          {inp('opcionesLentes', 'campimetria', 'Campimetría')}
          {inp('opcionesLentes', 'campimetriaAst', 'Campimetría *')}
          {inp('opcionesLentes', 'rejilla', 'Rejilla')}
          {inp('opcionesLentes', 'ishihara', 'Ishihara')}
          {inp('opcionesLentes', 'errores', 'Errores')}
          {inp('opcionesLentes', 'haceUsoLentes', '¿Hace cuánto usa lentes?')}
          {inp('opcionesLentes', 'ultimaActualizacion', 'Última actualización')}
          {inp('opcionesLentes', 'otros', 'Otros')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SIGNOS VITALES */}
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Signos vitales</h4>
          <div className="grid grid-cols-2 gap-2">
            {['peso','talla','imc','ta','fc','fr','temperatura','sao2','cintura','cadera','torax'].map((k) => (
              <div key={k}>
                <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{k.toUpperCase()}</label>
                {inp('signosVitales', k, '')}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>IMC Clasificación</label>
            <select className="input text-xs" value={f.signosVitales.imcClasificacion} onChange={(e) => set('signosVitales', 'imcClasificacion', e.target.value)}>
              <option value="">—</option>
              {IMC_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* RIESGO CARDIOVASCULAR */}
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Riesgo cardiovascular</h4>
          <div className="space-y-2">
            {[['hdl','HDL'],['colesterol','Colesterol'],['edadCv','Edad CV'],['porcentajeRiesgo','% Riesgo'],['riesgo','Riesgo']].map(([k, l]) => (
              <div key={k} className="flex items-center gap-2">
                <label className="text-xs w-28 shrink-0">{l}</label>
                <input className="input text-xs" value={(f.riesgoCardio as any)[k] || ''} onChange={(e) => set('riesgoCardio', k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ANTECEDENTES GINECO */}
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Antecedentes gineco-obstétricos</h4>
          <div className="grid grid-cols-2 gap-2">
            {[['menarca','Menarca'],['fum','FUM'],['ritmo','Ritmo'],['ivs','IVS'],['g','G'],['p','P'],['c','C'],['a','A'],['fup','FUP'],['mpf','MPF'],['pap','PAP'],['its','ITS'],['otros','Otros']].map(([k, l]) => (
              <div key={k}>
                <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{l}</label>
                {inp('antGineco', k, '')}
              </div>
            ))}
          </div>
        </div>

        {/* ANTECEDENTES ANDROLOGICOS */}
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Antecedentes andrológicos</h4>
          <div className="grid grid-cols-2 gap-2">
            {[['espermaquia','Espermaquia'],['ivs','IVS'],['hijosMujeres','Hijos mujeres'],['hijosHombres','Hijos hombres'],['mpf','MPF'],['psa','PSA'],['its','ITS'],['otros','Otros']].map(([k, l]) => (
              <div key={k}>
                <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{l}</label>
                {inp('antAndro', k, '')}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EXAMENES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Exámenes</h4>
          <div className="space-y-2">
            {[['audiometria','Audiometría'],['espirometria','Espirometría'],['otoscopia','Otoscopía'],['dientes','Dientes'],['otros','Otros'],['tiempo','Tiempo']].map(([k, l]) => (
              <div key={k} className="flex items-center gap-2">
                <label className="text-xs w-28 shrink-0">{l}</label>
                <input className="input text-xs" value={(f.examenes as any)[k] || ''} onChange={(e) => set('examenes', k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* PRUEBA RUFFIER */}
        <div className="card">
          <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Prueba Ruffier y Dickson</h4>
          <table className="tbl w-full">
            <thead><tr><th>Momento</th><th className="text-center">Pulso</th><th className="text-center">Respiración</th></tr></thead>
            <tbody>
              {[['reposo','En reposo'],['esfuerzo','Inmediatamente después'],['minuto','1 min. después']].map(([k, l]) => (
                <tr key={k}>
                  <td className="text-xs">{l}</td>
                  <td className="px-1"><input className="input text-xs" value={(f.ruffier as any)[`${k}P`] || ''} onChange={(e) => set('ruffier', `${k}P`, e.target.value)} /></td>
                  <td className="px-1"><input className="input text-xs" value={(f.ruffier as any)[`${k}R`] || ''} onChange={(e) => set('ruffier', `${k}R`, e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs">Calificación</label>
            <input className="input text-xs" value={f.ruffier.calificacion || ''} onChange={(e) => set('ruffier', 'calificacion', e.target.value)} />
          </div>
        </div>
      </div>

      {/* RAYOS X */}
      <div className="card">
        <h4 className="card-title text-primary-600 uppercase text-xs tracking-wider mb-3">Rayos X</h4>
        <div className="overflow-x-auto">
          <table className="tbl w-full">
            <thead><tr>
              {['IC','Anterior','Sagital','Fergusón','Lordótico','COOB','Dismetría','L3'].map((h) => <th key={h} className="text-center text-[10px]">{h}</th>)}
            </tr></thead>
            <tbody><tr>
              {['ic','anterior','sagital','ferguson','lordotico','coob','dismetria','l3'].map((k) => (
                <td key={k} className="px-1 py-1"><input className="input text-xs w-16" value={(f.rayosX as any)[k] || ''} onChange={(e) => set('rayosX', k, e.target.value)} /></td>
              ))}
            </tr></tbody>
          </table>
        </div>
        <div className="mt-2">
          <label className="text-xs block mb-1">Hallazgos</label>
          <input className="input text-xs" value={f.rayosX.hallazgos || ''} onChange={(e) => set('rayosX', 'hallazgos', e.target.value)} />
        </div>
      </div>

      {/* FOOTER */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.recibeRadiografias || false} onChange={(e) => setF((p: any) => ({ ...p, recibeRadiografias: e.target.checked }))} />
            Recibo radiografías impresas
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs">Fecha</label>
            <input className="input text-xs w-36" type="date" value={f.fechaRadiografias || ''} onChange={(e) => setF((p: any) => ({ ...p, fechaRadiografias: e.target.value }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={f.indicacionesConocidas || false} onChange={(e) => setF((p: any) => ({ ...p, indicacionesConocidas: e.target.checked }))} />
          Se me dieron a conocer las indicaciones antes de acudir al examen médico
        </label>
        <div>
          <label className="text-xs block mb-1">Notas adicionales</label>
          <textarea className="input text-xs" rows={2} value={f.notas || ''} onChange={(e) => setF((p: any) => ({ ...p, notas: e.target.value }))} />
        </div>
        <div className="flex justify-end">
          <button onClick={() => onSave(f)} className="btn btn-primary">Guardar resultados</button>
        </div>
      </div>
    </div>
  );
}

// ── Survey Tab ──────────────────────────────────────────────────────
const ENFERMEDADES_FAM = ['Diabetes','Hipertensión','Cardiopatía','Cáncer','Epilepsia','Artritis','Depresión','Obesidad','Asma','Tuberculosis','Otros'];
const PATOLOGICOS = ['Diabetes','Hipertensión','Cardiopatía','Cáncer','Epilepsia','Artritis','Depresión','Fractura','Cirugía','Alergias','Asma','Tuberculosis'];

function buildInitialSurvey(survey: any, patientName: string, patientCompany: string) {
  return {
    empresa: patientCompany || '', tipoExamen: '', otroTipo: '', actividades: '',
    nombre: patientName || '', edad: '', tipoSangre: '', puestoDeTrabajo: '',
    celular: '', nss: '', fechaNacimiento: '', escolaridad: '', estadoCivil: '',
    lugarNacimiento: '', correo: '',
    calle: '', numero: '', colonia: '', municipio: '', cp: '',
    practicaDeporte: false, cualDeporte: '', horasDeporte: '',
    habitosAlimenticios: '', calidadSueno: '', especifiqueSueno: '',
    fuma: 'NO', edadInicioFuma: '', anosFumando: '', cigarrosDia: '',
    consumeAlcohol: false, tipoBebida: '', cantidadBebidas: '', frecuenciaAlcohol: '',
    consumeDrogas: 'NO_NUNCA', cualDroga: '', frecuenciaDroga: '', tiempoDroga: '', ultimaVezDroga: '',
    esquemaVacunacion: false, dosisAnticovid: '', marcaVacuna: '',
    tieneTatuajes: false, ultimoTatuaje: '', usaAudifonos: false,
    antecedentesFamiliares: ENFERMEDADES_FAM.map((e) => ({ enfermedad: e, si: false, quien: '' })),
    edadInicioLaboral: '', trabajoMinas: '',
    exposiciones: { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false },
    historialEmpleos: [{ empresa: '', cargo: '', tiempo: '', exponentes: '' }],
    antecedentesPatologicos: PATOLOGICOS.map((c) => ({ condicion: c, si: false, especifique: '' })),
    ...(survey || {}),
    edad: survey?.edad != null ? String(survey.edad) : '',
    antecedentesFamiliares: survey?.antecedentesFamiliares?.length
      ? survey.antecedentesFamiliares
      : ENFERMEDADES_FAM.map((e) => ({ enfermedad: e, si: false, quien: '' })),
    antecedentesPatologicos: survey?.antecedentesPatologicos?.length
      ? survey.antecedentesPatologicos
      : PATOLOGICOS.map((c) => ({ condicion: c, si: false, especifique: '' })),
    exposiciones: survey?.exposiciones || { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false },
    historialEmpleos: survey?.historialEmpleos?.length
      ? survey.historialEmpleos
      : [{ empresa: '', cargo: '', tiempo: '', exponentes: '' }],
  };
}

function SurveyTab({ patientId, survey, patientName, patientCompany }: { patientId: string; survey: any; patientName: string; patientCompany: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(() => buildInitialSurvey(survey, patientName, patientCompany));
  const [saving, setSaving] = useState(false);
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/companies')).data,
  });

  const [initialized, setInitialized] = useState(false);
  if (survey !== undefined && !initialized) {
    setInitialized(true);
    setF(buildInitialSurvey(survey, patientName, patientCompany));
  }

  const set = (key: string, val: any) => setF((p: any) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (survey?.id) {
        await api.put(`/surveys/${survey.id}`, { ...f, patientId });
      } else {
        await api.post('/surveys', { ...f, patientId });
      }
      await qc.invalidateQueries({ queryKey: ['survey', patientId] });
      toast.success('Encuesta guardada');
    } catch {
      toast.error('Error al guardar encuesta');
    } finally {
      setSaving(false);
    }
  };

  const inp = (key: string, label: string, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input className="input text-xs" type={type} value={f[key] || ''} onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const sel = (key: string, label: string, opts: string[]) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select className="input text-xs" value={f[key] || ''} onChange={(e) => set(key, e.target.value)}>
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const chkField = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input type="checkbox" checked={!!f[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
          {saving ? 'Guardando…' : 'Guardar encuesta'}
        </button>
      </div>

      {/* ENCABEZADO */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Información general</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Empresa</label>
            <select className="input text-xs" value={f.empresa || ''} onChange={(e) => set('empresa', e.target.value)}>
              <option value="">— Selecciona empresa —</option>
              {companies.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          {sel('tipoExamen', 'Tipo de examen', ['Ingreso', 'Periódico', 'Egreso', 'Otro'])}
          {f.tipoExamen === 'Otro' && inp('otroTipo', 'Especifique')}
          <div className="md:col-span-3 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Actividades realizadas</label>
            <input className="input text-xs" value={f.actividades || ''} onChange={(e) => set('actividades', e.target.value)} />
          </div>
        </div>
      </div>

      {/* DATOS PERSONALES */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Datos personales</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {inp('nombre', 'Nombre completo')}
          {inp('edad', 'Edad', 'number')}
          {inp('tipoSangre', 'Tipo de sangre')}
          {inp('puestoDeTrabajo', 'Puesto de trabajo')}
          {inp('celular', 'Celular')}
          {inp('nss', 'NSS')}
          {inp('fechaNacimiento', 'Fecha de nacimiento', 'date')}
          {sel('escolaridad', 'Escolaridad', ['Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Posgrado'])}
          {sel('estadoCivil', 'Estado civil', ['Soltero(a)','Casado(a)','Unión libre','Divorciado(a)','Viudo(a)'])}
          {inp('lugarNacimiento', 'Lugar de nacimiento')}
          {inp('correo', 'Correo', 'email')}
        </div>
      </div>

      {/* DOMICILIO */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Domicilio</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {inp('calle', 'Calle')}
          {inp('numero', 'Número')}
          {inp('colonia', 'Colonia')}
          {inp('municipio', 'Municipio / Estado')}
          {inp('cp', 'CP')}
        </div>
      </div>

      {/* HÁBITOS */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Hábitos</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {chkField('practicaDeporte', 'Practica deporte')}
          {f.practicaDeporte && <>{inp('cualDeporte', '¿Cuál deporte?')}{inp('horasDeporte', 'Horas/semana')}</>}
          {sel('habitosAlimenticios', 'Hábitos alimenticios', ['Bueno','Regular','Malo'])}
          {sel('calidadSueno', 'Calidad de sueño', ['Bueno','Malo'])}
          {f.calidadSueno === 'Malo' && inp('especifiqueSueno', 'Especifique')}
        </div>
      </div>

      {/* TABAQUISMO / ALCOHOL / DROGAS */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Hábitos de consumo</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sel('fuma', 'Tabaquismo', ['NO','SI','EXFUMADOR'])}
          {(f.fuma === 'SI' || f.fuma === 'EXFUMADOR') && <>
            {inp('edadInicioFuma', 'Edad inicio')}
            {inp('anosFumando', 'Años fumando')}
            {inp('cigarrosDia', 'Cigarros/día')}
          </>}
          {chkField('consumeAlcohol', 'Consume alcohol')}
          {f.consumeAlcohol && <>
            {inp('tipoBebida', 'Tipo de bebida')}
            {inp('cantidadBebidas', 'Cantidad')}
            {sel('frecuenciaAlcohol', 'Frecuencia', ['Todos los días','Cada fin de semana','Cada 15 días','Cada mes','1 o 2 veces al año'])}
          </>}
          {sel('consumeDrogas', 'Drogas', ['NO_NUNCA','SI_CONSUMO','CONSUMI'])}
          {f.consumeDrogas !== 'NO_NUNCA' && <>
            {inp('cualDroga', '¿Cuál?')}
            {inp('frecuenciaDroga', 'Frecuencia')}
            {inp('tiempoDroga', 'Tiempo')}
            {inp('ultimaVezDroga', 'Última vez')}
          </>}
        </div>
      </div>

      {/* VACUNACIÓN */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Vacunación y otros</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {chkField('esquemaVacunacion', 'Esquema de vacunación completo')}
          {inp('dosisAnticovid', 'Dosis anticovid')}
          {inp('marcaVacuna', 'Marca vacuna')}
          {chkField('tieneTatuajes', 'Tiene tatuajes')}
          {f.tieneTatuajes && inp('ultimoTatuaje', 'Último tatuaje')}
          {chkField('usaAudifonos', 'Usa audífonos')}
        </div>
      </div>

      {/* ANTECEDENTES FAMILIARES */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Antecedentes familiares</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(f.antecedentesFamiliares || []).map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs w-32 cursor-pointer shrink-0">
                <input type="checkbox" checked={!!a.si} onChange={(e) => {
                  const arr = [...f.antecedentesFamiliares];
                  arr[i] = { ...arr[i], si: e.target.checked };
                  set('antecedentesFamiliares', arr);
                }} />
                {a.enfermedad}
              </label>
              {a.si && <input className="input text-xs" placeholder="¿Quién?" value={a.quien || ''} onChange={(e) => {
                const arr = [...f.antecedentesFamiliares];
                arr[i] = { ...arr[i], quien: e.target.value };
                set('antecedentesFamiliares', arr);
              }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ANTECEDENTES PATOLÓGICOS */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Antecedentes patológicos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(f.antecedentesPatologicos || []).map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs w-32 cursor-pointer shrink-0">
                <input type="checkbox" checked={!!a.si} onChange={(e) => {
                  const arr = [...f.antecedentesPatologicos];
                  arr[i] = { ...arr[i], si: e.target.checked };
                  set('antecedentesPatologicos', arr);
                }} />
                {a.condicion}
              </label>
              {a.si && <input className="input text-xs" placeholder="Especifique" value={a.especifique || ''} onChange={(e) => {
                const arr = [...f.antecedentesPatologicos];
                arr[i] = { ...arr[i], especifique: e.target.value };
                set('antecedentesPatologicos', arr);
              }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ANTECEDENTES LABORALES */}
      <div className="card">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Antecedentes laborales</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {inp('edadInicioLaboral', 'Edad inicio laboral')}
          {inp('trabajoMinas', 'Trabajo en minas')}
        </div>
        <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Exposiciones</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {(['ruidos','polvos','vapores','humos','riesgoElectrico','usaEpp'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!(f.exposiciones || {})[k]} onChange={(e) => set('exposiciones', { ...(f.exposiciones || {}), [k]: e.target.checked })} />
              {k === 'ruidos' ? 'Ruidos fuertes' : k === 'polvos' ? 'Polvos' : k === 'vapores' ? 'Vapores' : k === 'humos' ? 'Humos' : k === 'riesgoElectrico' ? 'Riesgo eléctrico' : 'Usa EPP'}
            </label>
          ))}
        </div>
        <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Historial de empleos</p>
        {(f.historialEmpleos || []).map((e: any, i: number) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 p-2 border border-slate-100 rounded-lg">
            {(['empresa','cargo','tiempo','exponentes'] as const).map((k) => (
              <input key={k} className="input text-xs" placeholder={k.charAt(0).toUpperCase() + k.slice(1)} value={e[k] || ''}
                onChange={(ev) => {
                  const arr = [...f.historialEmpleos];
                  arr[i] = { ...arr[i], [k]: ev.target.value };
                  set('historialEmpleos', arr);
                }} />
            ))}
          </div>
        ))}
        <button className="text-xs text-blue-600 hover:underline mt-1" onClick={() => set('historialEmpleos', [...(f.historialEmpleos || []), { empresa: '', cargo: '', tiempo: '', exponentes: '' }])}>
          + Agregar empleo
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? 'Guardando…' : 'Guardar encuesta'}
        </button>
      </div>
    </div>
  );
}

const boolLabel = (v: boolean | null | undefined) => v === true ? 'Sí' : v === false ? 'No' : '—';

function SurveySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3 text-sm">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function SurveyRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-sm">
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700 font-medium">{value ?? '—'}</span>
    </div>
  );
}
