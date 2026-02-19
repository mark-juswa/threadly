import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import crypto from 'crypto';
import User from '../models/User.js';

// Helper to determine the callback URL based on environment
const getCallbackURL = () => {
  // Always prefer explicit environment variable
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  
  // Auto-detect based on NODE_ENV and RENDER_EXTERNAL_URL (Render.com provides this)
  if (process.env.NODE_ENV === 'production') {
    const baseURL = process.env.RENDER_EXTERNAL_URL || process.env.API_BASE_URL;
    if (baseURL) {
      return `${baseURL}/api/auth/google/callback`;
    }
    console.error('❌ Production mode but no GOOGLE_CALLBACK_URL, RENDER_EXTERNAL_URL, or API_BASE_URL set!');
  }
  
  // Development fallback
  return 'http://localhost:5000/api/auth/google/callback';
};

// Store for OAuth state tokens (CSRF protection)
// In production, consider using Redis for distributed systems
const oauthStateStore = new Map();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes expiry
      oauthStateStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

// Generate secure state token for CSRF protection
export const generateOAuthState = () => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStateStore.set(state, { 
    timestamp: Date.now(),
    used: false 
  });
  return state;
};

// Validate and consume state token (one-time use)
export const validateOAuthState = (state) => {
  if (!state || typeof state !== 'string') {
    return false;
  }
  
  const stateData = oauthStateStore.get(state);
  if (!stateData) {
    return false;
  }
  
  // Check if already used (replay attack prevention)
  if (stateData.used) {
    oauthStateStore.delete(state);
    return false;
  }
  
  // Check if expired (10 minutes)
  if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
    oauthStateStore.delete(state);
    return false;
  }
  
  // Mark as used and delete
  stateData.used = true;
  oauthStateStore.delete(state);
  return true;
};

// Validate email domain (optional: restrict to specific domains)
const isEmailAllowed = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Optional: Block disposable email domains
  const blockedDomains = [
    'tempmail.com', 'throwaway.com', 'mailinator.com', 
    'guerrillamail.com', '10minutemail.com', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (blockedDomains.includes(domain)) {
    return false;
  }
  
  return true;
};

// Sanitize username to prevent injection
const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return 'user' + Math.random().toString(36).slice(-6);
  }
  
  // Remove special characters, keep only alphanumeric and underscores
  let sanitized = username.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Ensure minimum length
  if (sanitized.length < 3) {
    sanitized = sanitized + Math.random().toString(36).slice(-6);
  }
  
  // Truncate if too long
  if (sanitized.length > 30) {
    sanitized = sanitized.slice(0, 30);
  }
  
  return sanitized;
};

// Check if Google OAuth is configured
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
} else {
  const callbackURL = getCallbackURL();
  console.log('✅ Google OAuth configured');
  console.log(`   Callback URL: ${callbackURL}`);
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
        // Security: Only request necessary scopes
        scope: ['profile', 'email'],
        // Security: Use PKCE if available (passport-google-oauth20 doesn't support it directly)
        passReqToCallback: true, // Pass request to callback for state validation
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Security: Validate that we received expected profile data
          if (!profile || !profile.id) {
            console.error('Google OAuth: Invalid profile received');
            return done(new Error('Invalid profile data from Google'), null);
          }
          
          if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
            console.error('Google OAuth: No email in profile');
            return done(new Error('Email is required for registration'), null);
          }
          
          const email = profile.emails[0].value.toLowerCase().trim();
          
          // Security: Validate email
          if (!isEmailAllowed(email)) {
            console.error('Google OAuth: Email not allowed:', email);
            return done(new Error('Email domain not allowed'), null);
          }
          
          // Security: Verify email is verified by Google
          if (profile.emails[0].verified === false) {
            console.error('Google OAuth: Email not verified by Google');
            return done(new Error('Email must be verified with Google'), null);
          }
          
          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // User exists, update last login info
            user.lastLoginAt = new Date();
            user.lastLoginIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
            await user.save();
            return done(null, user);
          }

          // Check if user exists with this email
          user = await User.findOne({ email: email });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.avatar = profile.photos[0]?.value || user.avatar;
            user.lastLoginAt = new Date();
            user.lastLoginIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
            await user.save();
            return done(null, user);
          }

          // Create new user with sanitized data
          const baseUsername = sanitizeUsername(email.split('@')[0]);
          
          // Ensure unique username
          let username = baseUsername;
          let attempts = 0;
          while (await User.findOne({ username }) && attempts < 10) {
            username = baseUsername + Math.random().toString(36).slice(-4);
            attempts++;
          }
          
          const newUser = await User.create({
            googleId: profile.id,
            username: username,
            email: email,
            avatar: profile.photos[0]?.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || username)}&background=random`,
            // No password needed for OAuth users (schema allows this)
            lastLoginAt: new Date(),
            lastLoginIP: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          });

          console.log(`New user registered via Google OAuth: ${email}`);
          done(null, newUser);
        } catch (error) {
          console.error('Google OAuth error:', error);
          done(error, null);
        }
      }
    )
  );

  // Serialize user to store in session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

export default passport;