/**
 * AI Analysis Service
 * Uses Groq's LLaMA model to identify viral clip candidates
 * Enforces hook-first filtering and progressive threshold logic
 */

const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// WEAK opening patterns that fail the hook-first filter
const WEAK_OPENINGS = [
  /^(um|uh|so|and|well|okay|ok|alright|now|today|welcome|hello|hey|hi|in this video|in today)/i,
  /^(what('s| is) up|good (morning|afternoon|evening)|before we (start|begin|dive))/i,
  /^(make sure (you|to)|don't forget|subscribe|like and)/i,
  /^(we('re| are) going to|i('m| am) going to|let('s| us) (start|begin|talk|discuss))/i,
];

/**
 * Quick local hook check before sending to AI (saves tokens)
 */
function passesLocalHookCheck(text) {
  const firstSentence = text.split(/[.!?]/)[0]?.trim() || text.slice(0, 100);
  return !WEAK_OPENINGS.some(pattern => pattern.test(firstSentence));
}

/**
 * Analyze clip segments and score them for viral potential
 *
 * @param {Array} segments - Array of { start, end, text } objects
 * @param {string} videoTitle - Original video title for context
 * @returns {Array} Scored and filtered clip objects
 */
async function analyzeClips(segments, videoTitle = '') {
  if (segments.length === 0) throw new Error('No segments to analyze');

  // Pre-filter with local check to reduce API costs
  const segmentData = segments.map((s, i) => ({
    id: i,
    start: parseFloat(s.start.toFixed(1)),
    end: parseFloat(s.end.toFixed(1)),
    duration: Math.round(s.end - s.start),
    text: s.text,
    passesLocalHook: passesLocalHookCheck(s.text),
  }));

  const prompt = `You are an expert viral content analyst specializing in TikTok, YouTube Shorts, and Instagram Reels.

Video Title: "${videoTitle}"

Analyze these transcript segments and identify the MOST VIRAL clips.

Segments to analyze:
${JSON.stringify(segmentData, null, 2)}

EVALUATION CRITERIA:
1. HOOK STRENGTH (0-10): Does the FIRST SENTENCE immediately grab attention?
   - Strong: shocking stat, bold claim, question, story tease, controversy, humor
   - Weak: filler words, greetings, "in this video", slow build-up

2. EMOTIONAL TRIGGER (0-10): Does it create curiosity, surprise, inspiration, fear of missing out, or humor?

3. ENGAGEMENT POTENTIAL (0-10): Would viewers watch to the end? Would they share or comment?

HOOK-FIRST FILTER (MANDATORY):
REJECT any clip where passesLocalHook is false OR the opening is weak.
Strong hooks = questions, shocking claims, "I made X in Y days", "Nobody talks about...", controversy openers.

SCORING RULES:
- aiScore = (hookScore × 0.4) + (emotionalScore × 0.3) + (engagementScore × 0.3)
- Minimum aiScore to include: 6.0
- If fewer than 5 clips qualify at 6.0, progressively lower to 5.0 then 4.0
- Always return at least 5 clips (or all clips if fewer than 5 exist)
- MAX duration = 45 seconds — skip clips where duration > 45

Return ONLY valid JSON, no markdown, no explanation:
{
  "clips": [
    {
      "segmentId": <number>,
      "hookScore": <0-10>,
      "emotionalScore": <0-10>,
      "engagementScore": <0-10>,
      "aiScore": <0-10>,
      "hookType": "<question|shocking_stat|bold_claim|story_tease|controversy|humor|relatable|other>",
      "hookText": "<exact first sentence of the clip>",
      "title": "<punchy title for this clip, max 8 words>",
      "hook": "<one sentence explaining WHY this clip would go viral>",
      "passesHookFilter": <true|false>,
      "rejectReason": "<if false, brief reason>"
    }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content || '';

  // Safely extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI returned invalid JSON. Raw: ${content.slice(0, 200)}`);
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON');
  }

  const allClips = result.clips || [];

  // Apply hook filter and duration cap
  const validClips = allClips
    .filter(c => c.passesHookFilter && segments[c.segmentId])
    .filter(c => (segments[c.segmentId]?.end - segments[c.segmentId]?.start) <= 45)
    .sort((a, b) => b.aiScore - a.aiScore);

  // Progressive threshold: 6.0 → 5.0 → 4.0 to ensure at least 5 results
  let threshold = 6.0;
  let filtered = validClips.filter(c => c.aiScore >= threshold);

  while (filtered.length < 5 && threshold > 4.0) {
    threshold -= 0.5;
    filtered = validClips.filter(c => c.aiScore >= threshold);
  }

  // If still < 5, take all valid clips (video might just be short)
  if (filtered.length < 5) {
    filtered = validClips.slice(0, Math.max(validClips.length, 0));
  }

  console.log(`AI analysis: ${allClips.length} total → ${validClips.length} passed hook filter → ${filtered.length} returned (threshold: ${threshold})`);

  return filtered;
}

module.exports = { analyzeClips };
