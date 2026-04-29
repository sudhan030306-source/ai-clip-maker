'use client'

import { useEffect, useRef, useState } from 'react'
import type { Caption, FontChoice } from '@/types'
import { FONT_CSS_CLASS } from '@/types'

interface YouTubePreviewProps {
  videoId: string
  startTime: number
  endTime: number
  captions: Caption[]
  font: FontChoice
}

export function YouTubePreview({
  videoId,
  startTime,
  endTime,
  captions,
  font,
}: YouTubePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [currentCaption, setCurrentCaption] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Simulate elapsed time to drive caption display
  // (YouTube iframe doesn't expose currentTime without YouTube API)
  useEffect(() => {
    if (!playing) return

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 0.25
        const clipDuration = endTime - startTime
        if (next >= clipDuration) {
          setPlaying(false)
          return 0
        }
        return next
      })
    }, 250)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, endTime, startTime])

  // Match caption to elapsed time
  useEffect(() => {
    const active = captions.find(c => elapsed >= c.start && elapsed < c.end)
    setCurrentCaption(active?.text || '')
  }, [elapsed, captions])

  const fontClass = FONT_CSS_CLASS[font]

  // YouTube embed URL with start time
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&end=${Math.ceil(endTime)}&autoplay=0&rel=0&modestbranding=1`

  return (
    <div className="relative rounded-xl overflow-hidden bg-black group">
      {/* 9:16 aspect ratio container for short-form preview */}
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Video preview"
        />

        {/* Caption overlay — positioned over the iframe */}
        {currentCaption && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-10 px-4">
            <div
              className={`${fontClass} text-center px-3 py-1`}
              style={{
                fontSize: 'clamp(14px, 2.5vw, 18px)',
                color: '#ffffff',
                textShadow: '2px 2px 4px #000, -1px -1px 3px #000, 0 0 8px #000',
                lineHeight: 1.3,
                maxWidth: '90%',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: 6,
              }}
            >
              {currentCaption}
            </div>
          </div>
        )}
      </div>

      {/* Caption preview controls */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <span>
            {Math.floor(startTime / 60)}:{String(Math.floor(startTime % 60)).padStart(2, '0')} →{' '}
            {Math.floor(endTime / 60)}:{String(Math.floor(endTime % 60)).padStart(2, '0')}
          </span>
          <button
            onClick={() => { setElapsed(0); setPlaying(p => !p) }}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            {playing ? '⏸ Pause preview' : '▶ Preview captions'}
          </button>
        </div>
      </div>
    </div>
  )
}
