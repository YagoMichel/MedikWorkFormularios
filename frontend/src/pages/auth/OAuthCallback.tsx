// Página de retorno del login social. El backend redirige aquí con el token en
// el fragmento (#token=...). Se lee, se trae el usuario y se arranca la sesión.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';

export default function OAuthCallback() {
  const nav = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const token = new URLSearchParams(hash).get('token');
    if (!token) { toast.error('No se recibió la sesión'); nav('/login'); return; }

    (async () => {
      try {
        const { data: user } = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        setAuth(token, user);
        // Borra el token del fragmento de la URL (que no quede en el historial).
        window.history.replaceState(null, '', '/');
        nav('/');
      } catch {
        toast.error('No se pudo completar el inicio de sesión');
        nav('/login');
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
      <p className="text-slate-500 text-sm">Iniciando sesión…</p>
    </div>
  );
}
