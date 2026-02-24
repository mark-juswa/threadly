import mongoose from "mongoose";

const SubTopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: "" }, // No maxlength - supports large content
  images: [{ type: String }],
  
  // Version control for conflict resolution
  version: { type: Number, default: 0 },
  lastModifiedBy: { type: String, default: null }, // Session ID of last editor
  
  // HIERARCHY
  topicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Topic', 
    required: true 
  },
  
  categoryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    default: null
  },
  
  groupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group', 
    default: null 
  },
  
  // Display order within its container (category, group, or orphan)
  order: { type: Number, default: 0 },

  // User association
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { timestamps: true });

export default mongoose.model('SubTopic', SubTopicSchema);