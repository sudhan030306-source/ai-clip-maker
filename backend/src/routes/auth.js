/**
 * /api/auth Route
 * Handles user profile creation, credit checks, and history retrieval
 * Authentication (login/signup) is handled entirely on the frontend via Supabase Auth
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');

// ─── GET /api/auth/profile ────────────────────────────────────────────────────
// Returns user profile including current credits
router.get('/profile', authenticateUser, async (req, res) => {
  const { supabase, user } = req;

  // Attempt to get existing profile
  let { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, email, credits, created_at')
    .eq('id', user.id)
    .single();

  // Auto-create profile on first login (Supabase trigger may not fire immediately)
  if (error && error.code === 'PGRST116') {
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        credits: 2, // New users get 2 free credits
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Failed to create user profile' });
    }
    profile = newProfile;
  } else if (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }

  return res.json({
    id: profile.id,
    email: profile.email,
    credits: profile.credits,
    createdAt: profile.created_at,
  });
});

// ─── GET /api/auth/history ────────────────────────────────────────────────────
// Returns past analysis jobs for this user
router.get('/history', authenticateUser, async (req, res) => {
  const { supabase, user } = req;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('analysis_jobs')
    .select('id, youtube_url, video_title, video_thumbnail, status, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch history' });
  }

  return res.json({
    jobs: data,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  });
});

module.exports = router;
