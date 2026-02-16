import mongoose from "mongoose";

const TopicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String, default: "" },
  
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

// Virtual: Find Categories where category.topicId == topic._id
TopicSchema.virtual('categories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'topicId'
});

// Virtual: Find "Orphan" Notes (Directly under Topic, no Category)
TopicSchema.virtual('orphanNotes', {
  ref: 'SubTopic',
  localField: '_id',
  foreignField: 'topicId',
  options: { match: { categoryId: null } }
});

export default mongoose.model('Topic', TopicSchema);