/**
 * AI Viral Clip Extractor - Backend Server
 * Express.js API server handling video processing pipeline
 */

// ─── Auto-install yt-dlp at startup ───────────────────────────────────────────
const { execSync } = require('child_process');

function installYtDlp() {
  // Method 1: Try pip3 (most reliable on Railway)
  try {
    execSync('pip3 install -q yt-dlp', { stdio: 'inherit' });
    console.log('yt-dlp installed via pip3');
    return;
  } catch (_) {}

  // Method 2: Try pip
  try {
    execSync('pip install -q yt-dlp', { stdio: 'inherit' });
    console.log('yt-dlp installed via pip');
    return;
  } catch (_) {}

  console.error('Could not install yt-dlp — all methods failed');
}

try {
  execSync('yt-dlp --version', { stdio: 'pipe' });
  console.log('yt-dlp already available');
} catch {
  console.log('Installing yt-dlp...');
  installYtDlp();
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const analyzeRouter = require('./routes/analyze');
const generateClipRouter = require('./routes/generateClip');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Ensure Required Directories Exist ────────────────────────────────────────
const TEMP_DIR = path.join(__dirname, '../temp');
const CLIPS_DIR = path.join(__dirname, '../clips');
[TEMP_DIR, CLIPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting — 50 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' },
  validate: { xForwardedForHeader: false },
});
app.use('/api/', limiter);

// ─── Static Files (Generated Clips) ──────────────────────────────────────────
app.use('/clips', express.static(CLIPS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment');
  },
}));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/generate-clip', generateClipRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AI Viral Clip Extractor Backend`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}\n`);
});

module.exports = app;
