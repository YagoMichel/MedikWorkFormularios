// =============================================================
// ARCHIVO: src/stores/auth.ts
// DESCRIPCION: Estado global de autenticacion (Zustand).
//              Guarda el usuario y token en localStorage
//              para que la sesion persista al recargar.
//
// ROLES DISPONIBLES:
//   MASTER  → todo lo de ADMIN + gestión de cuentas ADMIN/MASTER
//   ADMIN   → acceso completo (compañero)
//   DOCTOR  → agenda, pacientes, recetas (tu)
//   PACIENTE→ solo encuesta tablet (tu)
//
// USO: const { user, logout } = useAuth();
// =============================================================

import { create } from 'zustand';

export type Role = 'ADMIN' | 'DOCTOR' | 'PACIENTE' | 'AGENT' | 'MASTER';

// MASTER tiene todo el acceso de ADMIN (y más) — usar este helper en vez de
// comparar contra 'ADMIN' directamente para que MASTER no quede excluido.
export const isAdminRole = (role?: Role | null) => role === 'ADMIN' || role === 'MASTER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  photoUrl?: string | null;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

// Recupera sesion guardada al recargar la pagina. Si el valor guardado esta
// corrupto (sesion vieja de una version anterior, escritura interrumpida,
// etc.) JSON.parse truena de forma sincrona al cargar el modulo y tumba toda
// la app en blanco antes de que React monte nada — por eso va en try/catch.
const stored = localStorage.getItem('user');
let initialUser: User | null = null;
try {
  initialUser = stored ? JSON.parse(stored) : null;
} catch {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

export const useAuth = create<AuthStore>((set) => ({
  user:  initialUser,
  token: localStorage.getItem('token'),

  // Guarda token y usuario tras login exitoso
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  // Limpia sesion al cerrar sesion
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
