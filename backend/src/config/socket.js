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
      ],
      credentials: true,
      methods: ['GET', 'POST']
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
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
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
