import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { registerSocketHandlers } from './websocket/handlers';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import callRoutes from './routes/calls';
import requestRoutes from './routes/requests';
import { connectDb } from './store/db';

const app = express();

const allowedOrigins = [
  'https://silen-x.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

if (config.frontendUrl) {
  const normalized = config.frontendUrl.replace(/\/$/, '');
  if (!allowedOrigins.includes(normalized)) {
    allowedOrigins.push(normalized);
  }
}

const checkOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (like mobile apps, curl, uptime check pings)
  if (!origin) {
    callback(null, true);
    return;
  }

  const isAllowed = allowedOrigins.includes(origin) ||
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:') ||
                    /^https:\/\/silen-x-.*\.vercel\.app$/.test(origin);

  if (isAllowed) {
    callback(null, true);
  } else {
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(null, false);
  }
};

app.use(
  cors({
    origin: checkOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
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
app.use('/api/requests', requestRoutes);

// ─── Serve Frontend (production) ───────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// SPA catch-all: any non-API GET returns index.html
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── WebSocket ─────────────────────────────────────────────
registerSocketHandlers(io);

const port = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectDb();
  } catch (err) {
    console.error('[Server] MongoDB connection failed:', err);
  }
  server.listen(port, () => {
    console.log(`[Server] SlienX backend listening on port ${port}`);
  });
};

startServer();

export { app, io, server, port, startServer };
