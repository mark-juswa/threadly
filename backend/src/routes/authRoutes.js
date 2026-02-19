import express from 'express';
import passport from 'passport';
import { googleCallback, getCurrentUser, logoutUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { generateOAuthState, validateOAuthState } from '../config/passport.js';
import { authRateLimiter, oauthRateLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

// Helper to get client origin safely
const getClientOrigin = () => {
  return process.env.CLIENT_ORIGIN || 'http://localhost:5173';
};

// @desc    Initiate Google OAuth with CSRF protection
// @route   GET /api/auth/google
// @access  Public
router.get('/google', oauthRateLimiter, (req, res, next) => {
  // Generate a unique state token for CSRF protection
  const state = generateOAuthState();
  
  // Store state in a short-lived cookie for verification
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' is needed for OAuth redirects
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });
  
  // Initiate OAuth with state parameter
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state,
    prompt: 'select_account', // Always show account selector for security
    accessType: 'online', // Don't request refresh token (we use our own JWT)
  })(req, res, next);
});

// @desc    Google OAuth callback with state validation
// @route   GET /api/auth/google/callback
// @access  Public
router.get('/google/callback', authRateLimiter, (req, res, next) => {
  const clientOrigin = getClientOrigin();
  
  // Validate state parameter to prevent CSRF attacks
  const returnedState = req.query.state;
  const storedState = req.cookies?.oauth_state;
  
  // Clear the state cookie immediately
  res.clearCookie('oauth_state', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  
  // Verify state matches
  if (!returnedState || !storedState || returnedState !== storedState) {
    console.error('OAuth state mismatch - possible CSRF attack');
    console.error(`Returned state: ${returnedState ? 'present' : 'missing'}`);
    console.error(`Stored state: ${storedState ? 'present' : 'missing'}`);
    return res.redirect(`${clientOrigin}?auth=failed&error=invalid_state`);
  }
  
  // Validate the state token (one-time use)
  if (!validateOAuthState(returnedState)) {
    console.error('OAuth state validation failed - token expired or reused');
    return res.redirect(`${clientOrigin}?auth=failed&error=state_expired`);
  }
  
  // Check for OAuth errors from Google
  if (req.query.error) {
    console.error('Google OAuth error:', req.query.error);
    return res.redirect(`${clientOrigin}?auth=failed&error=${encodeURIComponent(req.query.error)}`);
  }
  
  // Proceed with authentication
  passport.authenticate('google', {
    failureRedirect: `${clientOrigin}?auth=failed&error=auth_failed`,
    session: false, // We use JWT, not sessions
  })(req, res, (err) => {
    if (err) {
      console.error('Passport authentication error:', err);
      return res.redirect(`${clientOrigin}?auth=failed&error=server_error`);
    }
    // Call the googleCallback controller
    googleCallback(req, res, next);
  });
});

// @desc    Get current user (for checking auth status)
// @route   GET /api/auth/current
// @access  Private
router.get('/current', protect, getCurrentUser);

// @desc    Logout user (clear JWT cookie)
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, logoutUser);

// @desc    Health check for auth service
// @route   GET /api/auth/health
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    googleOAuth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;