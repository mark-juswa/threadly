import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import './config/passport.js'; 
import passport from 'passport';

import noteRoutes from './routes/noteRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import ratelimiter from './middleware/rateLimiter.js';
import { setupSocket } from './config/socket.js';
import { setIO } from './controllers/noteController.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Setup Socket.IO
export const io = setupSocket(server);
// Pass io instance to controllers for real-time updates
setIO(io);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware

// CORS (allow the Vite dev server + common dev tooling)
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser tools (curl/postman) with no Origin header
      if (!origin) return cb(null, true);
      // In production, allow same-origin requests (no Origin header for same-origin)
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Allow any origin in production since frontend is served from same origin
      if (process.env.NODE_ENV === 'production') return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Preflight: match all OPTIONS requests
app.options(/.*/, cors());

app.use(express.json());
app.use(cookieParser()); // Required for JWT in cookies

// Session middleware (required for Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport AFTER session
app.use(passport.initialize());
app.use(passport.session());

// Global rate limiter for all routes
app.use(ratelimiter);


// Routes
app.use('/api/auth', authRoutes); // OAuth routes
app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);


if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../frontend/dist")));

  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
  });
} else {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.path !== '/health') {
      return res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.path} not found. In development, use http://localhost:5173 for the frontend.`,
        tip: 'API endpoints are available at /api/*'
      });
    }
    next();
  });
}

// Error handler (must be last)
app.use(errorHandler);



// Connect to DB and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on PORT:${PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : '⚠️  Not configured'}`);
  });
});
