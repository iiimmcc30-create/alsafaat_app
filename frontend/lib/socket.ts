import { io, Socket } from 'socket.io-client';
import { resolveDevServiceUrl } from '@/services/devHost';

function resolveSocketUrl(): string {
  return resolveDevServiceUrl(process.env.EXPO_PUBLIC_SOCKET_URL, 3002);
}

export function connectSocket(accessToken: string): Socket {
  return io(resolveSocketUrl(), {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
}

export { resolveSocketUrl };
