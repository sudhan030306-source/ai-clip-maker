/**
 * Caption Generator Service
 * Generates SRT captions optimized for short-form video
 * Targets 6–8 words per line, 1–2 lines max, clean punctuation
 */

/**
 * Generate SRT caption content for a clip
 *
 * @param {Array}  words      - Word-level timing objects from Whisper
 * @param {number} clipStart  - Clip start time in seconds (absolute)
 * @param {number} clipEnd    - Clip end time in seconds (absolute)
 * @returns {string}          - SRT formatted string
 */
function generateSRT(words, clipStart, clipEnd) {
  if (!words || words.length === 0) return '';

  // Filter words that fall within this clip's time range
  const clipWords = words.filter(
    w => w.start >= clipStart - 0.1 && w.end <= clipEnd + 0.1
  );

  if (clipWords.length === 0) return '';

  const captions = [];
  let captionIndex = 1;
  let group = [];
  let groupStart = null;

  const MAX_WORDS = 7;
  const MAX_DURATION = 2.8; // Max seconds per caption block

  for (let i = 0; i < clipWords.length; i++) {
    const word = clipWords[i];
    const wordText = (word.word || word.text || '').trim();
    if (!wordText) continue;

    if (groupStart === null) groupStart = word.start;
    group.push({ text: wordText, end: word.end });

    const isLastWord = i === clipWords.length - 1;
    const groupDuration = word.end - groupStart;
    const endsWithPunct = /[.!?,;]$/.test(wordText);

    const shouldFlush =
      group.length >= MAX_WORDS ||
      groupDuration >= MAX_DURATION ||
      isLastWord ||
      (endsWithPunct && group.length >= 3);

    if (shouldFlush && group.length > 0) {
      const lineText = cleanCaptionText(group.map(w => w.text).join(' '));
      const lineEnd = group[group.length - 1].end;

      if (lineText.length > 0) {
        // Timestamps are relative to clip start (so they work in the SRT)
        const startTs = formatSRTTime(groupStart - clipStart);
        const endTs = formatSRTTime(lineEnd - clipStart);

        captions.push(`${captionIndex}\n${startTs} --> ${endTs}\n${lineText}`);
        captionIndex++;
      }

      group = [];
      groupStart = null;
    }
  }

  return captions.join('\n\n');
}

/**
 * Clean up caption text: fix punctuation, remove noise
 */
function cleanCaptionText(text) {
  return text
    .replace(/\s([,.!?;:])/g, '$1')   // Remove space before punctuation
    .replace(/\s+/g, ' ')              // Collapse spaces
    .replace(/^[,\s]+/, '')            // Remove leading punctuation
    .replace(/[♪✓→←]+/g, '')          // Remove symbols
    .trim();
}

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatSRTTime(seconds) {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ].join(':') + ',' + String(ms).padStart(3, '0');
}

/**
 * Parse SRT string into array of caption objects for frontend overlay
 *
 * @param {string} srtContent - Full SRT formatted string
 * @returns {Array} [{ index, start, end, text }]
 */
function parseSRTForFrontend(srtContent) {
  if (!srtContent || !srtContent.trim()) return [];

  const blocks = srtContent.split('\n\n').filter(b => b.trim());

  return blocks.map(block => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) return null;

    const [startStr, endStr] = lines[1].split(' --> ');
    return {
      index: parseInt(lines[0], 10),
      start: parseSRTTime(startStr?.trim()),
      end: parseSRTTime(endStr?.trim()),
      text: lines.slice(2).join('\n').trim(),
    };
  }).filter(Boolean);
}

/**
 * Parse SRT timestamp to seconds
 */
function parseSRTTime(timeStr) {
  if (!timeStr) return 0;
  const [time, ms] = timeStr.split(',');
  const parts = time.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + (parseInt(ms) || 0) / 1000;
}

module.exports = { generateSRT, formatSRTTime, parseSRTForFrontend };
