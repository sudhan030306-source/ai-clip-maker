/**
 * Transcription Service
 * Uses Groq's Whisper API for fast, accurate transcription
 * Returns word-level and segment-level timestamps for precise clip cutting
 */

const Groq = require('groq-sdk');
const fs = require('fs');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Transcribe an audio file using Groq's Whisper large-v3
 * @param {string} audioPath - Path to WAV audio file
 * @returns {{ text, segments, words, duration }}
 */
async function transcribeAudio(audioPath) {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const audioStream = fs.createReadStream(audioPath);

  const transcription = await groq.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment', 'word'],
    language: 'en', // Set to null for auto-detection
  });

  return {
    text: transcription.text || '',
    segments: transcription.segments || [],
    words: transcription.words || [],
    duration: transcription.duration || 0,
  };
}

/**
 * Remove noise markers and normalize whitespace from transcript text
 */
function cleanTranscript(text) {
  return text
    .replace(/\[.*?\]/g, '')       // Remove [Music], [Applause] etc.
    .replace(/\(.*?\)/g, '')       // Remove (inaudible) etc.
    .replace(/♪.*?♪/g, '')        // Remove music notes
    .replace(/\s{2,}/g, ' ')      // Collapse multiple spaces
    .replace(/\.{3,}/g, '...')    // Normalize ellipsis
    .trim();
}

/**
 * Group Whisper segments into clips of 15–45 seconds each
 * Tries to break at sentence boundaries for natural-feeling clips
 *
 * @param {Array} segments - Whisper segment objects with start/end/text
 * @param {number} minDuration - Minimum clip duration in seconds (default 15)
 * @param {number} maxDuration - Maximum clip duration in seconds (default 45)
 */
function buildClipSegments(segments, minDuration = 15, maxDuration = 45) {
  if (!segments || segments.length === 0) return [];

  const clips = [];
  let current = null;

  for (const seg of segments) {
    // Skip empty or very short segments
    if (!seg.text || seg.text.trim().length < 3) continue;

    if (!current) {
      current = {
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      };
    } else {
      const totalDuration = seg.end - current.start;

      if (totalDuration <= maxDuration) {
        // Keep extending current clip
        current.end = seg.end;
        current.text += ' ' + seg.text.trim();
      } else {
        // Save current clip if it meets minimum duration
        if (current.end - current.start >= minDuration) {
          clips.push({ ...current, text: current.text.trim() });
        }
        // Start a new clip from this segment
        current = {
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        };
      }
    }
  }

  // Don't forget the last clip
  if (current && current.end - current.start >= minDuration) {
    clips.push({ ...current, text: current.text.trim() });
  }

  return clips;
}

module.exports = { transcribeAudio, cleanTranscript, buildClipSegments };
