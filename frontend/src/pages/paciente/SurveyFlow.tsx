import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const ENFERMEDADES_FAMILIARES = [
  'Diabetes', 'Presión alta (Hipertensión)', 'Cáncer',
  'Problemas cardíacos', 'Enfermedades mentales', 'Sordera', 'Otras',
];
const ANTECEDENTES_PATOLOGICOS = [
  'Padece o ha padecido alguna enfermedad',
  '¿Le han realizado alguna cirugía?',
  '¿Alguna vez ha convulsionado?',
  '¿Se ha fracturado algún hueso?',
  '¿Usa lentes?',
  '¿Es alérgico a algún medicamento?',
  '¿Toma algún medicamento o suplemento?',
  'Enfermedades o accidentes de trabajo',
];

type Step = 'tipo' | 'buscar' | 'form' | 'done';

const empty = {
  empresa: '', tipoExamen: '', otroTipo: '', actividades: '',
  nombre: '', edad: '', tipoSangre: '', puestoDeTrabajo: '', celular: '',
  nss: '', fechaNacimiento: '', escolaridad: '', estadoCivil: '', lugarNacimiento: '', correo: '',
  calle: '', numero: '', colonia: '', municipio: '', cp: '',
  practicaDeporte: null as boolean | null, cualDeporte: '', horasDeporte: '',
  habitosAlimenticios: '', calidadSueno: '', especifiqueSueno: '',
  fuma: '', edadInicioFuma: '', anosFumando: '', cigarrosDia: '',
  consumeAlcohol: null as boolean | null, tipoBebida: '', cantidadBebidas: '', frecuenciaAlcohol: '',
  consumeDrogas: '', cualDroga: '', frecuenciaDroga: '', tiempoDroga: '', ultimaVezDroga: '',
  esquemaVacunacion: null as boolean | null, dosisAnticovid: '', marcaVacuna: '',
  tieneTatuajes: null as boolean | null, ultimoTatuaje: '', usaAudifonos: null as boolean | null,
  antecedentesFamiliares: ENFERMEDADES_FAMILIARES.map(e => ({ enfermedad: e, si: null as boolean | null, quien: '' })),
  edadInicioLaboral: '', trabajoMinas: '',
  exposiciones: { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false },
  historialEmpleos: [{ empresa: '', cargo: '', tiempo: '', exponentes: '' }, { empresa: '', cargo: '', tiempo: '', exponentes: '' }, { empresa: '', cargo: '', tiempo: '', exponentes: '' }],
  antecedentesPatologicos: ANTECEDENTES_PATOLOGICOS.map(c => ({ condicion: c, si: null as boolean | null, especifique: '' })),
};

export default function SurveyFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('tipo');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get('/public/companies').then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  // Búsqueda de paciente existente
  const buscar = async () => {
    if (!busqueda.trim()) return;
    const { data } = await api.get('/patients', { params: { q: busqueda } });
    setResultados(data);
  };

  const seleccionarPaciente = (p: any) => {
    setPatientId(p.id);
    setForm(f => ({ ...f, nombre: p.fullName, celular: p.phone || '', correo: p.email || '', nss: p.nss || '' }));
    setStep('form');
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await api.post('/surveys', { ...form, patientId });
      setStep('done');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'done') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
        style={{ background: '#dcfce7' }}>
        <span className="material-symbols-rounded text-green-600 text-4xl">check_circle</span>
      </div>
      <h2 className="text-2xl font-extrabold text-slate-800">¡Encuesta completada!</h2>
      <p className="text-slate-500 text-sm max-w-xs">Tus datos han sido guardados correctamente. El personal te indicará los siguientes pasos.</p>
      <button onClick={onClose} className="btn btn-primary px-8" style={{ background: '#3375c8' }}>Finalizar</button>
    </div>
  );

  if (step === 'tipo') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-xl font-extrabold text-slate-800">¿Eres paciente nuevo o ya registrado?</h2>
      <div className="flex gap-4">
        <button onClick={() => { setPatientId(null); setStep('form'); }}
          className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition w-40">
          <span className="material-symbols-rounded text-4xl text-blue-500">person_add</span>
          <span className="font-semibold text-slate-700">Nuevo</span>
        </button>
        <button onClick={() => setStep('buscar')}
          className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition w-40">
          <span className="material-symbols-rounded text-4xl text-blue-500">manage_search</span>
          <span className="font-semibold text-slate-700">Ya registrado</span>
        </button>
      </div>
    </div>
  );

  if (step === 'buscar') return (
    <div className="flex-1 flex flex-col items-center p-6 gap-4 max-w-lg mx-auto w-full">
      <h2 className="text-xl font-extrabold text-slate-800 self-start">Buscar paciente</h2>
      <div className="flex gap-2 w-full">
        <input className="input flex-1" placeholder="Nombre o teléfono" value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()} />
        <button onClick={buscar} className="btn btn-primary" style={{ background: '#3375c8' }}>Buscar</button>
      </div>
      <div className="w-full space-y-2">
        {resultados.map(p => (
          <button key={p.id} onClick={() => seleccionarPaciente(p)}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition">
            <div className="font-semibold text-slate-800">{p.fullName}</div>
            <div className="text-xs text-slate-500">{p.phone || '—'} · {p.nss || 'Sin NSS'}</div>
          </button>
        ))}
        {resultados.length === 0 && busqueda && <p className="text-sm text-slate-400 text-center py-4">Sin resultados. Puedes continuar como nuevo.</p>}
      </div>
      <button onClick={() => { setPatientId(null); setStep('form'); }} className="text-sm text-blue-500 hover:underline">
        Continuar como paciente nuevo
      </button>
    </div>
  );

  // FORMULARIO COMPLETO
  const af = form.antecedentesFamiliares;
  const ap = form.antecedentesPatologicos;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-8 pb-10">
        <h2 className="text-xl font-extrabold text-slate-800">Cuestionario Médico</h2>

        {/* ENCABEZADO */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Información general</h3>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)}>
              <option value="">— Empresa —</option>
              {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-3">
              {['Ingreso', 'Periódico', 'Otro'].map(t => (
                <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" name="tipoExamen" checked={form.tipoExamen === t} onChange={() => set('tipoExamen', t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          {form.tipoExamen === 'Otro' && <input className="input" placeholder="Especifique" value={form.otroTipo} onChange={e => set('otroTipo', e.target.value)} />}
          <textarea className="input" rows={2} placeholder="Actividades que realiza o realizará en su puesto de trabajo" value={form.actividades} onChange={e => set('actividades', e.target.value)} />
        </section>

        {/* DATOS PERSONALES */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Datos personales</h3>
          <input className="input" placeholder="Nombre completo *" required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Edad" type="number" value={form.edad} onChange={e => set('edad', e.target.value)} />
            <input className="input" placeholder="Tipo de sangre (ej. O+)" value={form.tipoSangre} onChange={e => set('tipoSangre', e.target.value)} />
            <input className="input" placeholder="Puesto de trabajo" value={form.puestoDeTrabajo} onChange={e => set('puestoDeTrabajo', e.target.value)} />
            <input className="input" placeholder="Número de celular" value={form.celular} onChange={e => set('celular', e.target.value)} />
            <input className="input" placeholder="Número de seguro social (NSS)" value={form.nss} onChange={e => set('nss', e.target.value)} />
            <input className="input" type="date" placeholder="Fecha de nacimiento" value={form.fechaNacimiento} onChange={e => set('fechaNacimiento', e.target.value)} />
            <input className="input" placeholder="¿Hasta qué año de la escuela llegó?" value={form.escolaridad} onChange={e => set('escolaridad', e.target.value)} />
            <input className="input" placeholder="Estado civil" value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)} />
            <input className="input" placeholder="¿Dónde nació?" value={form.lugarNacimiento} onChange={e => set('lugarNacimiento', e.target.value)} />
            <input className="input" type="email" placeholder="Correo electrónico" value={form.correo} onChange={e => set('correo', e.target.value)} />
          </div>
          <h4 className="font-semibold text-slate-600 text-sm mt-2">Domicilio actual</h4>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Calle" value={form.calle} onChange={e => set('calle', e.target.value)} />
            <input className="input" placeholder="Número" value={form.numero} onChange={e => set('numero', e.target.value)} />
            <input className="input" placeholder="Colonia" value={form.colonia} onChange={e => set('colonia', e.target.value)} />
            <input className="input" placeholder="Municipio / Estado" value={form.municipio} onChange={e => set('municipio', e.target.value)} />
            <input className="input" placeholder="Código postal" value={form.cp} onChange={e => set('cp', e.target.value)} />
          </div>
        </section>

        {/* HÁBITOS */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Hábitos</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">¿Practica deporte o actividad física?</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.practicaDeporte === true} onChange={() => set('practicaDeporte', true)} /> Sí</label>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.practicaDeporte === false} onChange={() => set('practicaDeporte', false)} /> No</label>
          </div>
          {form.practicaDeporte && (
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="¿Cuál?" value={form.cualDeporte} onChange={e => set('cualDeporte', e.target.value)} />
              <input className="input" placeholder="¿Cuántas horas a la semana?" value={form.horasDeporte} onChange={e => set('horasDeporte', e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">Hábitos alimenticios:</span>
            {['Bueno', 'Regular', 'Malo'].map(v => (
              <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="radio" name="habAlim" checked={form.habitosAlimenticios === v} onChange={() => set('habitosAlimenticios', v)} /> {v}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">Calidad de sueño:</span>
            {['Bueno', 'Malo'].map(v => (
              <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="radio" name="sueno" checked={form.calidadSueno === v} onChange={() => set('calidadSueno', v)} /> {v}
              </label>
            ))}
            <input className="input flex-1" placeholder="Especifique ¿Por qué?" value={form.especifiqueSueno} onChange={e => set('especifiqueSueno', e.target.value)} />
          </div>
        </section>

        {/* TABAQUISMO / ALCOHOL / DROGAS */}
        <section className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-700 border-b pb-2">Hábitos de consumo</h3>

          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-600">¿Usted fuma?</span>
              {['SI', 'NO', 'EXFUMADOR'].map(v => (
                <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" name="fuma" checked={form.fuma === v} onChange={() => set('fuma', v)} /> {v}
                </label>
              ))}
            </div>
            {(form.fuma === 'SI' || form.fuma === 'EXFUMADOR') && (
              <div className="grid grid-cols-3 gap-3">
                <input className="input" placeholder="Edad de inicio" value={form.edadInicioFuma} onChange={e => set('edadInicioFuma', e.target.value)} />
                <input className="input" placeholder="Años fumando" value={form.anosFumando} onChange={e => set('anosFumando', e.target.value)} />
                <input className="input" placeholder="Cigarros por día" value={form.cigarrosDia} onChange={e => set('cigarrosDia', e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-600">¿Consume bebidas alcohólicas?</span>
              <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.consumeAlcohol === true} onChange={() => set('consumeAlcohol', true)} /> Sí</label>
              <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.consumeAlcohol === false} onChange={() => set('consumeAlcohol', false)} /> No</label>
            </div>
            {form.consumeAlcohol && (
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="¿Qué tipo de bebida?" value={form.tipoBebida} onChange={e => set('tipoBebida', e.target.value)} />
                <input className="input" placeholder="¿Cuántas bebidas toma?" value={form.cantidadBebidas} onChange={e => set('cantidadBebidas', e.target.value)} />
                <div className="col-span-2 flex flex-wrap gap-3">
                  <span className="text-sm text-slate-600">Frecuencia:</span>
                  {['Todos los días', 'Cada fin de semana', 'Cada 15 días', 'Cada mes', '1 o 2 veces al año'].map(v => (
                    <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input type="radio" name="frecAlc" checked={form.frecuenciaAlcohol === v} onChange={() => set('frecuenciaAlcohol', v)} /> {v}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-600">¿Consume o ha consumido drogas?</span>
              {[{ v: 'NO_NUNCA', l: 'No, nunca' }, { v: 'SI_CONSUMO', l: 'Sí, consumo' }, { v: 'CONSUMI', l: 'Consumí' }].map(({ v, l }) => (
                <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" name="drogas" checked={form.consumeDrogas === v} onChange={() => set('consumeDrogas', v)} /> {l}
                </label>
              ))}
            </div>
            {form.consumeDrogas && form.consumeDrogas !== 'NO_NUNCA' && (
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="¿Cuál droga?" value={form.cualDroga} onChange={e => set('cualDroga', e.target.value)} />
                <input className="input" placeholder="Frecuencia del consumo" value={form.frecuenciaDroga} onChange={e => set('frecuenciaDroga', e.target.value)} />
                <input className="input" placeholder="¿Cuánto tiempo consumió?" value={form.tiempoDroga} onChange={e => set('tiempoDroga', e.target.value)} />
                <input className="input" placeholder="¿Cuándo fue la última vez?" value={form.ultimaVezDroga} onChange={e => set('ultimaVezDroga', e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {/* VACUNACIÓN */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Vacunación y otros</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">¿Esquema de vacunación completo?</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.esquemaVacunacion === true} onChange={() => set('esquemaVacunacion', true)} /> Sí</label>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.esquemaVacunacion === false} onChange={() => set('esquemaVacunacion', false)} /> No</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Número de dosis anticovid" value={form.dosisAnticovid} onChange={e => set('dosisAnticovid', e.target.value)} />
            <input className="input" placeholder="¿Cuál marca?" value={form.marcaVacuna} onChange={e => set('marcaVacuna', e.target.value)} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">¿Tiene tatuajes?</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.tieneTatuajes === true} onChange={() => set('tieneTatuajes', true)} /> Sí</label>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.tieneTatuajes === false} onChange={() => set('tieneTatuajes', false)} /> No</label>
            {form.tieneTatuajes && <input className="input flex-1" placeholder="¿Último?" value={form.ultimoTatuaje} onChange={e => set('ultimoTatuaje', e.target.value)} />}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">¿Usa audífonos para escuchar música con frecuencia?</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.usaAudifonos === true} onChange={() => set('usaAudifonos', true)} /> Sí</label>
            <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="radio" checked={form.usaAudifonos === false} onChange={() => set('usaAudifonos', false)} /> No</label>
          </div>
        </section>

        {/* ANTECEDENTES FAMILIARES */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Antecedentes familiares</h3>
          <p className="text-xs text-slate-500">¿Tiene familiares directos (padre, madre, abuelos, hermanos, hijos) que padezcan o hayan padecido alguna de las siguientes enfermedades?</p>
          <div className="space-y-2">
            {af.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-52 shrink-0">{item.enfermedad}</span>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={item.si === true} onChange={() => {
                    const next = [...af]; next[i] = { ...next[i], si: true };
                    set('antecedentesFamiliares', next);
                  }} /> Sí
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={item.si === false} onChange={() => {
                    const next = [...af]; next[i] = { ...next[i], si: false };
                    set('antecedentesFamiliares', next);
                  }} /> No
                </label>
                {item.si && (
                  <input className="input flex-1 text-sm" placeholder="¿Quién?" value={item.quien}
                    onChange={e => { const next = [...af]; next[i] = { ...next[i], quien: e.target.value }; set('antecedentesFamiliares', next); }} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* LABORALES */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Antecedentes laborales</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="¿A qué edad empezó a laborar?" value={form.edadInicioLaboral} onChange={e => set('edadInicioLaboral', e.target.value)} />
            <input className="input" placeholder="¿Ha trabajado en minas? ¿Cuánto tiempo?" value={form.trabajoMinas} onChange={e => set('trabajoMinas', e.target.value)} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Ha estado expuesto a:</p>
            <div className="flex flex-wrap gap-4">
              {[['ruidos', 'Ruidos muy fuertes'], ['polvos', 'Polvos'], ['vapores', 'Vapores'], ['humos', 'Humos'], ['riesgoElectrico', 'Riesgo eléctrico']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={(form.exposiciones as any)[k]}
                    onChange={e => set('exposiciones', { ...form.exposiciones, [k]: e.target.checked })} /> {l}
                </label>
              ))}
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" checked={!!form.exposiciones.usaEpp}
                  onChange={e => set('exposiciones', { ...form.exposiciones, usaEpp: e.target.checked })} />
                ¿Uso EPP?
              </label>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Ponga en orden su trabajo actual (1) y los 2 en que haya durado más tiempo:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 text-xs">
                <th className="text-left pb-1">#</th>
                <th className="text-left pb-1">Empresa</th>
                <th className="text-left pb-1">Cargo/Puesto</th>
                <th className="text-left pb-1">Tiempo trabajado</th>
                <th className="text-left pb-1">Exponentes</th>
              </tr></thead>
              <tbody>
                {form.historialEmpleos.map((emp, i) => (
                  <tr key={i}>
                    <td className="pr-2 text-slate-400">{i + 1}.</td>
                    {(['empresa', 'cargo', 'tiempo', 'exponentes'] as const).map(col => (
                      <td key={col} className="pr-2 pb-1">
                        <input className="input text-sm" value={(emp as any)[col]}
                          onChange={e => {
                            const next = [...form.historialEmpleos];
                            next[i] = { ...next[i], [col]: e.target.value };
                            set('historialEmpleos', next);
                          }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ANTECEDENTES PATOLÓGICOS */}
        <section className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-700 border-b pb-2">Antecedentes patológicos</h3>
          <div className="space-y-2">
            {ap.map((item, i) => (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-slate-700 flex-1 min-w-[220px]">{item.condicion}</span>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={item.si === true} onChange={() => {
                    const next = [...ap]; next[i] = { ...next[i], si: true };
                    set('antecedentesPatologicos', next);
                  }} /> Sí
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={item.si === false} onChange={() => {
                    const next = [...ap]; next[i] = { ...next[i], si: false };
                    set('antecedentesPatologicos', next);
                  }} /> No
                </label>
                {item.si && (
                  <input className="input flex-1 min-w-[160px] text-sm" placeholder="Especifique y hace cuánto tiempo"
                    value={item.especifique}
                    onChange={e => { const next = [...ap]; next[i] = { ...next[i], especifique: e.target.value }; set('antecedentesPatologicos', next); }} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* BOTONES */}
        <div className="flex gap-3 justify-end pb-4">
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="btn btn-primary px-8" style={{ background: '#3375c8' }}>
            {saving ? 'Guardando…' : 'Guardar encuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}
