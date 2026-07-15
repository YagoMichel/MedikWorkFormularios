// Solicitud de restablecimiento de contraseña: el usuario pone su correo y, si
// existe una cuenta, se le envía un enlace. La respuesta es siempre neutra para
// no revelar qué correos están registrados.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';
import { TurnstileWidget, TURNSTILE_SITE_KEY } from '../../components/TurnstileWidget';

const Icon = ({ name, style, className }: any) => <span className={`material-symbols-rounded ${className || ''}`} style={style}>{name}</span>;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captcha) { toast.error('Completa la verificación de seguridad'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email, turnstileToken: captcha || undefined });
      setSent(true);
      // En dev (sin SMTP) el backend devuelve el enlace para mostrarlo aquí.
      if (data?.resetLink) setDevLink(data.resetLink);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo procesar la solicitud');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="MediWork" className="w-16 h-16 object-contain drop-shadow" />
          <h1 className="text-xl font-extrabold text-[#2560aa] mt-2 tracking-tight">MediWork</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 text-4xl">📧</div>
              <h2 className="text-2xl font-extrabold text-slate-900">Revisa tu correo</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Si el correo <b className="text-slate-700">{email}</b> tiene una cuenta, te enviamos un enlace para
                restablecer tu contraseña. Revisa tu bandeja (y la carpeta de spam).
              </p>
              {devLink && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                  <p className="text-[11px] font-bold text-amber-700 mb-1">Modo desarrollo (sin correo configurado):</p>
                  <a href={devLink} className="text-xs text-[#2560aa] break-all hover:underline">{devLink}</a>
                </div>
              )}
              <Link to="/login" className="inline-flex items-center gap-1 mt-2 text-[#2560aa] font-bold text-sm hover:underline">
                <Icon name="arrow_back" style={{ fontSize: 18 }} /> Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-[#2560aa] mb-4">
                  <Icon name="lock_reset" style={{ fontSize: 32 }} />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900">Recuperar contraseña</h2>
                <p className="text-sm text-slate-500 mt-1">Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
              </div>

              <form onSubmit={submit} className="space-y-5">
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

                <TurnstileWidget onToken={setCaptcha} />

                <button
                  className="w-full flex items-center justify-center gap-2 shadow-lg shadow-[#2560aa]/25 rounded-2xl text-white text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                  style={{ height: 54, background: 'linear-gradient(135deg, #2560aa, #3a86c8)' }}
                  disabled={loading}>
                  {loading ? 'Enviando…' : <>Enviar enlace <Icon name="send" style={{ fontSize: 19 }} /></>}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#2560aa] transition">
                  <Icon name="arrow_back" style={{ fontSize: 18 }} /> Volver a iniciar sesión
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 font-medium">© 2026 MediWork Intelligence Systems</div>
      </div>
    </div>
  );
}
