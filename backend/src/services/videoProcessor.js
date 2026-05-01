/**
 * Video Processor Service
 * Uses youtube-dl-exec (auto-downloads yt-dlp binary via npm)
 * and FFmpeg for audio extraction and clip generation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const youtubeDl = require('youtube-dl-exec');

const TEMP_DIR = path.join(__dirname, '../../temp');
const CLIPS_DIR = path.join(__dirname, '../../clips');

[TEMP_DIR, CLIPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Run FFmpeg as a child process
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    if (proc.stderr) proc.stderr.on('data', d => (stderr += d));
    proc.on('error', err => reject(new Error(`ffmpeg not found: ${err.message}`)));
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
      else resolve();
    });
  });
}

/**
 * Fetch video metadata without downloading
 */
async function getVideoInfo(url) {
  const info = await youtubeDl(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
  });

  return {
    title: info.title,
    duration: info.duration,
    thumbnail: info.thumbnail,
    id: info.id,
    uploader: info.uploader,
  };
}

/**
 * Download video and extract audio
 */
async function downloadAndExtractAudio(url, jobId) {
  const videoPath = path.join(TEMP_DIR, `${jobId}.mp4`);
  const audioPath = path.join(TEMP_DIR, `${jobId}.wav`);

  // ── Step 1: Download video via youtube-dl-exec ─────────────────────────────
  console.log(`[${jobId}] Downloading video...`);
  await youtubeDl(url, {
    output: videoPath,
    format: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    mergeOutputFormat: 'mp4',
    noPlaylist: true,
    noWarnings: true,
  });

  if (!fs.existsSync(videoPath)) {
    throw new Error('Video download failed — output file not found');
  }

  // ── Step 2: Extract audio with FFmpeg ─────────────────────────────────────
  console.log(`[${jobId}] Extracting audio...`);
  await runFFmpeg([
    '-i', videoPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    audioPath,
  ]);

  if (!fs.existsSync(audioPath)) {
    throw new Error('Audio extraction failed — output file not found');
  }

  return { videoPath, audioPath };
}

/**
 * Generate a clip with burned-in captions
 */
async function generateClipVideo(videoPath, startTime, endTime, srtContent, font, clipId) {
  const duration = endTime - startTime;
  const outputPath = path.join(CLIPS_DIR, `${clipId}.mp4`);

  const fontMap = {
    'Montserrat': 'Montserrat',
    'Poppins': 'Poppins',
    'Bebas Neue': 'Bebas Neue',
    'Anton': 'Anton',
  };
  const fontName = fontMap[font] || 'Montserrat';

  let ffmpegArgs;

  if (srtContent && srtContent.trim()) {
    const srtPath = path.join(TEMP_DIR, `${clipId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    const subtitleFilter = [
      `subtitles='${escapedSrtPath}'`,
      `force_style='FontName=${fontName}`,
      `FontSize=22`,
      `PrimaryColour=&H00FFFFFF`,
      `OutlineColour=&H00000000`,
      `Outline=2`,
      `Shadow=1`,
      `MarginV=40`,
      `Alignment=2'`,
    ].join(':');

    ffmpegArgs = [
      '-ss', String(startTime),
      '-i', videoPath,
      '-t', String(duration),
      '-vf', subtitleFilter,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    try {
      await runFFmpeg(ffmpegArgs);
    } finally {
      try { fs.unlinkSync(srtPath); } catch (_) {}
    }
  } else {
    ffmpegArgs = [
      '-ss', String(startTime),
      '-i', videoPath,
      '-t', String(duration),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];
    await runFFmpeg(ffmpegArgs);
  }

  return outputPath;
}

/**
 * Delete temp files for a job
 */
function cleanupJob(jobId) {
  const files = [
    path.join(TEMP_DIR, `${jobId}.mp4`),
    path.join(TEMP_DIR, `${jobId}.wav`),
    path.join(TEMP_DIR, `${jobId}.srt`),
  ];
  files.forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  });
}

function cleanupOldClips() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  fs.readdirSync(CLIPS_DIR).forEach(file => {
    const filePath = path.join(CLIPS_DIR, file);
    try {
      const { mtimeMs } = fs.statSync(filePath);
      if (mtimeMs < cutoff) fs.unlinkSync(filePath);
    } catch (_) {}
  });
}

setInterval(cleanupOldClips, 6 * 60 * 60 * 1000);

module.exports = {
  getVideoInfo,
  downloadAndExtractAudio,
  generateClipVideo,
  cleanupJob,
  TEMP_DIR,
  CLIPS_DIR,
};
