import asyncHandler from '../middleware/asyncHandler.js'; 
import Topic from '../models/Topic.js';
import SubTopic from '../models/SubTopic.js';
import Category from '../models/Category.js';
import Group from '../models/Group.js';

// Import io instance for emitting real-time updates
let io;
export const setIO = (ioInstance) => {
  io = ioInstance;
};

// Helper function to create nested population for subgroups
// Supports up to 10 levels of nesting (can be adjusted if needed)
const createNestedGroupPopulate = (depth = 10) => {
  let populate = { path: 'notes' };
  
  for (let i = 0; i < depth; i++) {
    populate = {
      path: 'subgroups',
      populate: [
        { path: 'notes' },
        populate
      ]
    };
  }
  
  return populate;
};

// --- GET ALL NOTES (For authenticated user) ---
export const getAllNotes = asyncHandler(async (req, res) => {
  const nestedGroupPopulate = createNestedGroupPopulate(10);
  
  const topics = await Topic.find({ userId: req.user._id })
    .populate({
      path: 'categories',
      populate: [
        { 
          path: 'groups', 
          populate: [
            { path: 'notes' },
            nestedGroupPopulate
          ]
        },
        { path: 'notes' }
      ]
    })
    .populate('orphanNotes');

  res.status(200).json(topics);
});

// ==========================================
// STRUCTURE CREATION (Topic, Category, Group)
// ==========================================

// --- CREATE TOPIC ---
export const createTopic = asyncHandler(async (req, res) => {
  const { name, icon } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("Topic name is required");
  }

  const topic = await Topic.create({ 
    name, 
    icon,
    userId: req.user._id // Associate with current user
  });
  
  res.status(201).json(topic);
});

// --- UPDATE TOPIC ---
export const updateTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, icon } = req.body;

  const topic = await Topic.findOne({ _id: id, userId: req.user._id });

  if (!topic) {
    res.status(404);
    throw new Error("Topic not found or unauthorized");
  }

  topic.name = name || topic.name;
  topic.icon = icon || topic.icon;

  const updatedTopic = await topic.save();
  res.status(200).json(updatedTopic);
});

// --- DELETE TOPIC ---
export const deleteTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const topic = await Topic.findOneAndDelete({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!topic) {
    res.status(404);
    throw new Error("Topic not found or unauthorized");
  }

  // Optional: Delete all associated categories, groups, and notes
  await Category.deleteMany({ topicId: id });
  await Group.deleteMany({ topicId: id });
  await SubTopic.deleteMany({ topicId: id });

  res.status(200).json({ message: 'Topic and all associated data deleted', id });
});

// --- CREATE CATEGORY ---
export const createCategory = asyncHandler(async (req, res) => {
  const { name, topicId } = req.body;

  if (!name || !topicId) {
    res.status(400);
    throw new Error("Category name and Topic ID are required");
  }

  // Verify topic exists and belongs to user
  const topicExists = await Topic.findOne({ 
    _id: topicId, 
    userId: req.user._id 
  });
  
  if (!topicExists) {
    res.status(404);
    throw new Error("Topic not found or unauthorized");
  }

  const category = await Category.create({ 
    name, 
    topicId,
    userId: req.user._id
  });
  
  res.status(201).json(category);
});

// --- UPDATE CATEGORY ---
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const category = await Category.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found or unauthorized");
  }

  category.name = name || category.name;
  const updatedCategory = await category.save();

  res.status(200).json(updatedCategory);
});

// --- DELETE CATEGORY ---
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findOneAndDelete({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found or unauthorized");
  }

  // Optional: Delete all associated groups and notes
  await Group.deleteMany({ categoryId: id });
  await SubTopic.deleteMany({ categoryId: id });

  res.status(200).json({ message: 'Category deleted successfully', id });
});

// --- CREATE GROUP ---
export const createGroup = asyncHandler(async (req, res) => {
  const { name, categoryId, topicId, parentGroupId } = req.body;

  if (!name || !categoryId || !topicId) {
    res.status(400);
    throw new Error("Group name, Category ID, and Topic ID are required");
  }

  // If parentGroupId is provided, verify it exists and belongs to user
  if (parentGroupId) {
    const parentGroup = await Group.findOne({ 
      _id: parentGroupId, 
      userId: req.user._id 
    });
    if (!parentGroup) {
      res.status(404);
      throw new Error("Parent group not found or unauthorized");
    }
  }

  const group = await Group.create({ 
    name, 
    categoryId, 
    topicId,
    parentGroupId: parentGroupId || null,
    userId: req.user._id
  });
  
  res.status(201).json(group);
});

// --- UPDATE GROUP ---
export const updateGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const group = await Group.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found or unauthorized");
  }

  group.name = name || group.name;
  const updatedGroup = await group.save();

  res.status(200).json(updatedGroup);
});

// Helper function to recursively get all descendant group IDs
const getAllDescendantGroupIds = async (groupId, userId) => {
  const descendantIds = [];
  const childGroups = await Group.find({ parentGroupId: groupId, userId });
  
  for (const child of childGroups) {
    descendantIds.push(child._id);
    const childDescendants = await getAllDescendantGroupIds(child._id, userId);
    descendantIds.push(...childDescendants);
  }
  
  return descendantIds;
};

// --- DELETE GROUP ---
export const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const group = await Group.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found or unauthorized");
  }

  // Get all descendant group IDs (nested subgroups)
  const descendantIds = await getAllDescendantGroupIds(id, req.user._id);
  const allGroupIds = [id, ...descendantIds];

  // Delete all notes in this group and all nested subgroups
  await SubTopic.deleteMany({ groupId: { $in: allGroupIds } });

  // Delete all nested subgroups and the group itself
  await Group.deleteMany({ _id: { $in: allGroupIds } });

  res.status(200).json({ message: 'Group and all nested subgroups deleted successfully', id });
});

// ==========================================
// NOTE (SubTopic) CRUD OPERATIONS
// ==========================================

// --- CREATE NOTE ---
export const createNote = asyncHandler(async (req, res) => {
  const { title, content, topicId, categoryId, groupId } = req.body;

  if (!title || !topicId) {
    res.status(400);
    throw new Error("Note title and Topic ID are required");
  }

  // Verify topic exists and belongs to user
  const topicExists = await Topic.findOne({ 
    _id: topicId, 
    userId: req.user._id 
  });
  
  if (!topicExists) {
    res.status(404);
    throw new Error("Topic not found or unauthorized");
  }

  const note = await SubTopic.create({ 
    title,
    content: content || '',
    topicId,
    categoryId: categoryId || null,
    groupId: groupId || null,
    userId: req.user._id
  });
  
  res.status(201).json(note);
});

// --- GET SINGLE NOTE ---
export const getNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await SubTopic.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!note) {
    res.status(404);
    throw new Error("Note not found or unauthorized");
  }

  res.status(200).json(note);
});

// --- UPDATE NOTE ---
export const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, topicId, categoryId, groupId, version, sessionId } = req.body;

  const note = await SubTopic.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!note) {
    res.status(404);
    throw new Error("Note not found or unauthorized");
  }

  // Version conflict detection
  if (version !== undefined && note.version !== version) {
    res.status(409); // Conflict
    return res.json({ 
      conflict: true, 
      currentVersion: note.version,
      currentContent: note.content,
      message: "Note has been modified by another session" 
    });
  }

  note.title = title || note.title;
  note.content = content !== undefined ? content : note.content;
  note.topicId = topicId || note.topicId;
  note.categoryId = categoryId !== undefined ? categoryId : note.categoryId;
  note.groupId = groupId !== undefined ? groupId : note.groupId;
  
  // Increment version on content change
  if (content !== undefined) {
    note.version += 1;
    note.lastModifiedBy = sessionId || null;
  }

  const updatedNote = await note.save();
  
  // Emit real-time update to all connected clients of this user
  if (io && content !== undefined) {
    io.to(`user:${req.user._id}`).emit('note-sync', {
      noteId: id,
      content: updatedNote.content,
      version: updatedNote.version,
      lastModifiedBy: updatedNote.lastModifiedBy
    });
  }
  
  res.status(200).json(updatedNote);
});

// --- DELETE NOTE ---
export const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await SubTopic.findOneAndDelete({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!note) {
    res.status(404);
    throw new Error("Note not found or unauthorized");
  }

  res.status(200).json({ message: 'Note deleted successfully', id });
});

// --- REORDER NOTES ---
// Body: { orderedIds: ["id1", "id2", ...] }
// All IDs must belong to the same container (same categoryId+groupId combo or all orphans).
// We simply assign order = index position, saving a bulk write.
export const reorderNotes = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400);
    throw new Error("orderedIds array is required");
  }

  // Verify all notes belong to this user (security check)
  const notes = await SubTopic.find({ 
    _id: { $in: orderedIds }, 
    userId: req.user._id 
  });

  if (notes.length !== orderedIds.length) {
    res.status(403);
    throw new Error("One or more notes not found or unauthorized");
  }

  // Bulk update order values
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, userId: req.user._id },
      update: { $set: { order: index } }
    }
  }));

  await SubTopic.bulkWrite(bulkOps);

  res.status(200).json({ success: true, message: 'Notes reordered successfully' });
});
