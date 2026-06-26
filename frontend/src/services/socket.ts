// =============================================================
// ARCHIVO: src/services/socket.ts
// DESCRIPCION: Conexion WebSocket al backend.
//              Permite recibir actualizaciones en tiempo real
//              sin recargar la pagina (ej: nueva cita del bot).
//
// USO: import { socket } from '../../services/socket';
//      socket.on('batch:created', (data) => { ... });
// =============================================================

import { io } from 'socket.io-client';

// Se conecta al mismo origen (nginx hace proxy a backend:4000/socket.io)
export const socket = io('/', { autoConnect: true });
