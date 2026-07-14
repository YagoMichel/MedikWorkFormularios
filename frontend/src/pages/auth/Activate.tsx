// Activación de cuenta de EMPRESA: con el ?token= del correo, la empresa
// define su contraseña por primera vez.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';

export default function Activate() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await api.post('/auth/activate', { token, password });
      toast.success('Cuenta activada. Ya puedes iniciar sesión.');
      nav('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo activar la cuenta');
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md text-center space-y-3 border border-gray-100">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-extrabold text-slate-800">Enlace inválido</h2>
          <p className="text-slate-500 text-sm">Falta el token de activación. Pide a la clínica un enlace nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MediWork" className="w-20 h-20 object-contain" />
          <h1 className="text-2xl font-extrabold text-[#2560aa] mt-2">Activar cuenta de empresa</h1>
          <p className="text-slate-400 text-sm">Define tu contraseña para empezar</p>
        </div>
        <div className="w-full rounded-3xl p-8 sm:p-10 shadow-2xl bg-white border border-gray-100">
          <form onSubmit={submit} className="space-y-4">
            <input className="input w-full" type="password" placeholder="Nueva contraseña (mínimo 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <input className="input w-full" type="password" placeholder="Repite la contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
            <button className="w-full py-3.5 rounded-2xl bg-[#2560aa] text-white text-lg font-bold hover:bg-[#1c4b85] transition disabled:opacity-60" disabled={loading}>
              {loading ? 'Activando...' : 'Activar cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
