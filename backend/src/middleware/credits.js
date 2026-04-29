/**
 * Credits Middleware
 * Checks user has credits before allowing analysis
 * Provides deductCredit utility for route handlers
 */

/**
 * Middleware: verify user has at least 1 credit remaining
 * Must be called after authenticateUser (requires req.user + req.supabase)
 */
async function checkCredits(req, res, next) {
  const { user, supabase } = req;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  if (profile.credits <= 0) {
    return res.status(402).json({
      error: 'Insufficient credits',
      credits: 0,
      message: 'You have no credits remaining. Please contact support to get more.',
    });
  }

  // Store for use in route handler
  req.userCredits = profile.credits;
  next();
}

/**
 * Deduct one credit from user using a safe DB function
 * Uses GREATEST(credits - 1, 0) to prevent negative credits
 */
async function deductCredit(supabase, userId) {
  const { error } = await supabase.rpc('decrement_user_credits', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Failed to deduct credit:', error);
    throw new Error('Failed to deduct credit');
  }
}

module.exports = { checkCredits, deductCredit };
