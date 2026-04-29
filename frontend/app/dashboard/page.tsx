'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { UserProfile } from '@/types'

const STEPS = [
  { icon: '⬇️', label: 'Downloading video' },
  { icon: '🎵', label: 'Extracting audio' },
  { icon: '🎙️', label: 'Transcribing with Whisper' },
  { icon: '🤖', label: 'AI clip detection' },
  { icon: '📊', label: 'Scoring virality' },
  { icon: '✍️', label: 'Generating captions' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])

  // Auth + profile load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push('/login')
      loadProfile()
      loadHistory()
    })
  }, [])

  // Cycle through steps during analysis (visual feedback)
  useEffect(() => {
    if (!analyzing) return
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, 8000)
    return () => clearInterval(interval)
  }, [analyzing])

  async function loadProfile() {
    try {
      const data = await api.getProfile()
      setProfile(data)
    } catch (e) { /* silent */ }
  }

  async function loadHistory() {
    try {
      const data = await api.getHistory()
      setHistory(data.jobs || [])
    } catch (e) { /* silent */ }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setError(null)
    setAnalyzing(true)
    setCurrentStep(0)

    try {
      const result = await api.analyzeVideo(url.trim())
      // Navigate to results page with job data
      router.push(`/results/${result.jobId}`)
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.')
      setAnalyzing(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const creditColor = !profile ? 'text-gray-400'
    : profile.credits === 0 ? 'text-red-400'
    : profile.credits === 1 ? 'text-yellow-400'
    : 'text-green-400'

  return (
    <div className="min-h-screen bg-dark-900">
      {/* ─── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-dark-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span className="font-bold gradient-text hidden sm:block">AI Viral Clip Extractor</span>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 border border-white/5">
                <span className="text-xs text-gray-400">Credits</span>
                <span className={`text-sm font-bold ${creditColor}`}>{profile.credits}</span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* ─── Hero ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 gradient-text">
            Extract Viral Clips
          </h1>
          <p className="text-gray-400 text-lg">
            Paste any YouTube URL. AI finds the most viral moments in seconds.
          </p>
        </div>

        {/* ─── URL Input ────────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-6 mb-8">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                YouTube Video URL
              </label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={analyzing}
                  className="flex-1 px-4 py-3 rounded-xl bg-dark-800 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={analyzing || !url.trim() || profile?.credits === 0}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 whitespace-nowrap"
                >
                  {analyzing ? 'Analyzing...' : '✨ Analyze'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Maximum video length: 20 minutes • 1 credit per analysis</p>
            </div>

            {/* No credits warning */}
            {profile?.credits === 0 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                ⚠️ You have no credits remaining. Contact support to get more.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* ─── Processing State ─────────────────────────────────────────────── */}
        {analyzing && (
          <div className="glass rounded-2xl p-8 mb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-5 relative">
              <div className="absolute inset-0 rounded-full border-4 border-sky-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-sky-500 animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">
                {STEPS[currentStep]?.icon}
              </span>
            </div>

            <h3 className="text-lg font-semibold mb-1">{STEPS[currentStep]?.label}</h3>
            <p className="text-gray-400 text-sm mb-6">This takes 1–3 minutes depending on video length</p>

            {/* Step progress */}
            <div className="flex justify-center gap-2 flex-wrap">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                    i < currentStep
                      ? 'bg-sky-500/20 text-sky-400'
                      : i === currentStep
                      ? 'bg-sky-500/30 text-sky-300 ring-1 ring-sky-500/50'
                      : 'bg-dark-800 text-gray-600'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span className="hidden sm:block">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Fake progress bar */}
            <div className="mt-5 h-1 bg-dark-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full processing-bar" />
            </div>
          </div>
        )}

        {/* ─── How it works ─────────────────────────────────────────────────── */}
        {!analyzing && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: '🔍', title: 'Hook Detection', desc: 'AI finds powerful opening moments' },
              { icon: '📊', title: 'Virality Scoring', desc: 'Multi-platform score across YouTube & Social' },
              { icon: '✍️', title: 'Auto Captions', desc: 'Short-form optimized SRT captions' },
              { icon: '⚖️', title: 'Copyright Check', desc: 'Risk analysis before you post' },
              { icon: '🎨', title: 'Font Styles', desc: '4 viral-proven caption fonts' },
              { icon: '⬇️', title: 'MP4 Download', desc: 'Burned-in captions, ready to post' },
            ].map((f) => (
              <div key={f.title} className="glass rounded-xl p-4 glow-hover transition-all">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-sm font-semibold text-white mb-1">{f.title}</div>
                <div className="text-xs text-gray-500">{f.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── History ──────────────────────────────────────────────────────── */}
        {history.length > 0 && !analyzing && (
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <span>🕐</span> Recent Analyses
            </h2>
            <div className="space-y-2">
              {history.map((job) => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/results/${job.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                >
                  {job.video_thumbnail && (
                    <img
                      src={job.video_thumbnail}
                      alt=""
                      className="w-16 h-10 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate group-hover:text-sky-400 transition-colors">
                      {job.video_title || 'Unknown title'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {job.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
