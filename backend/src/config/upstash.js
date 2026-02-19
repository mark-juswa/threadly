import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import dotenv from 'dotenv';

dotenv.config();

// Check if Upstash Redis is properly configured
const isRedisConfigured = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token && url.length > 0 && token.length > 0;
};

// Track Redis availability
let redisAvailable = false;
let ratelimit = null;

/**
 * Check if Redis is available for rate limiting
 */
export const isRedisAvailable = () => redisAvailable;

/**
 * Initialize Redis and rate limiter
 */
const initializeRatelimit = async () => {
  if (!isRedisConfigured()) {
    console.warn('⚠️  Global rate limiting disabled: Upstash Redis not configured');
    console.warn('   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment');
    return;
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test the connection
    await redis.ping();
    console.log('✅ Global rate limiting Redis connected');
    
    ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
    });
    
    redisAvailable = true;
  } catch (error) {
    console.error('⚠️  Global rate limiting disabled: Redis connection failed:', error.message || error);
    redisAvailable = false;
  }
};

// Initialize on module load (non-blocking)
initializeRatelimit().catch(err => {
  console.error('Rate limiter initialization error:', err.message || err);
});

// Create a proxy that handles null ratelimit gracefully
const ratelimitProxy = {
  limit: async (identifier) => {
    if (!redisAvailable || !ratelimit) {
      // Return success if Redis is not available (fail-open)
      return { success: true, limit: 0, remaining: 0, reset: 0 };
    }
    return ratelimit.limit(identifier);
  }
};

export default ratelimitProxy;