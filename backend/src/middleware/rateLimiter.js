import ratelimit, { isRedisAvailable } from "../config/upstash.js";

const ratelimiter = async (req, res, next) => {
    try {
        // Skip rate limiting if Redis is not available
        if (!isRedisAvailable()) {
            console.warn('Rate limiting skipped: Redis not available');
            return next();
        }

        // Use IP address as the rate limit key for per-client limiting
        const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
        const {success} = await ratelimit.limit(ip);
        if (!success) {
            return res.status(429).json({ 
                message: 'Too many requests, please try again later.' 
            });
        }
        next();
    } catch (error) {
        // Log the error but don't block the request (fail-open)
        console.error('Rate limiting error (failing open):', error.message || error);
        // Allow request to proceed when rate limiting fails
        next();
    }
}

export default ratelimiter;