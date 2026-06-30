import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/webrtc-config';

let socket: Socket | null = null;

export const connectSocket = (): Socket => {
  if (!socket) {
    const options = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };

    socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);

    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket?.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error(`[Socket] Connection Error: ${error.message}`);
    });
  }

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
