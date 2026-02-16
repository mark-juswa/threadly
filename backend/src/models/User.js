import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
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
  }
}, { 
  timestamps: true 
});

// Hash password before saving
UserSchema.pre('save', async function() {
  // Only hash if password is present and modified
  if (!this.password || !this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);