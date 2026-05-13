import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, { cors: { origin: '*' } });
  io.on('connection', (s) => {
    s.on('join', (room: string) => s.join(room));
  });
  return io;
}

export function emit(event: string, payload: any) {
  if (io) io.emit(event, payload);
}
