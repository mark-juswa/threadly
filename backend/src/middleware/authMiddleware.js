import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import User from '../models/User.js';

// Protect routes - must be authenticated
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Read token from cookie
  token = req.cookies.jwt;

  if (token) {
    try {
      // Verify token with issuer and audience validation
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'notes-app',
        audience: 'notes-app-users',
      });
      
      // Security: Validate token has required claims
      if (!decoded.userId) {
        console.error('Token missing userId claim');
        res.status(401);
        throw new Error('Not authorized, invalid token format');
      }
      
      // Security: Check token age (optional additional check)
      const tokenAge = Date.now() / 1000 - decoded.iat;
      const maxTokenAge = 30 * 24 * 60 * 60; // 30 days in seconds
      if (tokenAge > maxTokenAge) {
        console.error('Token too old');
        res.status(401);
        throw new Error('Not authorized, token expired');
      }
      
      // Attach user to request (exclude sensitive fields)
      req.user = await User.findById(decoded.userId).select('-password');
      
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }
      
      // Security: Check if user account is active
      if (req.user.isActive === false) {
        res.status(401);
        throw new Error('Account has been deactivated');
      }
      
      // Store token ID for potential logging/revocation
      req.tokenId = decoded.jti;
      
      next();
    } catch (error) {
      // Clear invalid token cookie
      res.cookie('jwt', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        expires: new Date(0),
      });
      
      console.error('Token verification failed:', error.message);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

export { protect };