import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
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
                    /^https:\/\/silen.*\.vercel\.app$/.test(origin);

  if (isAllowed) {
    callback(null, true);
  } else {
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(null, false);
  }
};

const corsOptions = {
  origin: checkOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Set Cross-Origin-Opener-Policy header to allow Google OAuth popups without browser blocking
app.use((_req: Request, res: Response, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Explicitly handle ALL OPTIONS preflight requests FIRST — before any route logic.
// This ensures the browser always gets CORS headers even if a later handler throws.
app.options('*', cors(corsOptions));

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
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all: any non-API GET returns index.html
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // If frontend is not built in the container, serve a clean status page
  app.get('*', (_req: Request, res: Response) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SlienX API Gateway</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0e11;
            color: #e9edef;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            text-align: center;
            background: #111b21;
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 400px;
          }
          h1 {
            color: #00a884;
            margin-top: 0;
            font-size: 1.8rem;
          }
          p {
            line-height: 1.5;
            color: #8696a0;
            margin-bottom: 1.5rem;
          }
          a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #00a884;
            color: #fff;
            text-decoration: none;
            border-radius: 20px;
            font-weight: bold;
            transition: background 0.2s;
          }
          a:hover {
            background: #008f72;
          }
          .badge {
            display: inline-block;
            padding: 0.25rem 0.6rem;
            background: #202c33;
            border-radius: 4px;
            font-size: 0.85rem;
            font-family: monospace;
            color: #34b7f1;
            margin-top: 0.5rem;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>SlienX API Gateway</h1>
          <p>The secure communication gateway is running successfully.</p>
          <div class="badge">Status: Online</div>
          <br/><br/>
          <a href="https://silen-x.vercel.app" target="_blank" rel="noopener noreferrer">Open Chat App</a>
        </div>
      </body>
      </html>
    `);
  });
}

// ─── WebSocket ─────────────────────────────────────────────
registerSocketHandlers(io);

const port = Number(process.env.PORT) || 5000;

const startServer = async () => {
  // Listen immediately so that health check endpoints resolve instantly and don't block Render startup
  server.listen(port, () => {
    console.log(`[Server] SlienX backend listening on port ${port}`);
  });

  try {
    await connectDb();
  } catch (err) {
    console.error('[Server] MongoDB connection failed:', err);
  }
};

startServer();

// Global error handler — always emit CORS headers so the browser doesn't
// mistake a server crash for a CORS block.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    checkOrigin(origin, (_, allow) => {
      if (allow) res.setHeader('Access-Control-Allow-Origin', origin);
    });
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  console.error('[Server] Unhandled error:', err?.message || err);
  res.status(500).json({ message: 'Internal server error' });
});

export { app, io, server, port, startServer };
