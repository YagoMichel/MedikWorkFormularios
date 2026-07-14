// Registro público de PACIENTE (correo + contraseña + nombre) con captcha.
// Tras registrarse, el usuario debe verificar su correo antes de entrar.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';
import { TurnstileWidget, TURNSTILE_SITE_KEY } from '../../components/TurnstileWidget';
import SocialLoginButtons from '../../components/SocialLoginButtons';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (TURNSTILE_SITE_KEY && !captcha) { toast.error('Completa la verificación de seguridad'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', { fullName, email, password, turnstileToken: captcha || undefined });
      // Sin correo configurado, el backend devuelve el enlace para mostrarlo aquí.
      if (data?.verificationLink) setDevLink(data.verificationLink);
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo completar el registro');
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md text-center space-y-4 border border-gray-100">
          <div className="text-5xl">📧</div>
          <h2 className="text-2xl font-extrabold text-slate-800">{devLink ? 'Verifica tu cuenta' : 'Revisa tu correo'}</h2>
          {devLink ? (
            <>
              <p className="text-slate-500 text-sm">El envío de correo no está configurado. Abre este enlace para verificar tu cuenta:</p>
              <a href={devLink} className="block w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold mt-1">Verificar mi cuenta ahora</a>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Te enviamos un enlace para verificar tu cuenta. Ábrelo para activarla y luego inicia sesión.</p>
          )}
          <button onClick={() => nav('/login')} className="mt-2 w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold">Ir a iniciar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MediWork" className="w-20 h-20 object-contain" />
          <h1 className="text-2xl font-extrabold text-[#2560aa] mt-2">Crear cuenta</h1>
          <p className="text-slate-400 text-sm">Portal del paciente</p>
        </div>
        <div className="w-full rounded-3xl p-8 sm:p-10 shadow-2xl bg-white border border-gray-100">
          <form onSubmit={submit} className="space-y-4">
            <input className="input w-full" placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} />
            <input className="input w-full" type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input w-full" type="password" placeholder="Contraseña (mínimo 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <TurnstileWidget onToken={setCaptcha} />
            <button className="w-full py-3.5 rounded-2xl bg-[#2560aa] text-white text-lg font-bold hover:bg-[#1c4b85] transition disabled:opacity-60" disabled={loading}>
              {loading ? 'Creando...' : 'Registrarme'}
            </button>
          </form>

          {/* Registro con Google/Microsoft: el mismo flujo crea la cuenta PACIENTE
              automáticamente si el correo no existe (sin verificación de correo,
              porque el proveedor ya lo confirma). Solo aparece si está configurado. */}
          <SocialLoginButtons label="regístrate con" />

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta? <Link to="/login" className="text-[#2560aa] font-bold">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
