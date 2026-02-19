import asyncHandler from '../middleware/asyncHandler.js';
import generateToken from '../utils/generateToken.js';

// Helper to get client origin safely with validation
const getClientOrigin = () => {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  
  // Security: Validate the origin is a proper URL
  try {
    const url = new URL(origin);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.error('Invalid CLIENT_ORIGIN protocol');
      return 'http://localhost:5173';
    }
    return origin;
  } catch (e) {
    console.error('Invalid CLIENT_ORIGIN URL:', origin);
    return 'http://localhost:5173';
  }
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = asyncHandler(async (req, res) => {
  const clientOrigin = getClientOrigin();
  
  // User is attached by Passport
  const user = req.user;

  if (user) {
    // Security: Validate user object has required fields
    if (!user._id) {
      console.error('OAuth callback: Invalid user object - missing _id');
      return res.redirect(`${clientOrigin}?auth=failed&error=invalid_user`);
    }
    
    // Security: Check if user account is active
    if (user.isActive === false) {
      console.error('OAuth callback: User account is deactivated');
      return res.redirect(`${clientOrigin}?auth=failed&error=account_disabled`);
    }
    
    // Generate JWT token with enhanced security
    generateToken(res, user._id);

    // Security: Log successful authentication for audit trail
    console.log(`OAuth login successful: ${user.email} from IP: ${req.ip || 'unknown'}`);

    // Redirect to frontend with success
    // Note: We use a short-lived success indicator, the actual auth is via httpOnly cookie
    res.redirect(`${clientOrigin}?auth=success`);
  } else {
    console.error('OAuth callback: No user attached to request');
    // Redirect to frontend with error
    res.redirect(`${clientOrigin}?auth=failed&error=no_user`);
  }
});

// @desc    Get current authenticated user
// @route   GET /api/auth/current
// @access  Private
export const getCurrentUser = asyncHandler(async (req, res) => {
  if (req.user) {
    // Security: Only return necessary, non-sensitive user information
    res.status(200).json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      avatar: req.user.avatar,
      handle: req.user.handle,
      // Don't expose: password, googleId, lastLoginIP, etc.
    });
  } else {
    res.status(401);
    throw new Error('Not authenticated');
  }
});

// @desc    Logout user (clear JWT cookie)
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = asyncHandler(async (req, res) => {
  // Clear the JWT cookie
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    expires: new Date(0), // Expire immediately
  });
  
  // Also clear any OAuth-related cookies
  res.clearCookie('oauth_state');
  
  res.status(200).json({ message: 'Logged out successfully' });
});