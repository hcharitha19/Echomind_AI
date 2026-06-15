// server.js — EchoMind Production Server
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path        = require('path');

const { testConnection } = require('./config/db');
const authRoutes  = require('./routes/auth');
const chatRoutes  = require('./routes/chat');
const ragRoutes   = require('./routes/rag');
const ttsRoutes   = require('./routes/tts');
const sttRoutes   = require('./routes/stt');
const modelsRoutes = require('./routes/models');

const app  = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

/* ── Security headers ──────────────────────────────────────────── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProd ? undefined : false,
}));

/* ── Compression ───────────────────────────────────────────────── */
app.use(compression());

/* ── Logging ───────────────────────────────────────────────────── */
app.use(morgan(isProd ? 'combined' : 'dev'));

/* ── CORS ──────────────────────────────────────────────────────── */
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ── Body parsers ──────────────────────────────────────────────── */
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

/* ── Global rate limit ─────────────────────────────────────────── */
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '200'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api', globalLimiter);

/* ── Auth-specific stricter rate limit ─────────────────────────── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max:      20,
  message:  { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

/* ── Trust proxy (for Nginx/load balancers) ─────────────────────── */
if (isProd) app.set('trust proxy', 1);

/* ── Routes ────────────────────────────────────────────────────── */
app.use('/api/auth',   authRoutes);
app.use('/api/chat',   chatRoutes);
app.use('/api/rag',    ragRoutes);
app.use('/api/tts',    ttsRoutes);
app.use('/api/stt',    sttRoutes);
app.use('/api/models', modelsRoutes);

/* ── Health check ──────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
    version:   '1.0.0',
  });
});

/* ── Serve React build in production ───────────────────────────── */
if (isProd) {
  const buildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

/* ── 404 ────────────────────────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

/* ── Global error handler ───────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.stack || err.message);
  const status = err.status || 500;
  const message = isProd ? 'Internal server error.' : (err.message || 'Internal server error.');
  res.status(status).json({ success: false, message });
});

/* ── Start server ───────────────────────────────────────────────── */
const start = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`\n🚀  EchoMind server running on port ${PORT}`);
      console.log(`🌍  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡  API: http://localhost:${PORT}/api\n`);
    });
  } catch (err) {
    console.error('💀  Server startup failed:', err.message);
    process.exit(1);
  }
};

/* Graceful shutdown */
process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down…'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT received, shutting down…');  process.exit(0); });

start();
