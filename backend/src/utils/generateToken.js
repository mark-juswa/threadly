import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Generate a secure JWT token and set it as an HTTP-only cookie
 * @param {Object} res - Express response object
 * @param {string} userId - User's MongoDB ObjectId
 * @param {Object} options - Optional settings
 * @returns {string} The generated JWT token
 */
const generateToken = (res, userId, options = {}) => {
  // Security: Validate userId
  if (!userId) {
    throw new Error('User ID is required for token generation');
  }
  
  // Generate a unique token ID for potential revocation
  const tokenId = crypto.randomBytes(16).toString('hex');
  
  // Determine token expiry (default: 7 days for better security, was 30 days)
  const expiresIn = options.rememberMe ? '30d' : '7d';
  const maxAge = options.rememberMe 
    ? 30 * 24 * 60 * 60 * 1000  // 30 days
    : 7 * 24 * 60 * 60 * 1000;  // 7 days
  
  const token = jwt.sign(
    { 
      userId: userId.toString(),
      jti: tokenId,  // JWT ID for token identification/revocation
      iat: Math.floor(Date.now() / 1000), // Issued at timestamp
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn,
      issuer: 'notes-app',  // Identify the token issuer
      audience: 'notes-app-users',  // Intended audience
    }
  );

  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Set JWT as HTTP-Only cookie with enhanced security
  res.cookie('jwt', token, {
    httpOnly: true,  // Prevents XSS attacks from accessing the cookie
    secure: isProduction,  // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax',  // CSRF protection
    maxAge: maxAge,
    path: '/',  // Cookie available for all paths
    // Note: 'domain' is not set to allow same-origin only
  });

  return token;
};

/**
 * Clear the JWT cookie (for logout)
 * @param {Object} res - Express response object
 */
export const clearToken = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    expires: new Date(0),
    path: '/',
  });
};

export default generateToken;