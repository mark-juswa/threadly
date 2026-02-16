import asyncHandler from '../middleware/asyncHandler.js'; 
import Topic from '../models/Topic.js';
import SubTopic from '../models/SubTopic.js';
import Category from '../models/Category.js';
import Group from '../models/Group.js';

// --- GET ALL NOTES (For authenticated user) ---
export const getAllNotes = asyncHandler(async (req, res) => {
  const topics = await Topic.find({ userId: req.user._id })
    .populate({
      path: 'categories',
      populate: [
        { path: 'groups', populate: { path: 'notes' } },
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
  const { name, categoryId, topicId } = req.body;

  if (!name || !categoryId || !topicId) {
    res.status(400);
    throw new Error("Group name, Category ID, and Topic ID are required");
  }

  const group = await Group.create({ 
    name, 
    categoryId, 
    topicId,
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

// --- DELETE GROUP ---
export const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const group = await Group.findOneAndDelete({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found or unauthorized");
  }

  // Delete all notes in this group
  await SubTopic.deleteMany({ groupId: id });

  res.status(200).json({ message: 'Group deleted successfully', id });
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
  const { title, content, topicId, categoryId, groupId } = req.body;

  const note = await SubTopic.findOne({ 
    _id: id, 
    userId: req.user._id 
  });

  if (!note) {
    res.status(404);
    throw new Error("Note not found or unauthorized");
  }

  note.title = title || note.title;
  note.content = content !== undefined ? content : note.content;
  note.topicId = topicId || note.topicId;
  note.categoryId = categoryId !== undefined ? categoryId : note.categoryId;
  note.groupId = groupId !== undefined ? groupId : note.groupId;

  const updatedNote = await note.save();
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
