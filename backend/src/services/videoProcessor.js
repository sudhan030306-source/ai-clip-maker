/**
 * Video Processor Service
 * Uses nix-installed yt-dlp (has bundled Python — no system python3 needed)
 * and FFmpeg for audio extraction and clip generation
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(__dirname, '../../temp');
const CLIPS_DIR = path.join(__dirname, '../../clips');

[TEMP_DIR, CLIPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Find yt-dlp binary path at startup ───────────────────────────────────────
// Nix installs yt-dlp to /nix/store/xxx/bin/yt-dlp — find it dynamically
let YT_DLP_PATH = 'yt-dlp';
const POSSIBLE_PATHS = [
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  '/nix/var/nix/profiles/default/bin/yt-dlp',
  '/root/.nix-profile/bin/yt-dlp',
];

try {
  const whichResult = execSync('which yt-dlp 2>/dev/null || find /nix -name "yt-dlp" -type f 2>/dev/null | head -1', {
    stdio: 'pipe',
  }).toString().trim();
  if (whichResult) {
    YT_DLP_PATH = whichResult.split('\n')[0].trim();
    console.log(`✅ yt-dlp found at: ${YT_DLP_PATH}`);
  }
} catch {
  // Try known paths
  for (const p of POSSIBLE_PATHS) {
    if (fs.existsSync(p)) {
      YT_DLP_PATH = p;
      console.log(`✅ yt-dlp found at: ${YT_DLP_PATH}`);
      break;
    }
  }
}

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
    proc.on('error', err => reject(new Error(`${command} not found: ${err.message}`)));
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`));
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * Fetch video metadata without downloading
 */
async function getVideoInfo(url) {
  const { stdout } = await runProcess(YT_DLP_PATH, [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ]);

  const info = JSON.parse(stdout.trim());
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

  // ── Step 1: Download video ────────────────────────────────────────────────
  console.log(`[${jobId}] Downloading video with yt-dlp (${YT_DLP_PATH})...`);
  await runProcess(YT_DLP_PATH, [
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

  // ── Step 2: Extract audio ─────────────────────────────────────────────────
  console.log(`[${jobId}] Extracting audio...`);
  await runProcess('ffmpeg', [
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
 * Generate clip with burned-in captions
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

    try {
      await runProcess('ffmpeg', [
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
      ]);
    } finally {
      try { fs.unlinkSync(srtPath); } catch (_) {}
    }
  } else {
    await runProcess('ffmpeg', [
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
    ]);
  }

  return outputPath;
}

/**
 * Delete temp files for a job
 */
function cleanupJob(jobId) {
  [
    path.join(TEMP_DIR, `${jobId}.mp4`),
    path.join(TEMP_DIR, `${jobId}.wav`),
    path.join(TEMP_DIR, `${jobId}.srt`),
  ].forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  });
}

function cleanupOldClips() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  try {
    fs.readdirSync(CLIPS_DIR).forEach(file => {
      const fp = path.join(CLIPS_DIR, file);
      try {
        if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
      } catch (_) {}
    });
  } catch (_) {}
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
