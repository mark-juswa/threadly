import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    // Security: Only allow safe characters in username
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  
  password: { 
    type: String, 
    required: function() {
      // Password only required if not using Google OAuth
      return !this.googleId;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default in queries
  },
  
  // Google OAuth fields
  googleId: {
    type: String,
    sparse: true, // Allows multiple null values
    unique: true,
    select: false, // Don't expose googleId in queries by default
  },
  
  avatar: { 
    type: String, 
    default: "" 
  },
  
  handle: { 
    type: String, 
    default: function() {
      return `#${Math.floor(1000 + Math.random() * 9000)}`;
    }
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Security: Track login activity
  lastLoginAt: {
    type: Date,
    select: false, // Don't expose in queries by default
  },
  
  lastLoginIP: {
    type: String,
    select: false, // Don't expose in queries by default
  },
  
  // Security: Track failed login attempts for brute force protection
  failedLoginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  
  lockUntil: {
    type: Date,
    select: false,
  },
}, { 
  timestamps: true 
});

// Virtual to check if account is locked
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
UserSchema.pre('save', async function() {
  // Only hash if password is present and modified
  if (!this.password || !this.isModified('password')) {
    return;
  }
  
  // Security: Use higher cost factor (12 rounds)
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords with brute force protection
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  
  // Check if account is locked
  if (this.isLocked) {
    return false;
  }
  
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  
  if (isMatch) {
    // Reset failed attempts on successful login
    if (this.failedLoginAttempts > 0) {
      this.failedLoginAttempts = 0;
      this.lockUntil = undefined;
      await this.save();
    }
    return true;
  }
  
  // Increment failed attempts
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  
  // Lock account after 5 failed attempts for 15 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    console.warn(`Account locked due to failed attempts: ${this.email}`);
  }
  
  await this.save();
  return false;
};

// Security: Method to check if account is locked
UserSchema.methods.checkLock = function() {
  if (this.lockUntil && this.lockUntil > Date.now()) {
    const remainingTime = Math.ceil((this.lockUntil - Date.now()) / 1000 / 60);
    return { locked: true, remainingMinutes: remainingTime };
  }
  return { locked: false };
};

export default mongoose.model('User', UserSchema);