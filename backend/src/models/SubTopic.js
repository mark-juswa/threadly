import mongoose from "mongoose";

const SubTopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: "" }, // No maxlength - supports large content
  images: [{ type: String }],
  
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
  
  // User association
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { timestamps: true });

export default mongoose.model('SubTopic', SubTopicSchema);