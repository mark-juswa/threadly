import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Check if Upstash Redis is properly configured
const isRedisConfigured = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token && url.length > 0 && token.length > 0;
};

// Create Redis client only if configured
let redis = null;
let authRatelimit = null;
let oauthRatelimit = null;
let loginFailRatelimit = null;
let redisAvailable = false;

const initializeRateLimiters = async () => {
  if (!isRedisConfigured()) {
    console.warn('⚠️  Auth rate limiting disabled: Upstash Redis not configured');
    return;
  }

  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test connection with a simple ping
    await redis.ping();
    console.log('✅ Auth rate limiting Redis connected');
    redisAvailable = true;

    // Stricter rate limiter for authentication routes
    // Prevents brute force attacks on login/registration
    authRatelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 requests per 15 minutes per IP
      analytics: true,
      prefix: 'ratelimit:auth',
    });

    // Even stricter rate limiter for OAuth initiation
    // Prevents OAuth flood attacks
    oauthRatelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, '5 m'), // 5 OAuth attempts per 5 minutes per IP
      analytics: true,
      prefix: 'ratelimit:oauth',
    });

    // Rate limiter for failed login attempts (by email/username)
    loginFailRatelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, '30 m'), // 5 failed attempts per 30 minutes per identifier
      analytics: true,
      prefix: 'ratelimit:login-fail',
    });
  } catch (error) {
    console.error('⚠️  Auth rate limiting disabled: Redis connection failed:', error.message || error);
    redisAvailable = false;
  }
};

// Initialize on module load (non-blocking)
initializeRateLimiters().catch(err => {
  console.error('Auth rate limiter initialization error:', err.message || err);
});

/**
 * Middleware to rate limit authentication routes
 */
export const authRateLimiter = async (req, res, next) => {
  // Skip if Redis is not available
  if (!redisAvailable || !authRatelimit) {
    return next();
  }

  try {
    // Get client IP
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 
               'unknown';
    
    const { success, limit, remaining, reset } = await authRatelimit.limit(ip);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);
    
    if (!success) {
      console.warn(`Auth rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ 
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      });
    }
    
    next();
  } catch (error) {
    console.error('Auth rate limiting error (failing open):', error.message || error);
    // Fail open - allow request if rate limiting fails
    next();
  }
};

/**
 * Middleware to rate limit OAuth initiation
 */
export const oauthRateLimiter = async (req, res, next) => {
  // Skip if Redis is not available
  if (!redisAvailable || !oauthRatelimit) {
    return next();
  }

  try {
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 
               'unknown';
    
    const { success, limit, remaining, reset } = await oauthRatelimit.limit(ip);
    
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);
    
    if (!success) {
      console.warn(`OAuth rate limit exceeded for IP: ${ip}`);
      
      // For OAuth, redirect to frontend with error instead of JSON response
      const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      return res.redirect(`${clientOrigin}?auth=failed&error=rate_limited`);
    }
    
    next();
  } catch (error) {
    console.error('OAuth rate limiting error (failing open):', error.message || error);
    next();
  }
};

/**
 * Check and track failed login attempts by identifier (email/username)
 * Call this AFTER a failed login attempt
 */
export const trackFailedLogin = async (identifier) => {
  // Skip if Redis is not available
  if (!redisAvailable || !loginFailRatelimit) {
    return { blocked: false };
  }

  try {
    if (!identifier) return { blocked: false };
    
    const { success, remaining } = await loginFailRatelimit.limit(identifier.toLowerCase());
    
    if (!success) {
      console.warn(`Login blocked for identifier due to too many failed attempts: ${identifier}`);
      return { blocked: true, remaining: 0 };
    }
    
    return { blocked: false, remaining };
  } catch (error) {
    console.error('Failed login tracking error (failing open):', error.message || error);
    return { blocked: false };
  }
};

/**
 * Check if an identifier is currently rate limited (without consuming a token)
 */
export const isLoginBlocked = async (identifier) => {
  // Skip if Redis is not available
  if (!redisAvailable || !loginFailRatelimit) {
    return false;
  }

  try {
    if (!identifier) return false;
    
    // Use getRemaining to check without consuming
    const remaining = await loginFailRatelimit.getRemaining(identifier.toLowerCase());
    return remaining <= 0;
  } catch (error) {
    console.error('Login block check error (failing open):', error.message || error);
    return false;
  }
};

export default {
  authRateLimiter,
  oauthRateLimiter,
  trackFailedLogin,
  isLoginBlocked,
};
