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
import { connectDb } from './store/db';
import { initializePruner } from './services/pruneService';
import { configureWebPush } from './services/webPushService';

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
  max: 500, // Stingent auth budget: login + token refresh
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: { error: 'Upload limit reached, please try again in an hour.' },
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

// ─── REST API Routes ──────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.status(200).json({ usersOnline: io.engine.clientsCount });
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
  console.error('[Server] Uncaught Exception (process kept alive):', err);
  // DO NOT exit — keep server alive so health checks pass
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection (process kept alive):', reason);
  // DO NOT exit — keep server alive so health checks pass
});

const startServer = async () => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`[Server] SilenX backend listening on 0.0.0.0:${port}`);
    console.log(`[Server] Health check available at http://0.0.0.0:${port}/health`);
  });

  // VAPID signing keys power browser Web Push for background/closed tabs.
  configureWebPush();

  // Non-blocking DB connect — server is already up and answering health checks
  connectDb()
    .then(() => initializePruner())
    .catch((err) => console.error('[Server] MongoDB connection failed (non-fatal):', err));
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
