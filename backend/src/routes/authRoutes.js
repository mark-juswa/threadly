import express from 'express';
import passport from 'passport';
import { googleCallback, getCurrentUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Initiate Google OAuth
// @route   GET /api/auth/google
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_ORIGIN}?auth=failed`,
    session: false, // We use JWT, not sessions
  }),
  googleCallback
);

// @desc    Get current user (for checking auth status)
// @route   GET /api/auth/current
// @access  Private
router.get('/current', protect, getCurrentUser);

export default router;