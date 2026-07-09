import { useState } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface Props { patientId: string; onClose: () => void; onSaved: () => void; }

const empty = {
  odSph: '', odCyl: '', odAxis: '', odAdd: '',
  oiSph: '', oiCyl: '', oiAxis: '', oiAdd: '',
  dpOd: '', dpOi: '', dpBin: '',
  type: 'LEJOS', diagnosis: '', recommendations: '',
};

export default function PrescriptionForm({ patientId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = { patientId, type: form.type, diagnosis: form.diagnosis || null, recommendations: form.recommendations || null };
      ['odSph', 'odCyl', 'odAxis', 'odAdd', 'oiSph', 'oiCyl', 'oiAxis', 'oiAdd', 'dpOd', 'dpOi', 'dpBin'].forEach((k) => {
        if (form[k] !== '' && form[k] !== null && form[k] !== undefined) body[k] = parseFloat(form[k]);
      });
      await api.post('/prescriptions', body);
      toast.success('Receta guardada');
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl my-8">
        <h2 className="text-lg font-bold mb-4">Nueva Receta Visual</h2>

        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-5 gap-2 text-xs font-medium text-slate-600">
            <span></span><span>SPH</span><span>CYL</span><span>EJE</span><span>ADD</span>
          </div>
          {[['OD', 'od'], ['OI', 'oi']].map(([label, p]) => (
            <div key={p} className="grid grid-cols-5 gap-2 items-center">
              <span className="font-semibold">{label}</span>
              {['Sph', 'Cyl', 'Axis', 'Add'].map((f) => (
                <input key={f} className="input" type="number" step="0.25" value={form[`${p}${f}`]} onChange={(e) => set(`${p}${f}`, e.target.value)} />
              ))}
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="DP OD" type="number" value={form.dpOd} onChange={(e) => set('dpOd', e.target.value)} />
            <input className="input" placeholder="DP OI" type="number" value={form.dpOi} onChange={(e) => set('dpOi', e.target.value)} />
            <input className="input" placeholder="DP Binocular" type="number" value={form.dpBin} onChange={(e) => set('dpBin', e.target.value)} />
          </div>

          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="LEJOS">Monofocal · visión lejana</option>
            <option value="CERCA">Monofocal · visión próxima</option>
            <option value="BIFOCAL">Bifocal</option>
            <option value="PROGRESIVO">Multifocal progresivo</option>
          </select>

          <textarea className="input" rows={2} placeholder="Diagnóstico" value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />
          <textarea className="input" rows={2} placeholder="Recomendaciones" value={form.recommendations} onChange={(e) => set('recommendations', e.target.value)} />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar receta'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
