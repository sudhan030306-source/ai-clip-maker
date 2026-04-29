# 🎬 AI Viral Clip Extractor

> Extract viral-ready short-form clips from any YouTube video using AI — automatically scored, captioned, and ready to post.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database%2BAuth-green)](https://supabase.com)
[![Groq](https://img.shields.io/badge/AI-Groq%20%2B%20Whisper-orange)](https://groq.com)

---

## Features

- ✅ **Authentication** — Email/password login via Supabase Auth
- ✅ **2 Free Credits** — Each new user gets 2 credits; each analysis uses 1
- ✅ **YouTube Download** — yt-dlp with 20-minute video limit
- ✅ **Whisper Transcription** — Word-level timestamps via Groq
- ✅ **AI Clip Detection** — Hook-first filtering + emotional trigger analysis
- ✅ **Multi-Platform Scoring** — AI (×0.5) + YouTube (×0.2) + Social (×0.2) + Search (×0.1)
- ✅ **Copyright Analyzer** — Detects music, low commentary, reused content
- ✅ **SRT Captions** — Short-form optimized, 6–8 words per line
- ✅ **4 Caption Fonts** — Montserrat, Poppins, Bebas Neue, Anton
- ✅ **On-Demand Download** — FFmpeg MP4 with burned-in captions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Database + Auth | Supabase (PostgreSQL) |
| AI Analysis | Groq (LLaMA 3.3 70B) |
| Transcription | Groq Whisper large-v3 |
| Video Processing | yt-dlp + FFmpeg |
| Deployment | Vercel (frontend) + VPS/Railway (backend) |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ai-viral-clip-extractor.git
cd ai-viral-clip-extractor

# 2. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in your values in both files

# 4. Set up Supabase (run schema.sql in SQL Editor)

# 5. Run both servers
# Terminal 1:
cd backend && npm run dev
# Terminal 2:
cd frontend && npm run dev
```

See [DEPLOYMENT GUIDE](#deployment-guide) below for full setup instructions.

---

## Project Structure

```
ai-viral-clip-extractor/
├── backend/
│   ├── src/
│   │   ├── index.js               # Express server
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verification
│   │   │   └── credits.js         # Credit checks
│   │   ├── routes/
│   │   │   ├── analyze.js         # POST /api/analyze
│   │   │   ├── generateClip.js    # POST /api/generate-clip
│   │   │   └── auth.js            # GET /api/auth/profile|history
│   │   └── services/
│   │       ├── videoProcessor.js  # yt-dlp + FFmpeg
│   │       ├── transcription.js   # Groq Whisper
│   │       ├── aiAnalysis.js      # Groq LLaMA clip detection
│   │       ├── trendScoring.js    # Multi-platform scoring
│   │       ├── captionGenerator.js# SRT generation
│   │       └── copyrightChecker.js# Risk analysis
│   ├── temp/                      # Temporary video/audio files
│   ├── clips/                     # Generated clip outputs
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Auth redirect
│   │   ├── login/page.tsx         # Login/signup
│   │   ├── dashboard/page.tsx     # Main dashboard
│   │   └── results/[jobId]/page.tsx # Results page
│   ├── components/
│   │   ├── ClipCard.tsx           # Individual clip UI
│   │   ├── ScoreRing.tsx          # SVG score visualization
│   │   └── YouTubePreview.tsx     # Embedded preview + captions
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   └── api.ts                 # Backend API calls
│   └── types/index.ts             # TypeScript types
└── supabase/
    └── schema.sql                 # Database schema + RLS
```

---

## License

MIT
