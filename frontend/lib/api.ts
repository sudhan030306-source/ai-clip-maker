/**
 * API Client
 * Thin wrapper around fetch for all backend API calls
 * Automatically attaches Supabase auth token
 */

import { createClient } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Get current user's JWT token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Authenticated fetch wrapper
 */
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken()

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed: ${res.status}`)
  }

  return data
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export const api = {
  /** Analyze a YouTube video — returns clips */
  analyzeVideo: (url: string) =>
    apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  /** Fetch existing job results */
  getJob: (jobId: string) =>
    apiFetch(`/api/analyze/${jobId}`),

  /** Get user profile + credits */
  getProfile: () =>
    apiFetch('/api/auth/profile'),

  /** Get analysis history */
  getHistory: (page = 1) =>
    apiFetch(`/api/auth/history?page=${page}`),

  /** Generate (download) a clip with captions */
  generateClip: (params: {
    jobId: string
    clipIndex: number
    startTime: number
    endTime: number
    srtContent: string
    font: string
  }) =>
    apiFetch('/api/generate-clip', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}
