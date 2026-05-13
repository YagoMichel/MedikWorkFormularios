import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const ENFERMEDADES_FAM = ['Diabetes','Hipertensión','Cardiopatía','Cáncer','Epilepsia','Artritis','Depresión','Obesidad','Asma','Tuberculosis','Otros'];
const PATOLOGICOS = ['Diabetes','Hipertensión','Cardiopatía','Cáncer','Epilepsia','Artritis','Depresión','Fractura','Cirugía','Alergias','Asma','Tuberculosis'];

const EMPTY: any = {
  empresa: '', tipoExamen: '', otroTipo: '', actividades: '',
  nombre: '', edad: '', tipoSangre: '', puestoDeTrabajo: '',
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
};

export default function SurveyPublic() {
  const [f, setF] = useState<any>({ ...EMPTY });
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get('/public/companies').then((r) => setCompanies(r.data)).catch(() => {});
  }, []);

  const set = (key: string, val: any) => setF((p: any) => ({ ...p, [key]: val }));

  const inp = (key: string, label: string, type = 'text') => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</label>
      <input className="input text-xs" type={type} value={f[key] || ''} onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const sel = (key: string, label: string, opts: string[]) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</label>
      <select className="input text-xs" value={f[key] || ''} onChange={(e) => set(key, e.target.value)}>
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const chk = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input type="checkbox" checked={!!f[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}
    </label>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await api.post('/public/survey', f);
      setDone(true);
    } catch {
      toast.error('Error al enviar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-slate-800">¡Registro completado!</h2>
          <p className="text-slate-500 text-sm">Tu información ha sido registrada correctamente. El personal médico la tendrá disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-slate-800">Cuestionario de salud</h1>
          <p className="text-slate-500 text-sm mt-1">Por favor completa todos los datos antes de tu examen médico.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* INFO GENERAL */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Información general</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-slate-500">Empresa</label>
                <select className="input text-xs" value={f.empresa || ''} onChange={(e) => set('empresa', e.target.value)}>
                  <option value="">— Selecciona empresa —</option>
                  {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {sel('tipoExamen', 'Tipo de examen', ['Ingreso','Periódico','Egreso','Otro'])}
              {f.tipoExamen === 'Otro' && inp('otroTipo', 'Especifique')}
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-slate-500">Actividades realizadas</label>
                <input className="input text-xs" value={f.actividades || ''} onChange={(e) => set('actividades', e.target.value)} />
              </div>
            </div>
          </div>

          {/* DATOS PERSONALES */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Datos personales</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-3 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-slate-500">Nombre completo <span className="text-red-500">*</span></label>
                <input className="input text-xs" required value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
              </div>
              {inp('edad', 'Edad', 'number')}
              {inp('tipoSangre', 'Tipo de sangre')}
              {inp('puestoDeTrabajo', 'Puesto de trabajo')}
              {inp('celular', 'Celular')}
              {inp('nss', 'NSS')}
              {inp('fechaNacimiento', 'Fecha de nacimiento', 'date')}
              {sel('escolaridad', 'Escolaridad', ['Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Posgrado'])}
              {sel('estadoCivil', 'Estado civil', ['Soltero(a)','Casado(a)','Unión libre','Divorciado(a)','Viudo(a)'])}
              {inp('lugarNacimiento', 'Lugar de nacimiento')}
              {inp('correo', 'Correo electrónico', 'email')}
            </div>
          </div>

          {/* DOMICILIO */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Domicilio</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {inp('calle','Calle')} {inp('numero','Número')} {inp('colonia','Colonia')}
              {inp('municipio','Municipio / Estado')} {inp('cp','CP')}
            </div>
          </div>

          {/* HÁBITOS */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Hábitos</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {chk('practicaDeporte','Practica deporte')}
              {f.practicaDeporte && <>{inp('cualDeporte','¿Cuál deporte?')}{inp('horasDeporte','Horas/semana')}</>}
              {sel('habitosAlimenticios','Hábitos alimenticios',['Bueno','Regular','Malo'])}
              {sel('calidadSueno','Calidad de sueño',['Bueno','Malo'])}
              {f.calidadSueno === 'Malo' && inp('especifiqueSueno','Especifique')}
            </div>
          </div>

          {/* CONSUMO */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Hábitos de consumo</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sel('fuma','Tabaquismo',['NO','SI','EXFUMADOR'])}
              {(f.fuma === 'SI' || f.fuma === 'EXFUMADOR') && <>
                {inp('edadInicioFuma','Edad inicio')} {inp('anosFumando','Años fumando')} {inp('cigarrosDia','Cigarros/día')}
              </>}
              {chk('consumeAlcohol','Consume alcohol')}
              {f.consumeAlcohol && <>
                {inp('tipoBebida','Tipo de bebida')} {inp('cantidadBebidas','Cantidad')}
                {sel('frecuenciaAlcohol','Frecuencia',['Todos los días','Cada fin de semana','Cada 15 días','Cada mes','1 o 2 veces al año'])}
              </>}
              {sel('consumeDrogas','Drogas',['NO_NUNCA','SI_CONSUMO','CONSUMI'])}
              {f.consumeDrogas !== 'NO_NUNCA' && <>
                {inp('cualDroga','¿Cuál?')} {inp('frecuenciaDroga','Frecuencia')}
                {inp('tiempoDroga','Tiempo')} {inp('ultimaVezDroga','Última vez')}
              </>}
            </div>
          </div>

          {/* VACUNACIÓN */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Vacunación y otros</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {chk('esquemaVacunacion','Esquema de vacunación completo')}
              {inp('dosisAnticovid','Dosis anticovid')} {inp('marcaVacuna','Marca vacuna')}
              {chk('tieneTatuajes','Tiene tatuajes')}
              {f.tieneTatuajes && inp('ultimoTatuaje','Último tatuaje')}
              {chk('usaAudifonos','Usa audífonos')}
            </div>
          </div>

          {/* ANTECEDENTES FAMILIARES */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Antecedentes familiares</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {f.antecedentesFamiliares.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs w-32 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={!!a.si} onChange={(e) => {
                      const arr = [...f.antecedentesFamiliares]; arr[i] = { ...arr[i], si: e.target.checked };
                      set('antecedentesFamiliares', arr);
                    }} /> {a.enfermedad}
                  </label>
                  {a.si && <input className="input text-xs" placeholder="¿Quién?" value={a.quien || ''} onChange={(e) => {
                    const arr = [...f.antecedentesFamiliares]; arr[i] = { ...arr[i], quien: e.target.value };
                    set('antecedentesFamiliares', arr);
                  }} />}
                </div>
              ))}
            </div>
          </div>

          {/* ANTECEDENTES PATOLÓGICOS */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Antecedentes patológicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {f.antecedentesPatologicos.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs w-32 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={!!a.si} onChange={(e) => {
                      const arr = [...f.antecedentesPatologicos]; arr[i] = { ...arr[i], si: e.target.checked };
                      set('antecedentesPatologicos', arr);
                    }} /> {a.condicion}
                  </label>
                  {a.si && <input className="input text-xs" placeholder="Especifique" value={a.especifique || ''} onChange={(e) => {
                    const arr = [...f.antecedentesPatologicos]; arr[i] = { ...arr[i], especifique: e.target.value };
                    set('antecedentesPatologicos', arr);
                  }} />}
                </div>
              ))}
            </div>
          </div>

          {/* LABORAL */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600">Antecedentes laborales</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {inp('edadInicioLaboral','Edad inicio laboral')} {inp('trabajoMinas','Trabajo en minas')}
            </div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Exposiciones</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {(['ruidos','polvos','vapores','humos','riesgoElectrico','usaEpp'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!(f.exposiciones || {})[k]} onChange={(e) => set('exposiciones', { ...(f.exposiciones || {}), [k]: e.target.checked })} />
                  {k === 'ruidos' ? 'Ruidos fuertes' : k === 'polvos' ? 'Polvos' : k === 'vapores' ? 'Vapores' : k === 'humos' ? 'Humos' : k === 'riesgoElectrico' ? 'Riesgo eléctrico' : 'Usa EPP'}
                </label>
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Historial de empleos</p>
            {f.historialEmpleos.map((e: any, i: number) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {(['empresa','cargo','tiempo','exponentes'] as const).map((k) => (
                  <input key={k} className="input text-xs" placeholder={k.charAt(0).toUpperCase()+k.slice(1)} value={e[k]||''} onChange={(ev) => {
                    const arr = [...f.historialEmpleos]; arr[i] = { ...arr[i], [k]: ev.target.value };
                    set('historialEmpleos', arr);
                  }} />
                ))}
              </div>
            ))}
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => set('historialEmpleos', [...f.historialEmpleos, { empresa:'',cargo:'',tiempo:'',exponentes:'' }])}>
              + Agregar empleo
            </button>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl text-white font-bold text-sm transition" style={{ background: '#3375c8' }}>
            {saving ? 'Enviando…' : 'Enviar cuestionario'}
          </button>
        </form>
      </div>
    </div>
  );
}
