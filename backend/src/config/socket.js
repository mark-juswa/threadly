import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import cookie from 'cookie';

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'https://threadifyy.onrender.com' // Production frontend URL
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      // Parse cookies from handshake headers
      const cookies = socket.handshake.headers.cookie 
        ? cookie.parse(socket.handshake.headers.cookie) 
        : {};
      
      const token = cookies.jwt;
      
      if (!token) {
        console.error('Socket auth failed: No JWT cookie found');
        return next(new Error('Authentication required'));
      }

      // Verify token with same options as REST API
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'notes-app',
        audience: 'notes-app-users',
      });

      // Validate token has required claims (matches authMiddleware.js)
      if (!decoded.userId) {
        console.error('Socket auth failed: Token missing userId claim');
        return next(new Error('Invalid token format'));
      }

      // Find user by userId (not id)
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        console.error('Socket auth failed: User not found for ID:', decoded.userId);
        return next(new Error('User not found'));
      }

      // Check if user account is active
      if (user.isActive === false) {
        console.error('Socket auth failed: User account deactivated');
        return next(new Error('Account deactivated'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      console.log(`Socket authenticated successfully for user: ${socket.userId}`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's personal room for receiving updates
    socket.join(`user:${socket.userId}`);

    // Join a specific note room when editing
    socket.on('join-note', (noteId) => {
      socket.join(`note:${noteId}`);
      console.log(`User ${socket.userId} joined note: ${noteId}`);
    });

    // Leave note room
    socket.on('leave-note', (noteId) => {
      socket.leave(`note:${noteId}`);
      console.log(`User ${socket.userId} left note: ${noteId}`);
    });

    // Broadcast note content changes to all users in the note room
    socket.on('note-update', (data) => {
      const { noteId, content, version, sessionId } = data;
      
      // Broadcast to all other clients in the note room (excluding sender)
      socket.to(`note:${noteId}`).emit('note-updated', {
        noteId,
        content,
        version,
        sessionId,
        userId: socket.userId
      });
    });

    // Notify when note metadata changes (title, moved, etc.)
    socket.on('note-metadata-change', (data) => {
      // Broadcast to all users of this user (all their tabs/browsers)
      io.to(`user:${socket.userId}`).emit('note-metadata-changed', data);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

export default setupSocket;
