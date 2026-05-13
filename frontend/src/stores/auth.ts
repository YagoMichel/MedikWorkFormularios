import { create } from 'zustand';

export type Role = 'ADMIN' | 'DOCTOR' | 'PACIENTE';
export interface User { id: string; email: string; fullName: string; role: Role; }

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const stored = localStorage.getItem('user');
const initialUser = stored ? JSON.parse(stored) : null;

export const useAuth = create<AuthStore>((set) => ({
  user: initialUser,
  token: localStorage.getItem('token'),
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
