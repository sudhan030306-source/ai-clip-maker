/**
 * AI Viral Clip Extractor - Backend Server
 * Express.js API server handling video processing pipeline
 */

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
});
app.use('/api/', limiter);

// ─── Static Files (Generated Clips) ──────────────────────────────────────────
// Serve clips directory for downloads
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
