import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  order: { type: Number, default: 0 },
  
  // User association
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { 
  timestamps: true, 
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }
});

// Virtual: Find top-level Groups inside this Category (groups without a parent)
CategorySchema.virtual('groups', {
  ref: 'Group',
  localField: '_id',
  foreignField: 'categoryId',
  options: { match: { parentGroupId: null } }
});

// Virtual: Find Notes directly inside this Category (not in a group)
CategorySchema.virtual('notes', {
  ref: 'SubTopic',
  localField: '_id',
  foreignField: 'categoryId',
  options: { match: { groupId: null } }
});

export default mongoose.model('Category', CategorySchema);