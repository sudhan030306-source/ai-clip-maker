'use client'

interface ScoreRingProps {
  score: number     // 0–10
  size?: number     // px
  label?: string
  color?: string
}

export function ScoreRing({ score, size = 64, label, color = '#0ea5e9' }: ScoreRingProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 10) * circumference

  const scoreColor =
    score >= 8 ? '#22c55e' :
    score >= 6 ? '#0ea5e9' :
    score >= 4 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"
          />
          {/* Score ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: scoreColor }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      {label && <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>}
    </div>
  )
}
