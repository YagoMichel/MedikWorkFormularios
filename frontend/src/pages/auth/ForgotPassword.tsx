// Solicitud de restablecimiento de contraseña: el usuario pone su correo y, si
// existe una cuenta, se le envía un enlace. La respuesta es siempre neutra para
// no revelar qué correos están registrados.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import logo from '../../assets/logo.png';
import { TurnstileWidget, TURNSTILE_SITE_KEY } from '../../components/TurnstileWidget';

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
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="MediWork" className="w-20 h-20 object-contain" />
          <h1 className="text-2xl font-extrabold text-[#2560aa] mt-2">Recuperar contraseña</h1>
          <p className="text-slate-400 text-sm">Te enviaremos un enlace por correo</p>
        </div>
        <div className="w-full rounded-3xl p-8 sm:p-10 shadow-2xl bg-white border border-gray-100">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-5xl">📧</div>
              <p className="text-slate-600 text-sm">
                Si el correo <b>{email}</b> tiene una cuenta, te enviamos un enlace para
                restablecer tu contraseña. Revisa tu bandeja (y spam).
              </p>
              {devLink && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                  <p className="text-[11px] font-bold text-amber-700 mb-1">Modo desarrollo (sin correo configurado):</p>
                  <a href={devLink} className="text-xs text-[#2560aa] break-all hover:underline">{devLink}</a>
                </div>
              )}
              <a href="/login" className="inline-block mt-2 text-[#2560aa] font-bold text-sm hover:underline">Volver a iniciar sesión</a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input className="input w-full" type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <TurnstileWidget onToken={setCaptcha} />
              <button className="w-full py-3.5 rounded-2xl bg-[#2560aa] text-white text-lg font-bold hover:bg-[#1c4b85] transition disabled:opacity-60" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
              <div className="text-center">
                <a href="/login" className="text-slate-500 text-sm hover:underline">Volver a iniciar sesión</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
