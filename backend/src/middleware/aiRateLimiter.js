const windows = new Map();

const limits = {
  note: { max: 20, windowMs: 60 * 60 * 1000 },
  group: { max: 10, windowMs: 60 * 60 * 1000 },
  category: { max: 5, windowMs: 60 * 60 * 1000 },
};

export const aiRateLimiter = (type) => (req, res, next) => {
  const config = limits[type] || limits.note;
  const userId = req.user?._id?.toString() || req.ip || 'unknown';
  const key = `${type}:${userId}`;
  const now = Date.now();
  const windowData = windows.get(key);

  if (!windowData || now > windowData.resetAt) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs });
    return next();
  }

  if (windowData.count >= config.max) {
    const retryAfter = Math.ceil((windowData.resetAt - now) / 1000);
    return res.status(429).json({
      message: 'AI request limit reached. Please try again later.',
      retryAfter,
    });
  }

  windowData.count += 1;
  next();
};
