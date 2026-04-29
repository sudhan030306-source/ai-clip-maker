/**
 * /api/generate-clip Route
 * On-demand clip generation with burned-in captions using FFmpeg
 * Only triggered when user clicks "Download" — no pre-rendering
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { authenticateUser } = require('../middleware/auth');
const { generateClipVideo, CLIPS_DIR } = require('../services/videoProcessor');

// ─── POST /api/generate-clip ──────────────────────────────────────────────────
router.post('/', authenticateUser, async (req, res) => {
  const { jobId, clipIndex, startTime, endTime, srtContent, font } = req.body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!jobId || clipIndex === undefined || startTime === undefined || endTime === undefined) {
    return res.status(400).json({ error: 'jobId, clipIndex, startTime, endTime are required' });
  }

  const duration = endTime - startTime;
  if (duration <= 0 || duration > 45) {
    return res.status(400).json({ error: 'Clip duration must be between 1 and 45 seconds' });
  }

  const validFonts = ['Montserrat', 'Poppins', 'Bebas Neue', 'Anton'];
  const selectedFont = validFonts.includes(font) ? font : 'Montserrat';

  try {
    // ── Verify job belongs to this user ────────────────────────────────────────
    const { data: job, error: jobError } = await req.supabase
      .from('analysis_jobs')
      .select('id, status')
      .eq('id', jobId)
      .eq('user_id', req.user.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job has not completed analysis yet' });
    }

    // ── Retrieve video file path from DB ───────────────────────────────────────
    const { data: fileRecord } = await req.supabase
      .from('job_files')
      .select('video_path, expires_at')
      .eq('job_id', jobId)
      .single();

    if (!fileRecord) {
      return res.status(404).json({
        error: 'Source video has expired or was not found. Re-analyze the video to generate clips.',
      });
    }

    if (new Date(fileRecord.expires_at) < new Date()) {
      return res.status(410).json({
        error: 'Source video has expired (24h limit). Please re-analyze to regenerate clips.',
      });
    }

    const videoPath = fileRecord.video_path;
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        error: 'Source video file not found on server. Please re-analyze.',
      });
    }

    // ── Generate the clip ──────────────────────────────────────────────────────
    const clipId = `${jobId}-${clipIndex}-${uuidv4().slice(0, 8)}`;
    console.log(`[${clipId}] Generating clip: ${startTime}s → ${endTime}s with font "${selectedFont}"`);

    const outputPath = await generateClipVideo(
      videoPath,
      startTime,
      endTime,
      srtContent || '',
      selectedFont,
      clipId
    );

    // ── Log clip download ──────────────────────────────────────────────────────
    await req.supabase.from('clip_downloads').insert({
      job_id: jobId,
      user_id: req.user.id,
      clip_index: clipIndex,
      clip_id: clipId,
      font: selectedFont,
      start_time: startTime,
      end_time: endTime,
    });

    const fileName = path.basename(outputPath);
    const downloadUrl = `${process.env.BACKEND_URL}/clips/${fileName}`;

    console.log(`[${clipId}] ✅ Clip ready: ${downloadUrl}`);

    return res.json({
      success: true,
      clipId,
      downloadUrl,
      fileName,
      duration: Math.round(duration),
    });

  } catch (error) {
    console.error('Clip generation error:', error.message);
    return res.status(500).json({
      error: 'Clip generation failed',
      message: error.message,
    });
  }
});

module.exports = router;
