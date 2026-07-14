// Verificación de correo del paciente: toma ?token= del enlace del correo
// y lo confirma contra el backend.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function VerifyEmail() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const nav = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setState('error'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md text-center space-y-4 border border-gray-100">
        {state === 'loading' && <><div className="text-4xl">⏳</div><p className="text-slate-500">Verificando tu correo…</p></>}
        {state === 'ok' && <>
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-extrabold text-slate-800">Correo verificado</h2>
          <p className="text-slate-500 text-sm">Tu cuenta quedó activa. Ya puedes iniciar sesión.</p>
          <button onClick={() => nav('/login')} className="mt-2 w-full py-3 rounded-2xl bg-[#2560aa] text-white font-bold">Iniciar sesión</button>
        </>}
        {state === 'error' && <>
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-extrabold text-slate-800">Enlace inválido</h2>
          <p className="text-slate-500 text-sm">El enlace es incorrecto o ya caducó. Regístrate de nuevo para recibir otro.</p>
          <button onClick={() => nav('/signup')} className="mt-2 w-full py-3 rounded-2xl bg-[#2560aa] text-white font-bold">Volver al registro</button>
        </>}
      </div>
    </div>
  );
}
