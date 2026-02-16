import asyncHandler from '../middleware/asyncHandler.js';
import generateToken from '../utils/generateToken.js';

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = asyncHandler(async (req, res) => {
  // User is attached by Passport
  const user = req.user;

  if (user) {
    // Generate JWT token
    generateToken(res, user._id);

    // Redirect to frontend with success
    res.redirect(`${process.env.CLIENT_ORIGIN}?auth=success`);
  } else {
    // Redirect to frontend with error
    res.redirect(`${process.env.CLIENT_ORIGIN}?auth=failed`);
  }
});

// @desc    Get current authenticated user
// @route   GET /api/auth/current
// @access  Private
export const getCurrentUser = asyncHandler(async (req, res) => {
  if (req.user) {
    res.status(200).json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      avatar: req.user.avatar,
      handle: req.user.handle,
    });
  } else {
    res.status(401);
    throw new Error('Not authenticated');
  }
});