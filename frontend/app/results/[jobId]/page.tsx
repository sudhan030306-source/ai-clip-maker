'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { api } from '@/lib/api'
import { ClipCard } from '@/components/ClipCard'
import type { AnalysisResult, FontChoice } from '@/types'

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globalFont, setGlobalFont] = useState<FontChoice>('Montserrat')
  const [sortBy, setSortBy] = useState<'finalScore' | 'aiScore' | 'duration'>('finalScore')

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push('/login')
      fetchResults()
    })
  }, [jobId])

  async function fetchResults() {
    setLoading(true)
    try {
      const data = await api.getJob(jobId)
      if (!data.results) throw new Error('Results not yet available')
      setResult({
        success: true,
        jobId: data.id,
        videoTitle: data.video_title,
        videoThumbnail: data.video_thumbnail,
        videoDuration: data.video_duration,
        clips: data.results,
        creditsRemaining: 0,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const sortedClips = result?.clips.slice().sort((a, b) => {
    if (sortBy === 'duration') return a.duration - b.duration
    return (b as any)[sortBy] - (a as any)[sortBy]
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to load results</h2>
          <p className="text-gray-400 mb-6 text-sm">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* ─── Sticky Nav ───────────────────────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-dark-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← Dashboard
          </button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm text-white font-medium truncate flex-1">{result?.videoTitle}</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ─── Video Info Banner ───────────────────────────────────────── */}
        {result && (
          <div className="glass rounded-2xl p-5 mb-6 flex gap-4 items-center">
            {result.videoThumbnail && (
              <img
                src={result.videoThumbnail}
                alt={result.videoTitle}
                className="w-24 h-16 object-cover rounded-xl flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-white text-lg leading-tight truncate">{result.videoTitle}</h1>
              <div className="flex gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  {result.clips.length} viral clips found
                </span>
                <span className="text-xs text-gray-400">
                  Video: {Math.floor(result.videoDuration / 60)}m {result.videoDuration % 60}s
                </span>
                <span className="text-xs text-green-400">
                  ✅ Analysis complete
                </span>
              </div>
            </div>

            {/* Top score */}
            <div className="text-right flex-shrink-0">
              <div className="text-3xl font-black gradient-text">
                {result.clips[0]?.finalScore?.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">Top clip score</div>
            </div>
          </div>
        )}

        {/* ─── Controls ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold text-white">
            🏆 Viral Clips ({result?.clips.length})
          </h2>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Global font selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Default font:</span>
              <select
                value={globalFont}
                onChange={e => setGlobalFont(e.target.value as FontChoice)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-dark-800 border border-white/10 text-gray-300 focus:outline-none focus:border-sky-500"
              >
                <option>Montserrat</option>
                <option>Poppins</option>
                <option>Bebas Neue</option>
                <option>Anton</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-dark-800 border border-white/10 text-gray-300 focus:outline-none focus:border-sky-500"
              >
                <option value="finalScore">Final Score</option>
                <option value="aiScore">AI Score</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── Scoring Legend ───────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            { label: 'AI × 0.5', color: 'text-sky-400' },
            { label: 'YouTube × 0.2', color: 'text-red-400' },
            { label: 'Social × 0.2', color: 'text-purple-400' },
            { label: 'Search × 0.1', color: 'text-green-400' },
          ].map(({ label, color }) => (
            <span key={label} className={`text-xs px-2.5 py-1 rounded-full bg-dark-800 border border-white/5 ${color}`}>
              {label}
            </span>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 font-medium">
            = Final Score
          </span>
        </div>

        {/* ─── Clip Cards ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          {sortedClips?.map((clip, i) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              rank={i}
              globalFont={globalFont}
            />
          ))}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all text-sm"
          >
            ← Analyze another video
          </button>
        </div>
      </main>
    </div>
  )
}
