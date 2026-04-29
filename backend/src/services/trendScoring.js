/**
 * Trend Scoring Service
 * Generates platform-specific virality scores and computes weighted final score
 *
 * Formula: (AI × 0.5) + (YouTube × 0.2) + (Social × 0.2) + (Search × 0.1)
 *
 * Note: Real-time trend data requires paid APIs (YouTube Data API, Google Trends).
 * This service uses AI estimation based on content analysis — accurate enough for MVP.
 */

const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Score clips across multiple platforms
 *
 * @param {Array} clips    - Analyzed clip objects from aiAnalysis
 * @param {Array} segments - Original transcript segments
 * @param {string} videoTitle
 * @returns {Array} Clips with added trend scores and finalScore
 */
async function scoreTrends(clips, segments, videoTitle) {
  if (clips.length === 0) return [];

  const clipData = clips.map(c => ({
    segmentId: c.segmentId,
    title: c.title,
    hookType: c.hookType,
    text: segments[c.segmentId]?.text?.slice(0, 200) || '',
  }));

  const prompt = `You are a social media trend analyst. Estimate platform virality scores for these video clips.

Video: "${videoTitle}"

Clips:
${JSON.stringify(clipData, null, 2)}

Score each clip (0.0–10.0) for:

1. youtubeTrendScore: Fit with current YouTube trending patterns
   - 8-10: Evergreen how-to, reaction to viral news, strong educational value
   - 5-7:  Niche topic with decent audience, moderate educational/entertainment value
   - 0-4:  Very niche or low-engagement format

2. socialTrendScore: TikTok/Reels/Shorts virality
   - 8-10: Highly relatable, shareable, trending topic, emotional hook
   - 5-7:  Entertaining or informative but not immediately shareable
   - 0-4:  Too long-form for short-video audiences

3. searchDemandScore: Google/YouTube search volume estimate
   - 8-10: High-demand evergreen topic (health, money, relationships, tech)
   - 5-7:  Moderate search interest
   - 0-4:  Very niche or no obvious search intent

Return ONLY JSON:
{
  "scores": [
    {
      "segmentId": <number>,
      "youtubeTrendScore": <0-10>,
      "socialTrendScore": <0-10>,
      "searchDemandScore": <0-10>
    }
  ]
}`;

  let trendScores = [];

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Faster/cheaper model for scoring
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      trendScores = JSON.parse(jsonMatch[0]).scores || [];
    }
  } catch (err) {
    console.warn('Trend scoring AI call failed, using defaults:', err.message);
    // Fall through with empty array — defaults applied below
  }

  // Merge scores with clip data and calculate final weighted score
  return clips.map(clip => {
    const trend = trendScores.find(s => s.segmentId === clip.segmentId) || {};

    const ytScore = clamp(trend.youtubeTrendScore ?? 5.5, 0, 10);
    const socialScore = clamp(trend.socialTrendScore ?? 5.5, 0, 10);
    const searchScore = clamp(trend.searchDemandScore ?? 5.0, 0, 10);
    const aiScore = clamp(clip.aiScore, 0, 10);

    // Weighted virality formula
    const finalScore = parseFloat(
      (aiScore * 0.5 + ytScore * 0.2 + socialScore * 0.2 + searchScore * 0.1).toFixed(1)
    );

    return {
      ...clip,
      youtubeTrendScore: parseFloat(ytScore.toFixed(1)),
      socialTrendScore: parseFloat(socialScore.toFixed(1)),
      searchDemandScore: parseFloat(searchScore.toFixed(1)),
      finalScore,
    };
  });
}

function clamp(val, min, max) {
  return Math.min(Math.max(Number(val) || min, min), max);
}

module.exports = { scoreTrends };
