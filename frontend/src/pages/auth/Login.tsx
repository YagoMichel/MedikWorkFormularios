import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { TurnstileWidget, TURNSTILE_SITE_KEY } from '../../components/TurnstileWidget';
import SocialLoginButtons from '../../components/SocialLoginButtons';

const Icon = ({ name, style, className }: any) => <span className={`material-symbols-rounded ${className || ''}`} style={style}>{name}</span>;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const setAuth = useAuth((s) => s.setAuth);
  const nav = useNavigate();

  // Mensajes de error del login social (el backend redirige con ?error=...).
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error');
    if (!err) return;
    const msgs: Record<string, string> = {
      oauth_staff: 'Esa cuenta es de personal interno: inicia sesión con tu contraseña.',
      oauth_inactive: 'Tu cuenta está inactiva. Contacta a la clínica.',
      oauth_email: 'No pudimos verificar tu correo con el proveedor.',
      oauth_state: 'La sesión expiró, intenta de nuevo.',
      oauth_failed: 'No se pudo iniciar sesión con el proveedor. Intenta de nuevo.',
    };
    toast.error(msgs[err] || 'No se pudo iniciar sesión.');
    window.history.replaceState(null, '', '/login');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captcha) { toast.error('Completa la verificación de seguridad'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, turnstileToken: captcha || undefined });
      setAuth(data.token, data.user);
      nav('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Panel de marca (izquierda, oculto en móvil) — blanco ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 bg-white border-r border-slate-200">
        {/* Halos decorativos muy sutiles en tono de marca */}
        <div className="absolute -top-28 -left-24 w-96 h-96 rounded-full bg-[#51abcd]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-[30rem] h-[30rem] rounded-full bg-[#2560aa]/5 blur-3xl" />

        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-[2rem] bg-slate-50 mb-7 shadow-lg ring-1 ring-slate-100">
            <img src={logo} alt="MediWork" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-[#2560aa]">MediWork</h1>
          <p className="mt-3 text-lg font-semibold text-[#51abcd] tracking-wide">Intelligence Systems</p>
        </div>
      </div>

      {/* ── Formulario (derecha) — tono un poco más oscuro ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          {/* Logo compacto en móvil */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={logo} alt="MediWork" className="w-20 h-20 object-contain drop-shadow" />
            <h1 className="text-2xl font-extrabold text-[#2560aa] mt-2 tracking-tight">MediWork</h1>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900">Bienvenido de nuevo</h2>
              <p className="text-sm text-slate-500 mt-1">Inicia sesión para continuar</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Icon name="mail" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                  <input
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                    style={{ paddingLeft: 48, height: 52 }}
                    type="email" placeholder="tucorreo@ejemplo.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contraseña</label>
                <div className="relative">
                  <Icon name="lock" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                  <input
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                    style={{ paddingLeft: 48, paddingRight: 48, height: 52 }}
                    type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                    title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    <Icon name={showPass ? 'visibility_off' : 'visibility'} style={{ fontSize: 20 }} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a href="/recuperar" className="text-sm text-[#2560aa] font-semibold hover:underline">¿Olvidaste tu contraseña?</a>
              </div>

              <TurnstileWidget onToken={setCaptcha} />

              <button
                className="w-full flex items-center justify-center gap-2 shadow-lg shadow-[#2560aa]/25 rounded-2xl text-white text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                style={{ height: 54, background: 'linear-gradient(135deg, #2560aa, #3a86c8)' }}
                disabled={loading}>
                {loading ? 'Ingresando…' : <>Entrar <Icon name="arrow_forward" style={{ fontSize: 20 }} /></>}
              </button>
            </form>

            {/* Botones de inicio de sesión social — solo aparecen si Google/Microsoft
                están configurados en el backend (config-gated). */}
            <SocialLoginButtons />

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿Eres paciente y no tienes cuenta?{' '}
                <a href="/signup" className="text-[#2560aa] font-bold hover:underline">Regístrate</a>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400 font-medium">© 2026 MediWork Intelligence Systems</div>
        </div>
      </div>
    </div>
  );
}
