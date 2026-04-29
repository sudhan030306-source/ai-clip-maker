'use client'

import { useState } from 'react'
import { ScoreRing } from './ScoreRing'
import { YouTubePreview } from './YouTubePreview'
import type { ViralClip, FontChoice } from '@/types'
import { FONT_OPTIONS } from '@/types'
import { api } from '@/lib/api'

interface ClipCardProps {
  clip: ViralClip
  rank: number
  globalFont: FontChoice
}

const RISK_COLORS = {
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const HOOK_TYPE_LABELS: Record<string, string> = {
  shocking_stat: '📊 Shocking Stat',
  bold_claim: '💥 Bold Claim',
  question: '❓ Question Hook',
  story_tease: '📖 Story Tease',
  controversy: '🔥 Controversy',
  humor: '😂 Humor',
  relatable: '💭 Relatable',
  other: '🎯 Strong Hook',
}

export function ClipCard({ clip, rank, globalFont }: ClipCardProps) {
  const [expanded, setExpanded] = useState(rank === 0) // First card open by default
  const [downloading, setDownloading] = useState(false)
  const [selectedFont, setSelectedFont] = useState<FontChoice>(globalFont)
  const [showCaptions, setShowCaptions] = useState(true)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const rankColors = ['from-yellow-500 to-amber-500', 'from-gray-400 to-gray-300', 'from-amber-700 to-amber-600']
  const rankGlow = ['shadow-yellow-500/30', 'shadow-gray-400/20', 'shadow-amber-600/20']

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    setDownloadUrl(null)

    try {
      const result = await api.generateClip({
        jobId: clip.jobId,
        clipIndex: clip.index,
        startTime: clip.startTime,
        endTime: clip.endTime,
        srtContent: showCaptions ? clip.srtContent : '',
        font: selectedFont,
      })

      setDownloadUrl(result.downloadUrl)

      // Auto-trigger download
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = `clip-${clip.index + 1}-${clip.title.slice(0, 30).replace(/\s+/g, '-')}.mp4`
      a.click()
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`glass rounded-2xl overflow-hidden glow-hover transition-all border border-white/5 ${expanded ? 'ring-1 ring-sky-500/20' : ''}`}>
      {/* ─── Header (always visible) ─────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-5 flex items-start gap-4 text-left hover:bg-white/2 transition-colors"
      >
        {/* Rank badge */}
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${rankColors[rank] || 'from-sky-600 to-sky-400'} flex items-center justify-center text-sm font-black shadow-lg ${rankGlow[rank] || ''} flex-shrink-0`}>
          #{rank + 1}
        </div>

        {/* Title + hook */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-white text-base">{clip.title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">
              {HOOK_TYPE_LABELS[clip.hookType] || '🎯 Strong Hook'}
            </span>
          </div>
          <p className="text-sm text-gray-400 line-clamp-2">{clip.hook}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-gray-500">
              ⏱ {Math.floor(clip.startTime / 60)}:{String(Math.floor(clip.startTime % 60)).padStart(2, '0')} → {Math.floor(clip.endTime / 60)}:{String(Math.floor(clip.endTime % 60)).padStart(2, '0')}
              ({clip.duration}s)
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${RISK_COLORS[clip.copyright.riskLevel]}`}>
              {clip.copyright.riskLevel === 'low' ? '✅' : clip.copyright.riskLevel === 'medium' ? '⚠️' : '❌'} {clip.copyright.riskLevel} risk
            </span>
          </div>
        </div>

        {/* Final score */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-black text-white">{clip.finalScore}</div>
          <div className="text-xs text-gray-500">/10 score</div>
        </div>

        <span className={`text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* ─── Expanded Body ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-white/5 p-5 space-y-5">
          {/* Score breakdown */}
          <div className="flex gap-4 justify-center flex-wrap">
            <ScoreRing score={clip.aiScore} size={72} label="AI Score" />
            <ScoreRing score={clip.youtubeTrendScore} size={72} label="YouTube" />
            <ScoreRing score={clip.socialTrendScore} size={72} label="Social" />
            <ScoreRing score={clip.searchDemandScore} size={72} label="Search" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-sky-600 to-purple-600 flex items-center justify-center">
                <span className="text-lg font-black">{clip.finalScore}</span>
              </div>
              <span className="text-xs text-gray-500">Final Score</span>
            </div>
          </div>

          {/* Video preview */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">📺 Preview</h4>
            <YouTubePreview
              videoId={clip.videoId}
              startTime={clip.startTime}
              endTime={clip.endTime}
              captions={clip.captions}
              font={selectedFont}
            />
          </div>

          {/* Hook text */}
          <div className="p-3 rounded-xl bg-dark-800 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">Opening hook</div>
            <div className="text-sm text-sky-300 italic">"{clip.hookText}"</div>
          </div>

          {/* Caption settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">🎨 Caption Style</h4>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCaptions}
                  onChange={e => setShowCaptions(e.target.checked)}
                  className="rounded accent-sky-500"
                />
                Include captions
              </label>
            </div>
            {showCaptions && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FONT_OPTIONS.map(font => (
                  <button
                    key={font}
                    onClick={() => setSelectedFont(font)}
                    className={`p-2 rounded-lg border text-sm transition-all ${
                      selectedFont === font
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-white/10 bg-dark-800 text-gray-400 hover:border-white/20'
                    }`}
                    style={{
                      fontFamily: font === 'Bebas Neue' ? "'Bebas Neue'" : font,
                      fontWeight: font === 'Bebas Neue' || font === 'Anton' ? 400 : 700,
                    }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copyright info */}
          {(clip.copyright.issues.length > 0 || clip.copyright.suggestions.length > 0) && (
            <div className={`p-4 rounded-xl border ${RISK_COLORS[clip.copyright.riskLevel]}`}>
              <h4 className="text-sm font-semibold mb-2">
                {clip.copyright.riskLevel === 'low' ? '✅' : '⚠️'} Copyright Analysis
              </h4>
              {clip.copyright.issues.map((issue, i) => (
                <p key={i} className="text-xs opacity-80 mb-1">• {issue}</p>
              ))}
              {clip.copyright.suggestions.slice(0, 2).map((s, i) => (
                <p key={i} className="text-xs opacity-70">💡 {s}</p>
              ))}
            </div>
          )}

          {/* Transcript preview */}
          <details className="group">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              View transcript
            </summary>
            <div className="mt-2 p-3 rounded-lg bg-dark-800 text-xs text-gray-400 leading-relaxed max-h-32 overflow-y-auto">
              {clip.transcript}
            </div>
          </details>

          {/* Download button */}
          <div className="pt-1">
            {downloadError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                ❌ {downloadError}
              </div>
            )}
            {downloadUrl && (
              <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                ✅ Clip ready!{' '}
                <a href={downloadUrl} className="underline" download>Click here if download didn't start</a>
              </div>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-purple-600 hover:opacity-90 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating clip...
                </>
              ) : (
                <>
                  ⬇️ Download MP4 {showCaptions ? `with ${selectedFont} captions` : '(no captions)'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
