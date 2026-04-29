/**
 * Video Processor Service
 * Handles yt-dlp download and FFmpeg operations
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(__dirname, '../../temp');
const CLIPS_DIR = path.join(__dirname, '../../clips');

// Ensure directories exist
[TEMP_DIR, CLIPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Run a child process and return stdout/stderr as a promise
 */
function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options);

    let stdout = '';
    let stderr = '';

    if (proc.stdout) proc.stdout.on('data', d => (stdout += d));
    if (proc.stderr) proc.stderr.on('data', d => (stderr += d));

    proc.on('error', err => reject(new Error(`${command} not found: ${err.message}. Is it installed?`)));
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`));
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * Fetch video metadata (title, duration, thumbnail) WITHOUT downloading
 * @param {string} url - YouTube URL
 */
async function getVideoInfo(url) {
  const { stdout } = await runProcess('yt-dlp', [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ]);

  const info = JSON.parse(stdout.trim());
  return {
    title: info.title,
    duration: info.duration, // seconds
    thumbnail: info.thumbnail,
    id: info.id,
    uploader: info.uploader,
  };
}

/**
 * Download YouTube video and extract audio track
 * Returns paths to both files
 * @param {string} url - YouTube URL
 * @param {string} jobId - Unique job identifier
 */
async function downloadAndExtractAudio(url, jobId) {
  const videoPath = path.join(TEMP_DIR, `${jobId}.mp4`);
  const audioPath = path.join(TEMP_DIR, `${jobId}.wav`);

  // ─── Step 1: Download video (max 720p to limit file size) ─────────────────
  console.log(`[${jobId}] Downloading video with yt-dlp...`);
  await runProcess('yt-dlp', [
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-warnings',
    '-o', videoPath,
    url,
  ]);

  if (!fs.existsSync(videoPath)) {
    throw new Error('Video download failed — output file not found');
  }

  // ─── Step 2: Extract audio for Whisper transcription ──────────────────────
  console.log(`[${jobId}] Extracting audio with FFmpeg...`);
  await runProcess('ffmpeg', [
    '-i', videoPath,
    '-vn',            // Strip video track
    '-acodec', 'pcm_s16le', // WAV format (required by Whisper)
    '-ar', '16000',   // 16 kHz sample rate
    '-ac', '1',       // Mono channel
    '-y',             // Overwrite output
    audioPath,
  ]);

  if (!fs.existsSync(audioPath)) {
    throw new Error('Audio extraction failed — output file not found');
  }

  return { videoPath, audioPath };
}

/**
 * Generate a final clip MP4 with captions burned in
 *
 * Font rendering with FFmpeg requires the fonts to be installed on the system.
 * Run: sudo apt-get install fonts-montserrat fonts-open-sans
 * (Poppins and Anton can be downloaded and placed in /usr/local/share/fonts/)
 *
 * @param {string} videoPath - Source video file
 * @param {number} startTime - Clip start in seconds
 * @param {number} endTime   - Clip end in seconds
 * @param {string} srtContent - SRT caption content (empty string = no captions)
 * @param {string} font       - Font name: Montserrat | Poppins | Bebas Neue | Anton
 * @param {string} clipId     - Unique output identifier
 */
async function generateClipVideo(videoPath, startTime, endTime, srtContent, font, clipId) {
  const duration = endTime - startTime;
  const outputPath = path.join(CLIPS_DIR, `${clipId}.mp4`);

  // Map display font name → system font name
  const fontMap = {
    'Montserrat': 'Montserrat',
    'Poppins': 'Poppins',
    'Bebas Neue': 'Bebas Neue',
    'Anton': 'Anton',
  };
  const fontName = fontMap[font] || 'Montserrat';

  let ffmpegArgs;

  if (srtContent && srtContent.trim()) {
    // Write SRT file to temp
    const srtPath = path.join(TEMP_DIR, `${clipId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');

    // Escape SRT path for FFmpeg filter (handle Windows paths too)
    const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    // Subtitle filter with custom styling
    const subtitleFilter = [
      `subtitles='${escapedSrtPath}'`,
      `force_style='FontName=${fontName}`,
      `FontSize=22`,
      `PrimaryColour=&H00FFFFFF`,   // White text
      `OutlineColour=&H00000000`,   // Black outline
      `Outline=2`,
      `Shadow=1`,
      `MarginV=40`,                  // Distance from bottom
      `Alignment=2'`,               // Center bottom
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
      '-movflags', '+faststart',  // Optimize for web playback
      '-y',
      outputPath,
    ];

    // Cleanup SRT after use
    const cleanup = () => { try { fs.unlinkSync(srtPath); } catch (_) {} };
    try {
      await runProcess('ffmpeg', ffmpegArgs);
      cleanup();
    } catch (err) {
      cleanup();
      throw err;
    }
  } else {
    // No captions — simple cut
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
    await runProcess('ffmpeg', ffmpegArgs);
  }

  return outputPath;
}

/**
 * Delete temporary files for a completed job
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

/**
 * Delete old clips that are more than 48 hours old
 */
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

// Run cleanup every 6 hours
setInterval(cleanupOldClips, 6 * 60 * 60 * 1000);

module.exports = {
  getVideoInfo,
  downloadAndExtractAudio,
  generateClipVideo,
  cleanupJob,
  TEMP_DIR,
  CLIPS_DIR,
};
