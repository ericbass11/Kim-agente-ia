import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let io: SocketServer | null = null;

export function initRealtime(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: env.webOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'Cliente realtime conectado');
    // entra na sala da organização para receber eventos relevantes
    socket.on('join', (organizationId: string) => {
      if (organizationId) socket.join(`org:${organizationId}`);
    });
    socket.on('disconnect', () => {
      logger.debug({ id: socket.id }, 'Cliente realtime desconectado');
    });
  });

  return io;
}

/** Emite um evento para todos os clientes de uma organização. */
export function emitToOrg(organizationId: string, event: string, payload: unknown): void {
  io?.to(`org:${organizationId}`).emit(event, payload);
}
