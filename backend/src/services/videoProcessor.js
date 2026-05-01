/**
 * Video Processor Service
 * Uses nix-installed yt-dlp (bundled Python — no system python3 needed)
 * Searches all nix store paths to find the binary
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(__dirname, '../../temp');
const CLIPS_DIR = path.join(__dirname, '../../clips');

[TEMP_DIR, CLIPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Find yt-dlp binary ───────────────────────────────────────────────────────
let YT_DLP_PATH = null;

function findYtDlp() {
  // Try which first (works if PATH is set correctly by start.sh)
  try {
    const found = execSync('which yt-dlp', { stdio: 'pipe' }).toString().trim();
    if (found) return found;
  } catch (_) {}

  // Search nix store directly
  try {
    const found = execSync(
      'find /nix /root/.nix-profile /usr/local /usr/bin -name "yt-dlp" -type f 2>/dev/null | head -1',
      { stdio: 'pipe' }
    ).toString().trim().split('\n')[0];
    if (found && fs.existsSync(found)) return found;
  } catch (_) {}

  return null;
}

YT_DLP_PATH = findYtDlp();

if (YT_DLP_PATH) {
  console.log(`✅ yt-dlp found: ${YT_DLP_PATH}`);
} else {
  console.error('❌ yt-dlp NOT found. Video analysis will fail.');
}

// ─── Find ffmpeg binary ───────────────────────────────────────────────────────
let FFMPEG_PATH = 'ffmpeg';
try {
  FFMPEG_PATH = execSync('which ffmpeg', { stdio: 'pipe' }).toString().trim() || 'ffmpeg';
  console.log(`✅ ffmpeg found: ${FFMPEG_PATH}`);
} catch (_) {
  console.warn('ffmpeg not in PATH, using default');
}

/**
 * Run a child process
 */
function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
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
 * Fetch video metadata
 */
async function getVideoInfo(url) {
  if (!YT_DLP_PATH) throw new Error('yt-dlp not found on this server');

  const { stdout } = await runProcess(YT_DLP_PATH, [
    '--dump-json', '--no-playlist', '--no-warnings', url,
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
  if (!YT_DLP_PATH) throw new Error('yt-dlp not found on this server');

  const videoPath = path.join(TEMP_DIR, `${jobId}.mp4`);
  const audioPath = path.join(TEMP_DIR, `${jobId}.wav`);

  console.log(`[${jobId}] Downloading with: ${YT_DLP_PATH}`);
  await runProcess(YT_DLP_PATH, [
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    '--merge-output-format', 'mp4',
    '--no-playlist', '--no-warnings',
    '-o', videoPath,
    url,
  ]);

  if (!fs.existsSync(videoPath)) {
    throw new Error('Video download failed — output file not found');
  }

  console.log(`[${jobId}] Extracting audio with: ${FFMPEG_PATH}`);
  await runProcess(FFMPEG_PATH, [
    '-i', videoPath, '-vn',
    '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
    '-y', audioPath,
  ]);

  if (!fs.existsSync(audioPath)) {
    throw new Error('Audio extraction failed');
  }

  return { videoPath, audioPath };
}

/**
 * Generate clip with burned-in captions
 */
async function generateClipVideo(videoPath, startTime, endTime, srtContent, font, clipId) {
  const duration = endTime - startTime;
  const outputPath = path.join(CLIPS_DIR, `${clipId}.mp4`);
  const fontName = { 'Montserrat': 'Montserrat', 'Poppins': 'Poppins', 'Bebas Neue': 'Bebas Neue', 'Anton': 'Anton' }[font] || 'Montserrat';

  if (srtContent && srtContent.trim()) {
    const srtPath = path.join(TEMP_DIR, `${clipId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontName=${fontName},FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,MarginV=40,Alignment=2'`;

    try {
      await runProcess(FFMPEG_PATH, [
        '-ss', String(startTime), '-i', videoPath, '-t', String(duration),
        '-vf', subtitleFilter,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', outputPath,
      ]);
    } finally {
      try { fs.unlinkSync(srtPath); } catch (_) {}
    }
  } else {
    await runProcess(FFMPEG_PATH, [
      '-ss', String(startTime), '-i', videoPath, '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', outputPath,
    ]);
  }

  return outputPath;
}

function cleanupJob(jobId) {
  [path.join(TEMP_DIR, `${jobId}.mp4`), path.join(TEMP_DIR, `${jobId}.wav`), path.join(TEMP_DIR, `${jobId}.srt`)]
    .forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} });
}

function cleanupOldClips() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  try {
    fs.readdirSync(CLIPS_DIR).forEach(file => {
      const fp = path.join(CLIPS_DIR, file);
      try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch (_) {}
    });
  } catch (_) {}
}

setInterval(cleanupOldClips, 6 * 60 * 60 * 1000);

module.exports = { getVideoInfo, downloadAndExtractAudio, generateClipVideo, cleanupJob, TEMP_DIR, CLIPS_DIR };
