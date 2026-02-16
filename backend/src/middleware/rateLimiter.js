import ratelimit from "../config/upstash.js";

const ratelimiter = async (req, res, next) => {
    try {
        // Use IP address as the rate limit key for per-client limiting
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const {success} = await ratelimit.limit(ip);
        if (!success) {
            return res.status(429).json({ 
                message: 'Too many requests, please try again later.' 
            });
        }
        next();
    } catch (error) {
        console.error('Rate limiting error:', error);
        next(error);
    }
}

export default ratelimiter;