// =============================================================
// ARCHIVO: src/services/api.ts
// DESCRIPCION: Cliente HTTP centralizado (axios).
//              Todas las llamadas al backend pasan por aqui.
//
// BASE URL: /api  (nginx hace proxy a backend:4000)
//
// INTERCEPTORES:
//   - Request:  agrega el token JWT en cada peticion automaticamente
//   - Response: si el servidor responde 401, limpia sesion y redirige a /login
// =============================================================

import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

// Agrega el token JWT al header de cada peticion
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el servidor responde 401 (token vencido o invalido), cierra sesion
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  }
);
