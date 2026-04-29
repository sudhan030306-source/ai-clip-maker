// ─── Clip Types ───────────────────────────────────────────────────────────────

export interface Caption {
  index: number
  start: number   // seconds (relative to clip)
  end: number
  text: string
}

export interface CopyrightRisk {
  riskLevel: 'low' | 'medium' | 'high'
  riskScore: number
  issues: string[]
  suggestions: string[]
  safeToPost: boolean
}

export interface ViralClip {
  id: string
  jobId: string
  index: number
  videoId: string
  title: string
  hook: string
  hookType: string
  hookText: string
  startTime: number      // seconds in original video
  endTime: number
  duration: number
  transcript: string
  // Scores
  aiScore: number
  youtubeTrendScore: number
  socialTrendScore: number
  searchDemandScore: number
  finalScore: number
  // Captions
  srtContent: string
  captions: Caption[]
  // Copyright
  copyright: CopyrightRisk
}

export interface AnalysisResult {
  success: boolean
  jobId: string
  videoTitle: string
  videoThumbnail: string
  videoDuration: number
  clips: ViralClip[]
  creditsRemaining: number
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  credits: number
  createdAt: string
}

export type FontChoice = 'Montserrat' | 'Poppins' | 'Bebas Neue' | 'Anton'

export const FONT_OPTIONS: FontChoice[] = ['Montserrat', 'Poppins', 'Bebas Neue', 'Anton']

export const FONT_CSS_CLASS: Record<FontChoice, string> = {
  'Montserrat': 'caption-montserrat',
  'Poppins':    'caption-poppins',
  'Bebas Neue': 'caption-bebas',
  'Anton':      'caption-anton',
}
