// Registro público de PACIENTE (correo + contraseña + nombre) con captcha.
// Tras registrarse, el usuario debe verificar su correo antes de entrar.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';
import { TurnstileWidget, TURNSTILE_SITE_KEY } from '../../components/TurnstileWidget';
import SocialLoginButtons from '../../components/SocialLoginButtons';

const Icon = ({ name, style, className }: any) => <span className={`material-symbols-rounded ${className || ''}`} style={style}>{name}</span>;

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
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

  // ── Pantalla de éxito ──────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-10 max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 text-4xl">📧</div>
          <h2 className="text-2xl font-extrabold text-slate-900">{devLink ? 'Verifica tu cuenta' : 'Revisa tu correo'}</h2>
          {devLink ? (
            <>
              <p className="text-slate-500 text-sm">El envío de correo no está configurado. Abre este enlace para verificar tu cuenta:</p>
              <a href={devLink} className="block w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold mt-1 transition">Verificar mi cuenta ahora</a>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Te enviamos un enlace para verificar tu cuenta. Ábrelo para activarla y luego inicia sesión.</p>
          )}
          <button onClick={() => nav('/login')} className="mt-2 w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">Ir a iniciar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Panel de marca (izquierda, oculto en móvil) — blanco ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 bg-white border-r border-slate-200">
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

      {/* ── Formulario (derecha) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          {/* Logo compacto en móvil */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={logo} alt="MediWork" className="w-16 h-16 object-contain drop-shadow" />
            <h1 className="text-2xl font-extrabold text-[#2560aa] mt-2 tracking-tight">MediWork</h1>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900">Crear cuenta</h2>
              <p className="text-sm text-slate-500 mt-1">Portal del paciente</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre completo</label>
                <div className="relative">
                  <Icon name="person" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                  <input
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                    style={{ paddingLeft: 48, height: 52 }}
                    placeholder="Ej. Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} autoComplete="name" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Icon name="mail" className="text-slate-400" style={{ position: 'absolute', left: 16, top: 15, fontSize: 20 }} />
                  <input
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent focus:bg-white transition-all text-sm font-medium"
                    style={{ paddingLeft: 48, height: 52 }}
                    type="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contraseña</label>
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

              <TurnstileWidget onToken={setCaptcha} />

              <button
                className="w-full flex items-center justify-center gap-2 shadow-lg shadow-[#2560aa]/25 rounded-2xl text-white text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                style={{ height: 54, background: 'linear-gradient(135deg, #2560aa, #3a86c8)' }}
                disabled={loading}>
                {loading ? 'Creando…' : <>Registrarme <Icon name="arrow_forward" style={{ fontSize: 20 }} /></>}
              </button>
            </form>

            {/* Registro con Google/Microsoft: el mismo flujo crea la cuenta PACIENTE
                automáticamente si el correo no existe. Solo aparece si está configurado. */}
            <SocialLoginButtons label="regístrate con" />

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿Ya tienes cuenta? <Link to="/login" className="text-[#2560aa] font-bold hover:underline">Inicia sesión</Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400 font-medium">© 2026 MediWork Intelligence Systems</div>
        </div>
      </div>
    </div>
  );
}
