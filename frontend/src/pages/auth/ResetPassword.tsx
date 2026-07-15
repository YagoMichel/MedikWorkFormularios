// Restablecer contraseña: con el ?token= del correo, el usuario define una
// contraseña nueva. Calca el flujo de Activate.tsx.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';

const Icon = ({ name, style, className }: any) => <span className={`material-symbols-rounded ${className || ''}`} style={style}>{name}</span>;

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      nav('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo restablecer la contraseña');
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-10 max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 text-4xl">⚠️</div>
          <h2 className="text-2xl font-extrabold text-slate-900">Enlace inválido</h2>
          <p className="text-slate-500 text-sm">Falta el token del enlace. Solicita uno nuevo desde «Recuperar contraseña».</p>
          <Link to="/recuperar" className="inline-flex items-center gap-1 text-[#2560aa] font-bold text-sm hover:underline">
            <Icon name="lock_reset" style={{ fontSize: 18 }} /> Solicitar enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="MediWork" className="w-16 h-16 object-contain drop-shadow" />
          <h1 className="text-xl font-extrabold text-[#2560aa] mt-2 tracking-tight">MediWork</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-[#2560aa] mb-4">
              <Icon name="password" style={{ fontSize: 32 }} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Nueva contraseña</h2>
            <p className="text-sm text-slate-500 mt-1">Define tu contraseña nueva para tu cuenta.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <Icon name="lock" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                <input
                  className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                  style={{ paddingLeft: 48, paddingRight: 48, height: 52 }}
                  type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                  title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <Icon name={showPass ? 'visibility_off' : 'visibility'} style={{ fontSize: 20 }} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Repite la contraseña</label>
              <div className="relative">
                <Icon name="lock" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                <input
                  className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                  style={{ paddingLeft: 48, height: 52 }}
                  type={showPass ? 'text' : 'password'} placeholder="Vuelve a escribirla" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 shadow-lg shadow-[#2560aa]/25 rounded-2xl text-white text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
              style={{ height: 54, background: 'linear-gradient(135deg, #2560aa, #3a86c8)' }}
              disabled={loading}>
              {loading ? 'Guardando…' : <>Restablecer contraseña <Icon name="check" style={{ fontSize: 20 }} /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#2560aa] transition">
              <Icon name="arrow_back" style={{ fontSize: 18 }} /> Volver a iniciar sesión
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 font-medium">© 2026 MediWork Intelligence Systems</div>
      </div>
    </div>
  );
}
