import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { registerSocketHandlers } from './websocket/handlers';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import callRoutes from './routes/calls';

const app = express();
app.use(
  cors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.isProduction ? [config.frontendUrl] : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── REST API ──────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.status(200).json({ usersOnline: io.engine.clientsCount });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/calls', callRoutes);

// ─── WebSocket ─────────────────────────────────────────────
registerSocketHandlers(io);

const port = Number(process.env.PORT) || 5000;

if (require.main === module) {
  server.listen(port, () => {
    console.log(`[Server] SlienX backend listening on port ${port}`);
  });
}

export { app, io, server, port };
