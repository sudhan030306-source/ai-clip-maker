/**
 * /api/analyze Route
 * Main pipeline: URL → download → transcribe → AI analyze → score → return clips
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const { authenticateUser } = require('../middleware/auth');
const { checkCredits, deductCredit } = require('../middleware/credits');
const { getVideoInfo, downloadAndExtractAudio, cleanupJob } = require('../services/videoProcessor');
const { transcribeAudio, buildClipSegments } = require('../services/transcription');
const { analyzeClips } = require('../services/aiAnalysis');
const { scoreTrends } = require('../services/trendScoring');
const { generateSRT, parseSRTForFrontend } = require('../services/captionGenerator');
const { checkCopyrightRisk } = require('../services/copyrightChecker');

const MAX_VIDEO_DURATION = 20 * 60; // 20 minutes

// ─── POST /api/analyze ────────────────────────────────────────────────────────
router.post('/', authenticateUser, checkCredits, async (req, res) => {
  const { url } = req.body;
  const jobId = uuidv4();
  let videoPath = null;

  // ── Input Validation ────────────────────────────────────────────────────────
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  const ytPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?.*v=|youtu\.be\/)[\w-]{11}/;
  if (!ytPattern.test(url.trim())) {
    return res.status(400).json({ error: 'Please provide a valid YouTube video URL' });
  }

  try {
    // ── Step 1: Verify video is under 20 minutes ──────────────────────────────
    console.log(`[${jobId}] Fetching video info for: ${url}`);
    const videoInfo = await getVideoInfo(url);

    if (videoInfo.duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({
        error: `Video too long. Max is 20 minutes — this video is ${Math.round(videoInfo.duration / 60)} min.`,
      });
    }

    // ── Step 2: Deduct credit BEFORE processing (prevent abuse) ───────────────
    await deductCredit(req.supabase, req.user.id);

    // ── Step 3: Create job record ─────────────────────────────────────────────
    await req.supabase.from('analysis_jobs').insert({
      id: jobId,
      user_id: req.user.id,
      youtube_url: url,
      video_title: videoInfo.title,
      video_thumbnail: videoInfo.thumbnail,
      video_duration: videoInfo.duration,
      status: 'processing',
    });

    // ── Step 4: Download video + extract audio ────────────────────────────────
    console.log(`[${jobId}] Downloading video...`);
    const paths = await downloadAndExtractAudio(url, jobId);
    videoPath = paths.videoPath;
    const audioPath = paths.audioPath;

    // ── Step 5: Transcribe with Whisper ───────────────────────────────────────
    console.log(`[${jobId}] Transcribing audio...`);
    const { segments, words } = await transcribeAudio(audioPath);

    // Cleanup audio immediately (save disk space)
    try { fs.unlinkSync(audioPath); } catch (_) {}

    if (segments.length === 0) {
      throw new Error('No speech detected in video. Is there audio commentary?');
    }

    // ── Step 6: Build clip-sized segments (15–45s) ────────────────────────────
    const clipSegments = buildClipSegments(segments);
    console.log(`[${jobId}] Built ${clipSegments.length} potential clip segments`);

    if (clipSegments.length === 0) {
      throw new Error('Video segments too short to form clips. Try a longer video.');
    }

    // ── Step 7: AI viral analysis ─────────────────────────────────────────────
    console.log(`[${jobId}] Running AI analysis...`);
    const analyzedClips = await analyzeClips(clipSegments, videoInfo.title);

    if (analyzedClips.length === 0) {
      throw new Error('No viral clips found. The video may have weak hooks throughout.');
    }

    // ── Step 8: Multi-platform trend scoring ──────────────────────────────────
    console.log(`[${jobId}] Scoring trends...`);
    const scoredClips = await scoreTrends(analyzedClips, clipSegments, videoInfo.title);

    // ── Step 9: Generate captions & copyright risk for each clip ──────────────
    console.log(`[${jobId}] Generating captions and copyright analysis...`);
    const finalClips = await Promise.all(
      scoredClips.map(async (clip, i) => {
        const segment = clipSegments[clip.segmentId];

        // Generate SRT (relative timestamps)
        const srtContent = generateSRT(words, segment.start, segment.end);
        const captions = parseSRTForFrontend(srtContent);

        // Copyright risk
        const copyright = await checkCopyrightRisk(segment.text, videoInfo.title);

        return {
          id: `${jobId}-clip-${i}`,
          jobId,
          index: i,
          videoId: videoInfo.id,
          title: clip.title,
          hook: clip.hook,
          hookType: clip.hookType,
          hookText: clip.hookText,
          startTime: Math.floor(segment.start),
          endTime: Math.ceil(segment.end),
          duration: Math.round(segment.end - segment.start),
          transcript: segment.text,
          // Scores
          aiScore: parseFloat(clip.aiScore.toFixed(1)),
          youtubeTrendScore: clip.youtubeTrendScore,
          socialTrendScore: clip.socialTrendScore,
          searchDemandScore: clip.searchDemandScore,
          finalScore: clip.finalScore,
          // Captions
          srtContent,
          captions,
          // Copyright
          copyright,
        };
      })
    );

    // Sort by final score (highest first)
    finalClips.sort((a, b) => b.finalScore - a.finalScore);

    // ── Step 10: Save results to DB ───────────────────────────────────────────
    await req.supabase.from('analysis_jobs').update({
      status: 'completed',
      results: finalClips,
    }).eq('id', jobId);

    // Store video file path for on-demand clip generation (expires in 24h)
    await req.supabase.from('job_files').insert({
      job_id: jobId,
      video_path: videoPath,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    console.log(`[${jobId}] ✅ Analysis complete — ${finalClips.length} clips`);

    return res.json({
      success: true,
      jobId,
      videoTitle: videoInfo.title,
      videoThumbnail: videoInfo.thumbnail,
      videoDuration: videoInfo.duration,
      clips: finalClips,
      creditsRemaining: req.userCredits - 1,
    });

  } catch (error) {
    console.error(`[${jobId}] ❌ Analysis failed:`, error.message);

    // Update job to failed state
    try {
      await req.supabase.from('analysis_jobs').update({
        status: 'failed',
        error: error.message,
      }).eq('id', jobId);
    } catch (_) {}

    // Cleanup only audio/temp; keep video if it exists (user can retry clip gen)
    cleanupJob(jobId);

    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

// ─── GET /api/analyze/:jobId — fetch existing results ─────────────────────────
router.get('/:jobId', authenticateUser, async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await req.supabase
    .from('analysis_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', req.user.id) // Enforce ownership
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Job not found or access denied' });
  }

  return res.json(data);
});

module.exports = router;
