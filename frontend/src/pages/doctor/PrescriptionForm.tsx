import { useState } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { Camera, Loader2 } from 'lucide-react';

interface Props { patientId: string; onClose: () => void; onSaved: () => void; }

const empty = {
  odSph: '', odCyl: '', odAxis: '', odAdd: '',
  oiSph: '', oiCyl: '', oiAxis: '', oiAdd: '',
  dpOd: '', dpOi: '', dpBin: '',
  type: 'LEJOS', diagnosis: '', recommendations: '',
};

export default function PrescriptionForm({ patientId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const onScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMessage('Procesando imagen con IA...');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/prescriptions/ocr', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const ex = data.extracted || {};
      setImageUrl(data.imageUrl);
      const merged: any = { ...empty };
      Object.keys(empty).forEach((k) => {
        if (ex[k] !== undefined && ex[k] !== null) merged[k] = String(ex[k]);
      });
      if (ex.diagnosis) merged.diagnosis = ex.diagnosis;
      setForm({ ...form, ...merged });
      setScanMessage(ex._note || 'Revisa los valores extraídos antes de guardar');
      toast.success('Imagen procesada');
    } catch (err) {
      toast.error('No se pudo procesar la imagen');
      setScanMessage(null);
    } finally {
      setScanning(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = { patientId, type: form.type, diagnosis: form.diagnosis || null, recommendations: form.recommendations || null, imageUrl };
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

        <div className="mb-4 p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <label className="cursor-pointer flex items-center justify-center gap-2 text-sm text-blue-700 font-medium">
            {scanning ? <><Loader2 className="animate-spin" size={18} /> Procesando...</> : <><Camera size={18} /> Escanear receta con IA (OCR)</>}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onScan} disabled={scanning} />
          </label>
          {scanMessage && <p className="text-xs text-center mt-2 text-blue-700">{scanMessage}</p>}
        </div>

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
