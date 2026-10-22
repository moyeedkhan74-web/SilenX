import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import mongoose from 'mongoose';
import { config } from './config';
import { registerSocketHandlers } from './websocket/handlers';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversations';
import callRoutes from './routes/calls';
import groupRoutes from './routes/groups';
import groupCallRoutes from './routes/groupCalls';
import requestRoutes from './routes/requests';
import mediaRoutes from './routes/media';
import notificationRoutes from './routes/notifications';
import { connectDb, isDbReady, hasMongoConnection } from './store/db';
import { initializePruner } from './services/pruneService';
import { configureWebPush } from './services/webPushService';
import { buildRedisAdapter, closeRedisAdapter, getRedisAdapterStatus } from './services/redisAdapter';

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", config.frontendUrl || 'https://silen-x.vercel.app', "wss:", "https:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
      reportOnly: config.nodeEnv === 'production',
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = [
  'https://silen-x.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  // Capacitor/Ionic native app origins (Android & iOS WebView)
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
];

if (config.frontendUrl) {
  const normalized = config.frontendUrl.replace(/\/$/, '');
  if (!allowedOrigins.includes(normalized)) {
    allowedOrigins.push(normalized);
  }
}

const checkOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const isAllowed =
    allowedOrigins.includes(origin) ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    /^https:\/\/silen.*\.vercel\.app$/.test(origin) ||
    /^https:\/\/.*\.getvoroa\.com$/.test(origin) ||
    /^https:\/\/.*\.onrender\.com$/.test(origin);

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

// Trust proxy for rate limiting behind Render/CDN
app.set('trust proxy', 1);

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // ~13/min — allows mobile reconnect storms while deterring brute force
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: { error: 'Upload limit reached, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

app.use((_req: Request, res: Response, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.options('*', cors(corsOptions));
app.use(express.json());

// Dynamic API Response Compression
app.use(
  compression({
    threshold: 1024, // Only compress payloads >= 1KB
    level: 6,        // Balanced compression level for Render CPU
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      const contentType = String(res.getHeader('Content-Type') || '');
      if (
        req.path.startsWith('/uploads') ||
        /(image|video|audio|zip|pdf|font|octet-stream)/i.test(contentType)
      ) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Serve local uploads folder fallback (safely handle permission restrictions in container environments)
let uploadsPath = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
} catch (err) {
  console.warn('[Server] Container permission restricted on ./uploads. Falling back to OS temp dir.');
  uploadsPath = path.join(os.tmpdir(), 'silenx-uploads');
  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch (tmpErr) {
    console.error('[Server] Failed to create fallback tmp uploads dir:', tmpErr);
  }
}
app.use('/uploads', express.static(uploadsPath));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Redis Adapter (multi-server socket sync) ───────────────────────
// When UPSTASH_REDIS_URL is set, all Socket.IO events (messages, calls,
// presence) are broadcast through Redis so both Render instances stay in sync.
// Falls back to in-memory adapter automatically if the env var is missing.
const redisAdapter = buildRedisAdapter();
if (redisAdapter) {
  io.adapter(redisAdapter);
  console.log('[Server] Socket.IO Redis adapter attached — multi-server sync enabled.');
} else {
  console.log('[Server] Socket.IO running with default in-memory adapter (single-server mode).');
}

// ─── Health Check Endpoints ───────────────────────────────────────────

/**
 * Liveness probe: always returns 200 if the server process is running.
 * Used by Kubernetes/render to decide if the container should be restarted.
 */
app.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * Readiness probe: returns 200 only when all critical dependencies are ready.
 * Critical: MongoDB (if configured). Redis is optional but reported.
 */
app.get('/ready', (_req: Request, res: Response) => {
  const redis = getRedisAdapterStatus();
  if (isDbReady()) {
    return res.status(200).json({ status: 'ready', timestamp: new Date().toISOString(), db: 'mongo', redis });
  }
  res.status(503).json({ status: 'not ready', reason: 'db_initializing_or_failed', redis });
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.status(200).json({
    usersOnline: io.engine.clientsCount,
    db: { ready: isDbReady(), mongoConnected: hasMongoConnection() },
    redis: getRedisAdapterStatus(),
    uptime: Math.floor(process.uptime()),
  });
});

// ICE Servers for WebRTC Calls
app.get('/api/webrtc/ice-servers', (_req: Request, res: Response) => {
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    // ── STUN (multiple google servers for reliability) ──────────────────────
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare public STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  // ── TURN server — try to use a custom one first; fall back to OpenRelay ──
  const customTurnUrl = process.env.TURN_SERVER_URL;
  const customTurnUser = process.env.TURN_USERNAME;
  const customTurnPass = process.env.TURN_PASSWORD;

  if (customTurnUrl && customTurnUser && customTurnPass) {
    // Custom TURN (e.g. Twilio, Xirsys, Metered, or self-hosted coturn)
    iceServers.push({
      urls: [
        `turn:${customTurnUrl}?transport=udp`,
        `turn:${customTurnUrl}?transport=tcp`,
        `turns:${customTurnUrl}?transport=tcp`,
      ],
      username: customTurnUser,
      credential: customTurnPass,
    });
  }

  // ── OpenRelay — free public TURN, no credentials needed ─────────────────
  // Works reliably for testing and low-traffic apps. Always include so calls
  // work even on restrictive networks (carrier-grade NAT, corporate firewalls).
  iceServers.push(
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  );

  // Cache-Control: allow client to cache for 45s (matches frontend TTL)
  res.setHeader('Cache-Control', 'public, max-age=45');
  res.status(200).json(iceServers);
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/media', mediaUploadLimiter, mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/group-calls', groupCallRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Serve Frontend (production) ───────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('*', (_req: Request, res: Response) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SilenX API Gateway</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0b0e11; color: #e9edef; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { text-align: center; background: #111b21; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px; }
          h1 { color: #00a884; margin-top: 0; font-size: 1.8rem; }
          p { color: #8696a0; margin-bottom: 1.5rem; }
          a { display: inline-block; padding: 0.75rem 1.5rem; background: #00a884; color: #fff; text-decoration: none; border-radius: 20px; font-weight: bold; }
          .badge { display: inline-block; padding: 0.25rem 0.6rem; background: #202c33; border-radius: 4px; font-size: 0.85rem; font-family: monospace; color: #34b7f1; margin-top: 0.5rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>SilenX API Gateway</h1>
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
app.set('io', io);
registerSocketHandlers(io);

const port = Number(process.env.PORT) || 5000;

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  // Fatal — clean up resources and exit so a supervisor restarts us in a known state
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
  // Fatal — clean up resources and exit
  gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
});

// ─── Graceful Shutdown ──────────────────────────────────────────────
const gracefulShutdown = async (signal: string) => {
  console.log(`[Server] ${signal} received — shutting down gracefully…`);

  // 1. Drain new HTTP connections (stop accepting new requests)
  server.close(() => {
    console.log('[Server] HTTP server closed.');
  });

  // 2. Close Redis adapter — prevents new Socket.IO messages from being queued
  try {
    await closeRedisAdapter();
    console.log('[Server] Redis adapter closed.');
  } catch (err) {
    console.warn('[Server] Error closing Redis adapter:', err);
  }

  // 3. Leave in-flight Socket.IO connections active briefly; then disconnect
  try {
    const sio = app.get('io') as Server | undefined;
    if (sio) {
      // Prevent new events from being processed
      sio.emit('__shutdown__');
      // Wait a brief window for in-flight messages to complete
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));
      sio.close();
      console.log('[Server] Socket.IO server closed.');
    }
  } catch (err) {
    console.warn('[Server] Error closing Socket.IO:', err);
  }

  // 4. Close MongoDB connection — release pool
  try {
    await mongoose.disconnect();
    console.log('[Server] MongoDB connection closed.');
  } catch (err) {
    console.warn('[Server] Error closing MongoDB:', err);
  }

  // 5. Force exit after a generous deadline
  setTimeout(() => process.exit(1), 15_000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

const startServer = async () => {
  // ─── Critical: MongoDB startup ─────────────────────────────────────
  try {
    await connectDb();
  } catch (err) {
    console.error('[Server] MongoDB connection failed on startup (fatal):', err);
    console.error('[Server] Exiting immediately per startup policy.');
    process.exit(1);
    return;
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Server] SilenX backend listening on 0.0.0.0:${port}`);
    console.log(`[Server] Liveness: http://0.0.0.0:${port}/live`);
    console.log(`[Server] Readiness: http://0.0.0.0:${port}/ready`);
    try {
      initializePruner();
    } catch (err) {
      console.warn('[Server] Pruner failed to initialize (non-fatal):', err);
    }
  });

  // VAPID signing keys power browser Web Push for background/closed tabs.
  configureWebPush();
};


startServer();

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
