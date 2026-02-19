import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  
  // Parent group for nesting (null means top-level group under category)
  parentGroupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group', 
    default: null 
  },
  
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

// Virtual: Find Notes inside this Group
GroupSchema.virtual('notes', {
  ref: 'SubTopic',
  localField: '_id',
  foreignField: 'groupId'
});

// Virtual: Find child groups (subgroups) inside this Group
GroupSchema.virtual('subgroups', {
  ref: 'Group',
  localField: '_id',
  foreignField: 'parentGroupId'
});

export default mongoose.model('Group', GroupSchema);