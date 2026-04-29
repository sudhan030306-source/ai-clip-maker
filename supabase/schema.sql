-- ============================================================
-- AI Viral Clip Extractor — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Table: user_profiles ─────────────────────────────────────────────────────
-- Extends Supabase auth.users with credits and settings
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  credits     INTEGER NOT NULL DEFAULT 2,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: analysis_jobs ─────────────────────────────────────────────────────
-- Records every video analysis request and stores results
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_url      TEXT NOT NULL,
  video_title      TEXT,
  video_thumbnail  TEXT,
  video_duration   INTEGER,                  -- seconds
  status           TEXT NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'completed', 'failed')),
  results          JSONB,                    -- Array of scored clip objects
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: job_files ────────────────────────────────────────────────────────
-- Tracks downloaded video file paths for on-demand clip generation (24h expiry)
CREATE TABLE IF NOT EXISTS public.job_files (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  video_path  TEXT NOT NULL,                -- Absolute path on server
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table: clip_downloads ───────────────────────────────────────────────────
-- Audit log of every clip generated/downloaded
CREATE TABLE IF NOT EXISTS public.clip_downloads (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_index  INTEGER NOT NULL,
  clip_id     TEXT NOT NULL,
  font        TEXT,
  start_time  NUMERIC(10, 3),
  end_time    NUMERIC(10, 3),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON public.analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status  ON public.analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_files_job_id      ON public.job_files(job_id);
CREATE INDEX IF NOT EXISTS idx_clip_downloads_user   ON public.clip_downloads(user_id);

-- ─── Updated-at Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_analysis_jobs_updated_at
  BEFORE UPDATE ON public.analysis_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Auto-create Profile on Signup Trigger ────────────────────────────────────
-- Fires when a new user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 2)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if re-running this script
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Credit Decrement RPC (Atomic) ───────────────────────────────────────────
-- Called by backend to safely deduct 1 credit (cannot go negative)
CREATE OR REPLACE FUNCTION public.decrement_user_credits(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET credits = GREATEST(credits - 1, 0)
  WHERE id = p_user_id AND credits > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or insufficient credits';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_downloads   ENABLE ROW LEVEL SECURITY;

-- user_profiles: users can only see/update their own profile
CREATE POLICY "Users view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- analysis_jobs: users can only see their own jobs
CREATE POLICY "Users view own jobs"
  ON public.analysis_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Backend (service role) bypasses RLS automatically
-- These policies only affect direct client access

-- clip_downloads: users can see their own downloads
CREATE POLICY "Users view own downloads"
  ON public.clip_downloads FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Helper: Get user credit balance ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT credits FROM public.user_profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Sample Data (Optional — for testing) ────────────────────────────────────
-- INSERT INTO public.user_profiles (id, email, credits)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 10);

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
