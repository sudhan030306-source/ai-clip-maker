/**
 * Copyright Risk Analyzer
 * Detects potential copyright issues in video clips using AI analysis
 * Checks for: background music, low commentary, reused content
 */

const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Analyze a clip's transcript for copyright risks
 *
 * @param {string} clipText    - Transcript text of the clip
 * @param {string} videoTitle  - Original video title for context
 * @returns {{ riskLevel, riskScore, issues, suggestions, safeToPost }}
 */
async function checkCopyrightRisk(clipText, videoTitle) {
  // Fast local heuristics before AI call
  const localRisk = localHeuristicCheck(clipText, videoTitle);

  // If clearly low risk, skip AI call to save tokens
  if (localRisk.riskLevel === 'low' && localRisk.confidence > 0.8) {
    return localRisk;
  }

  try {
    const prompt = `You are a YouTube/TikTok copyright compliance expert.

Analyze this video clip for copyright risk:
Video Title: "${videoTitle}"
Clip Transcript: "${clipText.slice(0, 800)}"

Check for these copyright risk factors:
1. BACKGROUND MUSIC: References to songs, lyrics, music playing in background
2. LOW COMMENTARY: If transcript is mostly silent, music-only, or very short speech
3. REUSED CONTENT: Clips of TV shows, movies, news broadcasts, other YouTube videos
4. READING CONTENT: Reading articles, books, scripts word-for-word
5. BRANDED CONTENT: Footage of sports events, concerts, branded content

Return ONLY JSON:
{
  "riskLevel": "<low|medium|high>",
  "riskScore": <0-100>,
  "issues": ["<specific issue found>"],
  "suggestions": ["<actionable suggestion to reduce risk>"],
  "safeToPost": <boolean>
}

If transcript shows original talking-head content with no music/media references, riskLevel = "low".`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('Copyright AI check failed, using local heuristics:', err.message);
  }

  return localRisk;
}

/**
 * Fast local heuristic check — no API call needed for obvious cases
 */
function localHeuristicCheck(text, title) {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();

  const issues = [];
  const suggestions = [];
  let riskScore = 0;

  // Check for music references
  if (/\b(song|music|lyrics|verse|chorus|beats|instrumental)\b/.test(lowerText)) {
    issues.push('Possible background music or music references detected');
    suggestions.push('Ensure background music is royalty-free or you have a license');
    riskScore += 35;
  }

  // Check for TV/movie/news content
  if (/\b(news|breaking|broadcast|episode|season|movie|film|show|channel)\b/.test(lowerText)) {
    issues.push('May contain broadcast or entertainment media content');
    suggestions.push('Ensure any third-party footage is properly licensed or fair use');
    riskScore += 25;
  }

  // Very short transcript might indicate mostly music/silent video
  if (text.split(' ').length < 20) {
    issues.push('Very short transcript — video may be mostly music or visuals');
    suggestions.push('Add more original commentary to increase fair use protection');
    riskScore += 20;
  }

  const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

  if (riskLevel === 'low') {
    suggestions.push('Looks like original spoken content — low copyright risk');
  }

  return {
    riskLevel,
    riskScore,
    issues,
    suggestions: suggestions.length > 0 ? suggestions : ['Original content — safe to post'],
    safeToPost: riskLevel === 'low',
    confidence: riskScore === 0 ? 0.9 : 0.6, // Used internally to decide if AI check needed
  };
}

module.exports = { checkCopyrightRisk };
