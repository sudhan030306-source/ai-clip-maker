# 🚀 STEP-BY-STEP IMPLEMENTATION & DEPLOYMENT GUIDE

> Complete guide from zero to a deployed, working AI Viral Clip Extractor.
> Beginner-friendly with exact commands for every step.

---

## TABLE OF CONTENTS

1. [Prerequisites](#1-prerequisites)
2. [Project Setup Locally](#2-project-setup-locally)
3. [Supabase Setup](#3-supabase-setup)
4. [Install FFmpeg and yt-dlp](#4-install-ffmpeg-and-yt-dlp)
5. [Install Whisper via Groq](#5-connect-groq-ai-whisper--llama)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Run Backend and Frontend](#7-run-backend-and-frontend)
8. [Push to GitHub](#8-push-to-github)
9. [Deploy Frontend on Vercel](#9-deploy-frontend-on-vercel)
10. [Deploy Backend on Railway](#10-deploy-backend-on-railway-recommended)
11. [Test the Full Flow](#11-test-the-full-flow)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| Git | Latest | https://git-scm.com |
| FFmpeg | Latest | See Step 4 |
| yt-dlp | Latest | See Step 4 |
| Python | 3.8+ | https://python.org (for yt-dlp) |

**Accounts you need (all free tiers work):**
- [Supabase](https://supabase.com) — free tier
- [Groq](https://console.groq.com) — free tier (fast inference)
- [Vercel](https://vercel.com) — free tier
- [Railway](https://railway.app) — $5/month or use free tier
- [GitHub](https://github.com) — free

---

## 2. Project Setup Locally

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ai-viral-clip-extractor.git
cd ai-viral-clip-extractor

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

Verify the folder structure looks like this:
```
ai-viral-clip-extractor/
├── backend/          ← Express API
├── frontend/         ← Next.js app
├── supabase/         ← schema.sql
├── .gitignore
└── README.md
```

---

## 3. Supabase Setup

### 3a. Create a Supabase Project

1. Go to https://supabase.com and click **New Project**
2. Choose a name (e.g., `viral-clip-extractor`)
3. Set a strong database password — **save it somewhere**
4. Choose a region closest to you
5. Wait ~2 minutes for provisioning

### 3b. Run the Database Schema

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see: `Success. No rows returned`

### 3c. Get Your API Keys

In the Supabase dashboard:
1. Click **Settings** → **API**
2. Copy:
   - **Project URL** → This is your `SUPABASE_URL`
   - **anon public** key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (keep secret!) → This is your `SUPABASE_SERVICE_KEY`

### 3d. Configure Auth Settings

1. Go to **Authentication** → **Settings**
2. Under **Email**, ensure **Enable email confirmations** is toggled based on your preference
   - For development: **turn it OFF** so you can test without email confirmation
   - For production: **turn it ON**
3. Set **Site URL** to your frontend URL (e.g., `https://your-app.vercel.app`)
4. Add `http://localhost:3000` to **Redirect URLs** for local development

### 3e. Verify Tables Exist

1. Click **Table Editor** in sidebar
2. You should see: `user_profiles`, `analysis_jobs`, `job_files`, `clip_downloads`

---

## 4. Install FFmpeg and yt-dlp

### On Ubuntu / Debian (VPS / Railway)

```bash
# FFmpeg
sudo apt-get update
sudo apt-get install -y ffmpeg

# yt-dlp (always install latest version this way, NOT apt)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Install fonts for caption rendering
sudo apt-get install -y fonts-open-sans

# Verify
ffmpeg -version
yt-dlp --version
```

### On macOS (local development)

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install FFmpeg and yt-dlp
brew install ffmpeg
brew install yt-dlp

# Verify
ffmpeg -version
yt-dlp --version
```

### On Windows (local development)

1. **FFmpeg:**
   - Download from https://ffmpeg.org/download.html (Windows builds)
   - Extract and add the `bin` folder to your system PATH
   - Test: open Command Prompt and type `ffmpeg -version`

2. **yt-dlp:**
   - Download `yt-dlp.exe` from https://github.com/yt-dlp/yt-dlp/releases
   - Place it in a folder that's in your PATH (e.g., `C:\Windows\System32\`)
   - Test: `yt-dlp --version`

### Install Caption Fonts (for FFmpeg subtitle rendering)

Download and install these fonts on your backend server:
- **Montserrat** — https://fonts.google.com/specimen/Montserrat
- **Poppins** — https://fonts.google.com/specimen/Poppins
- **Bebas Neue** — https://fonts.google.com/specimen/Bebas+Neue
- **Anton** — https://fonts.google.com/specimen/Anton

**On Ubuntu:**
```bash
mkdir -p ~/.local/share/fonts
# Download .ttf files and place them in this folder, then:
fc-cache -fv
```

---

## 5. Connect Groq AI (Whisper + LLaMA)

Groq provides both Whisper (transcription) and LLaMA (AI analysis) with a generous free tier.

1. Go to https://console.groq.com
2. Create an account or log in
3. Click **API Keys** in the sidebar
4. Click **Create API Key**
5. Copy the key — this is your `GROQ_API_KEY`

**Free tier limits (as of 2025):**
- Whisper large-v3: ~6,000 minutes/day free
- LLaMA 3.3 70B: ~14,400 requests/day free

This is more than enough for an MVP.

---

## 6. Configure Environment Variables

### Backend (`backend/.env`)

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit the file with your actual values
nano backend/.env   # or use any text editor
```

Fill in:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend (`frontend/.env.local`)

```bash
cp frontend/.env.local.example frontend/.env.local
nano frontend/.env.local
```

Fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**⚠️ IMPORTANT:** Never commit `.env` or `.env.local` files to Git. They're already in `.gitignore`.

---

## 7. Run Backend and Frontend

### Start the Backend

```bash
# Terminal 1
cd backend
npm run dev
```

You should see:
```
🚀 AI Viral Clip Extractor Backend
   Running on http://localhost:3001
   Environment: development
   Frontend: http://localhost:3000
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Start the Frontend

```bash
# Terminal 2
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.1.0
- Local: http://localhost:3000
```

Open http://localhost:3000 in your browser — you should be redirected to `/login`.

---

## 8. Push to GitHub

```bash
# Initialize git at the project root
cd ai-viral-clip-extractor
git init
git add .
git commit -m "🚀 Initial commit — AI Viral Clip Extractor MVP"

# Create a new repository on GitHub (don't initialize with README)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/ai-viral-clip-extractor.git
git branch -M main
git push -u origin main
```

---

## 9. Deploy Frontend on Vercel

1. Go to https://vercel.com and log in with GitHub
2. Click **Add New → Project**
3. Import your `ai-viral-clip-extractor` repository
4. Set **Root Directory** to `frontend`
5. Vercel auto-detects Next.js — no build settings needed
6. Add Environment Variables (click **Environment Variables** tab):
   ```
   NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   NEXT_PUBLIC_API_URL           = https://your-backend.railway.app
   ```
7. Click **Deploy**

After deployment:
- Copy your Vercel URL (e.g., `https://viral-clip.vercel.app`)
- Update Supabase Auth → Settings → Site URL with this URL
- Add this URL to Supabase Redirect URLs

---

## 10. Deploy Backend on Railway (Recommended)

Railway is the easiest option for Node.js servers with FFmpeg support.

### Setup Railway

1. Go to https://railway.app and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `ai-viral-clip-extractor` repository
4. Set **Root Directory** to `backend`

### Install System Dependencies on Railway

Create a file called `Procfile` in the `backend/` folder:
```
web: node src/index.js
```

Create `backend/nixpacks.toml` to install FFmpeg and yt-dlp:
```toml
[phases.setup]
nixPkgs = ["ffmpeg", "yt-dlp", "python3"]

[start]
cmd = "node src/index.js"
```

### Add Environment Variables on Railway

In the Railway dashboard → Variables tab, add:
```
PORT                  = 3001
NODE_ENV              = production
FRONTEND_URL          = https://your-app.vercel.app
BACKEND_URL           = https://your-backend.railway.app
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = eyJ...
GROQ_API_KEY          = gsk_...
```

### Deploy

```bash
# Push to GitHub — Railway auto-deploys on every push
git add .
git commit -m "Add Railway config"
git push origin main
```

Railway will assign you a URL like `https://ai-viral-clip-extractor-production.up.railway.app`.

**After deploy:**
1. Copy the Railway URL
2. Update `BACKEND_URL` in Railway variables to this URL
3. Update `NEXT_PUBLIC_API_URL` in Vercel to this URL
4. Trigger a Vercel redeploy

### Alternative: Deploy on a VPS (DigitalOcean, Linode, Hetzner)

If you prefer a VPS:
```bash
# SSH into your server
ssh user@your-server-ip

# Clone repo
git clone https://github.com/YOUR_USERNAME/ai-viral-clip-extractor.git
cd ai-viral-clip-extractor/backend

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg and yt-dlp
sudo apt-get install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Install PM2 for process management
npm install -g pm2

# Set env variables
cp .env.example .env
nano .env  # Fill in your values

# Start server
npm install
pm2 start src/index.js --name "viral-clip-backend"
pm2 save
pm2 startup   # Follow the instructions to auto-start on reboot
```

---

## 11. Test the Full Flow

Follow this checklist to verify everything works end to end:

### Step 1: Auth Test
- [ ] Open your frontend URL
- [ ] Click "Create Account" and sign up with an email
- [ ] Verify you're redirected to Dashboard
- [ ] Check that "Credits: 2" shows in the nav

### Step 2: Supabase Verification
- [ ] Go to Supabase → Table Editor → `user_profiles`
- [ ] Your user should appear with `credits = 2`

### Step 3: Analysis Test
- [ ] Paste a YouTube URL (choose a video under 5 min for fast testing)
  - Good test video: any short educational/motivational YouTube video
- [ ] Click "Analyze"
- [ ] Wait 1–3 minutes for processing
- [ ] You should be redirected to the Results page

### Step 4: Results Verification
- [ ] At least 5 clips should appear with scores
- [ ] Each clip should show timestamp, hook type, and score rings
- [ ] Credits should now show "1" in the nav
- [ ] Check Supabase → `analysis_jobs` for the completed job

### Step 5: Caption and Download Test
- [ ] Click on the first clip card to expand it
- [ ] Click "Preview captions" button to see caption simulation
- [ ] Select a different font (e.g., "Anton")
- [ ] Click "Download MP4 with Anton captions"
- [ ] Wait 30–60 seconds for FFmpeg processing
- [ ] Verify the MP4 downloads to your computer
- [ ] Play the MP4 and check captions are burned in correctly

### Step 6: Credit Depletion Test
- [ ] Analyze one more video (uses your last credit)
- [ ] Try to analyze a 3rd video — you should see "Insufficient credits" error

---

## 12. Troubleshooting

### "yt-dlp not found" or "ffmpeg not found"
```bash
# Check installation
which yt-dlp
which ffmpeg

# If not found, re-install following Step 4
# Make sure they're in your PATH
echo $PATH
```

### "Groq API error" / "AI returned invalid JSON"
- Check your `GROQ_API_KEY` is correct in `.env`
- Test it: `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models`
- The Groq free tier resets daily — if you hit limits, wait until tomorrow

### "Supabase: relation does not exist"
- The schema SQL wasn't run correctly
- Go to Supabase → SQL Editor and re-run the full `schema.sql`

### "401 Unauthorized" from backend
- The Supabase JWT token isn't being sent
- Check `SUPABASE_SERVICE_KEY` in `backend/.env` (must be service role key, not anon key)
- Check `NEXT_PUBLIC_SUPABASE_URL` matches in frontend

### Video download fails
```bash
# Test yt-dlp manually with the same URL
yt-dlp --dump-json "https://www.youtube.com/watch?v=VIDEO_ID"

# Update yt-dlp (YouTube changes formats often)
sudo yt-dlp -U
```

### Captions not rendering in downloaded video
- Fonts must be installed on the server where FFmpeg runs
- On Ubuntu: `sudo apt-get install -y fonts-open-sans`
- Download and install Montserrat, Poppins, Bebas Neue, Anton manually
- Run: `fc-cache -fv` after installing fonts

### CORS errors in browser
- Check `FRONTEND_URL` in `backend/.env` matches exactly (no trailing slash)
- For production: use your full Vercel URL

### Railway build fails
- Verify `nixpacks.toml` is committed to the `backend/` folder
- Check Railway build logs for specific errors

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Where to Get |
|----------|-------------|-------------|
| `PORT` | Server port (default 3001) | Set to 3001 |
| `NODE_ENV` | Environment | `development` or `production` |
| `FRONTEND_URL` | Your Next.js app URL | Vercel URL or `http://localhost:3000` |
| `BACKEND_URL` | This server's public URL | Railway URL or `http://localhost:3001` |
| `SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | Service role key (secret!) | Supabase → Settings → API |
| `GROQ_API_KEY` | Groq API key | console.groq.com → API Keys |

### Frontend (`frontend/.env.local`)

| Variable | Description | Where to Get |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose) | Supabase → Settings → API |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Railway URL or `http://localhost:3001` |

---

## Scaling Beyond MVP

When you're ready to scale:

1. **Add more credits** — Modify the `decrement_user_credits` function or add a Stripe payment flow
2. **Queue system** — Add BullMQ + Redis for parallel video processing
3. **S3 Storage** — Store clips in AWS S3 instead of the local filesystem
4. **Real trend data** — Integrate YouTube Data API v3 for real search volume
5. **Supabase Edge Functions** — Move copyright + trend scoring to Supabase for serverless scaling
6. **Video thumbnail generation** — Generate thumbnail frames using FFmpeg for each clip

---

*Built with ❤️ using Next.js, Supabase, Groq, FFmpeg, and yt-dlp*
