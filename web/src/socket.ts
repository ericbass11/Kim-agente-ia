import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(organizationId: string): Socket {
  if (!socket) {
    socket = io('/', { transports: ['websocket', 'polling'] });
  }
  socket.emit('join', organizationId);
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}
