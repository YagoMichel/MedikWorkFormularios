// =============================================================
// ARCHIVO: src/socket/index.ts
// DESCRIPCION: Configuracion de WebSocket con Socket.IO.
//              Permite actualizaciones en tiempo real al frontend
//              (ej: nueva cita, batch confirmado, mensaje del agente).
// USO:
//   - initSocket(server): se llama una vez al arrancar el servidor
//   - emit(evento, datos): se llama desde cualquier ruta para notificar
// EVENTOS EMITIDOS:
//   - 'batch:created'   → nueva jornada empresarial creada
//   - 'agent:message'   → mensaje del bot al cliente web
// =============================================================

import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server | null = null;

// Inicializa el servidor WebSocket ligado al servidor HTTP
export function initSocket(server: HttpServer) {
  io = new Server(server, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    // El cliente puede unirse a una sala especifica (ej: su sessionId)
    socket.on('join', (room: string) => socket.join(room));
  });
  return io;
}

// Emite un evento a TODOS los clientes conectados
export function emit(event: string, payload: any) {
  if (io) io.emit(event, payload);
}
