import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

const Icon = ({ name, style }: any) => <span className="material-symbols-rounded" style={style}>{name}</span>;

export default function Login() {
  const [email, setEmail] = useState('admin@clinica.com');
  const [password, setPassword] = useState('Admin1234!');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.token, data.user);
      toast.success(`Bienvenido, ${data.user.fullName}`);
      nav('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-5"
      style={{ background: 'radial-gradient(circle at top left, #51abcd, #2560aa)' }}>
      <div className="login-card w-full max-w-md rounded-3xl p-12 shadow-2xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src={logo} alt="MediWork Logo" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-primary-600">MediWork</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-secondary block mb-1.5">Usuario</label>
            <div className="relative">
              <Icon name="person" style={{ position: 'absolute', left: 12, top: 11, fontSize: 20, color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-secondary block mb-1.5">Contraseña</label>
            <div className="relative">
              <Icon name="lock" style={{ position: 'absolute', left: 12, top: 11, fontSize: 20, color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 40 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-primary w-full" style={{ height: 50 }} disabled={loading}>
            {loading ? 'Ingresando...' : <>Iniciar sesión <Icon name="login" style={{ marginLeft: 4 }} /></>}
          </button>
        </form>
        <div className="mt-6 border-t login-divider pt-4">
          <p className="text-xs font-medium text-ink-secondary text-center mb-2">Cuentas demo</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEmail('admin@clinica.com'); setPassword('Admin1234!'); }}
              className="login-demo-btn flex-1 text-xs py-2 px-3 rounded-xl border hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition font-medium">
              Administrador
            </button>
            <button type="button" onClick={() => { setEmail('doctor1@clinica.com'); setPassword('Doctor1234!'); }}
              className="login-demo-btn flex-1 text-xs py-2 px-3 rounded-xl border hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition font-medium">
              Doctor
            </button>
            <button type="button" onClick={() => { setEmail('paciente@clinica.com'); setPassword('Paciente1234!'); }}
              className="login-demo-btn flex-1 text-xs py-2 px-3 rounded-xl border hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition font-medium">
              Tablet
            </button>
          </div>
        </div>
      </div>
      <div className="mt-8 text-white/60 text-xs">© 2026 MediWork Intelligence Systems</div>
    </div>
  );
}
