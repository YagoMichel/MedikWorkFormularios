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

      nav('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row items-center justify-center md:justify-around p-5 md:px-10 lg:px-32 bg-slate-50">

      <div className="hidden md:flex flex-col items-center justify-center">
        <div className="mb-6">
          <img src={logo} alt="MediWork Logo" className="w-40 h-40 object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-5xl font-extrabold text-[#2560aa] tracking-tight">MediWork</h1>
        <p className="text-[#51abcd] mt-3 text-lg font-bold tracking-wide">Intelligence Systems</p>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        <div className="w-full rounded-3xl p-10 sm:p-12 shadow-2xl bg-white border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-[#0f172a]">Iniciar sesión</h2>
          </div>

          <div className="flex justify-between gap-3 mb-8">
            <button type="button" onClick={() => { setEmail('admin@clinica.com'); setPassword('Admin1234!'); }}
              className="flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border-2 border-slate-100 hover:border-[#51abcd] hover:bg-slate-50 text-slate-400 hover:text-[#2560aa] transition-all group">
              <Icon name="grid_view" style={{ fontSize: 26, marginBottom: 8 }} />
              <span className="text-[10px] font-bold tracking-wider">ADMIN</span>
            </button>
            <button type="button" onClick={() => { setEmail('doctor1@clinica.com'); setPassword('Doctor1234!'); }}
              className="flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border-2 border-slate-100 hover:border-[#51abcd] hover:bg-slate-50 text-slate-400 hover:text-[#2560aa] transition-all group">
              <Icon name="group" style={{ fontSize: 26, marginBottom: 8 }} />
              <span className="text-[10px] font-bold tracking-wider">DOCTOR</span>
            </button>
            <button type="button" onClick={() => { setEmail('paciente@clinica.com'); setPassword('Paciente1234!'); }}
              className="flex-1 flex flex-col items-center justify-center py-4 rounded-2xl border-2 border-slate-100 hover:border-[#51abcd] hover:bg-slate-50 text-slate-400 hover:text-[#2560aa] transition-all group">
              <Icon name="tablet_mac" style={{ fontSize: 26, marginBottom: 8 }} />
              <span className="text-[10px] font-bold tracking-wider">TABLET</span>
            </button>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <div className="relative">
                <Icon name="mail" style={{ position: 'absolute', left: 16, top: 15, fontSize: 22 }} className="text-slate-400" />
                <input className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent transition-all text-sm font-medium" style={{ paddingLeft: 50, height: 52 }} type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <div className="relative">
                <Icon name="lock" style={{ position: 'absolute', left: 16, top: 15, fontSize: 22 }} className="text-slate-400" />
                <input className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#51abcd] focus:border-transparent transition-all text-sm font-medium" style={{ paddingLeft: 50, height: 52 }} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <div className="pt-4">
              <button className="w-full shadow-lg shadow-[#2560aa]/30 rounded-2xl bg-[#2560aa] text-white text-lg font-bold transition-all hover:scale-[1.02] hover:bg-[#1c4b85]" style={{ height: 54 }} disabled={loading}>
                {loading ? 'Ingresando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center px-4">
          </div>
        </div>
        <div className="mt-8 text-slate-400 font-medium text-xs w-full text-center">© 2026 MediWork Intelligence Systems</div>
      </div>
    </div>
  );
}
