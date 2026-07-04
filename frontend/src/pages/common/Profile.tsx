// =============================================================
// ARCHIVO: src/pages/common/Profile.tsx
// DESCRIPCION: Pantalla de perfil del usuario activo (Doctor/Admin)
// =============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../stores/auth';
import { api } from '../../services/api';
import { Mail, User, Key, Camera, Save, X, Lock, Pencil, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, token, setAuth } = useAuth();

  // Real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Profile picture
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Edit Personal Info
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
  });

  // Change Password
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: ''
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append('photo', file);
      const { data } = await api.post('/auth/me/photo', body);
      if (token) setAuth(token, data);
      toast.success('Foto de perfil actualizada correctamente');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo subir la foto');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveInfo = async () => {
    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    setIsSavingInfo(true);
    try {
      const { data } = await api.put('/auth/me', {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
      });
      if (token) setAuth(token, data);
      setIsEditingInfo(false);
      toast.success('Información actualizada con éxito');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo actualizar la información');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleSavePassword = async () => {
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      toast.error('Completa todos los campos de contraseña');
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }
    if (passwords.newPass.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.put('/auth/me/password', {
        currentPassword: passwords.current,
        newPassword: passwords.newPass,
      });
      setIsChangingPassword(false);
      setPasswords({ current: '', newPass: '', confirm: '' });
      toast.success('Contraseña cambiada exitosamente');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto fade-in pb-12 px-4 sm:px-6">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#2560aa] to-[#51abcd] dark:from-slate-800 dark:to-slate-900 overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 mt-6">
        {/* Decorative waves / blur elements */}
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-[-10%] right-[10%] w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 flex flex-col-reverse md:flex-row items-center justify-between gap-8 p-8 md:p-10">

          {/* User Info & Actions */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 mt-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-1">
              Perfil de {user?.fullName || 'Usuario'}
            </h2>
            <p className="text-blue-200/80 text-sm mb-6 capitalize">
              {currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} • {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button
                onClick={() => setIsEditingInfo(true)}
                title="Editar perfil"
                aria-label="Editar perfil"
                className="w-11 h-11 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl transition-all flex items-center justify-center backdrop-blur-sm"
              >
                <Pencil size={18} />
              </button>
            </div>
          </div>

          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div
              className="w-32 h-32 md:w-36 md:h-36 rounded-full flex items-center justify-center text-4xl font-extrabold text-[#2560aa] shadow-lg overflow-hidden border-4 border-white bg-white transition-all duration-300"
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U'
              )}
            </div>

            {/* Quick Camera Button (bottom right of avatar) */}
            <label className={`absolute bottom-0 right-0 p-2.5 bg-[#51abcd] hover:bg-[#3d98ba] text-white rounded-full shadow-lg cursor-pointer transition-colors border-2 border-white ${isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
              <Camera size={18} />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                disabled={isUploadingPhoto}
                onChange={handlePhotoChange}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">

        {/* Personal Information */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 transition-all">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <User size={22} className="text-[#2b7bf5]" />
              Información Personal
            </h3>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Name */}
              <div className="group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre Completo
                </label>
                {isEditingInfo ? (
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b7bf5] transition-all"
                  />
                ) : (
                  <div className="font-semibold text-lg text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 rounded-xl border border-transparent">
                    {user?.fullName}
                  </div>
                )}
              </div>

              {/* Role (Read only) */}
              <div className="group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Rol de Sistema
                </label>
                <div className="font-semibold text-lg text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 rounded-xl border border-transparent cursor-not-allowed">
                  {user?.role}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="group">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              {isEditingInfo ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b7bf5] transition-all"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 font-semibold text-lg text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 rounded-xl border border-transparent">
                  <Mail size={18} className="text-[#2b7bf5]" />
                  {user?.email || 'No especificado'}
                </div>
              )}
            </div>

            {isEditingInfo && (
              <div className="pt-4 flex justify-end gap-3 animate-fade-in-up">
                <button
                  onClick={() => {
                    setIsEditingInfo(false);
                    setFormData({ fullName: user?.fullName || '', email: user?.email || '' });
                  }}
                  title="Cancelar"
                  aria-label="Cancelar"
                  className="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleSaveInfo}
                  disabled={isSavingInfo}
                  title={isSavingInfo ? 'Guardando...' : 'Guardar cambios'}
                  aria-label="Guardar cambios"
                  className="w-11 h-11 flex items-center justify-center bg-[#2b7bf5] hover:bg-[#1f66d3] text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Save size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 transition-all">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Key size={22} className="text-[#4c3ce6]" />
              Seguridad
            </h3>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                title="Cambiar contraseña"
                aria-label="Cambiar contraseña"
                className="w-11 h-11 flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-[#4c3ce6] text-slate-700 dark:text-slate-200 rounded-xl transition-all"
              >
                <Lock size={18} />
              </button>
            )}
          </div>

          {!isChangingPassword ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Asegúrate de utilizar una contraseña segura y actualizarla regularmente para proteger el acceso al sistema.
            </p>
          ) : (
            <div className="space-y-4 animate-fade-in-up pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4c3ce6] transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={passwords.newPass}
                    onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4c3ce6] transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Confirmar Contraseña
                  </label>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4c3ce6] transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswords({ current: '', newPass: '', confirm: '' });
                  }}
                  title="Cancelar"
                  aria-label="Cancelar"
                  className="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleSavePassword}
                  disabled={isSavingPassword}
                  title={isSavingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                  aria-label="Actualizar contraseña"
                  className="w-11 h-11 flex items-center justify-center bg-[#4c3ce6] hover:bg-[#3d30b8] text-white rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-105 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <Check size={18} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

