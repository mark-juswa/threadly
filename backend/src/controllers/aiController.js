import asyncHandler from '../middleware/asyncHandler.js';
import Topic from '../models/Topic.js';
import Category from '../models/Category.js';
import Group from '../models/Group.js';
import SubTopic from '../models/SubTopic.js';
import { extractHtmlStructure, htmlToPlainText, limitPlainText } from '../utils/htmlToPlainText.js';
import {
  generateNoteReview,
  generateGroupSummary,
  generateCategorySummary,
} from '../services/aiService.js';

const NOTE_LIMIT = 12000;
const GROUP_LIMIT = 30000;
const CATEGORY_LIMIT = 45000;

const normalizeError = (error, res) => {
  if (error.statusCode) res.status(error.statusCode);
  throw error;
};

const getTopicName = async (topicId, userId) => {
  if (!topicId) return null;
  const topic = await Topic.findOne({ _id: topicId, userId }).select('name');
  return topic?.name || null;
};

const getCategoryName = async (categoryId, userId) => {
  if (!categoryId) return null;
  const category = await Category.findOne({ _id: categoryId, userId }).select('name');
  return category?.name || null;
};

const getGroupName = async (groupId, userId) => {
  if (!groupId) return null;
  const group = await Group.findOne({ _id: groupId, userId }).select('name');
  return group?.name || null;
};

const formatLimitedNote = (note, perNoteLimit) => {
  const plain = htmlToPlainText(note.content);
  const limited = limitPlainText(plain, perNoteLimit);
  return {
    _id: note._id,
    title: note.title,
    content: limited.text,
    structure: extractHtmlStructure(note.content),
    truncated: limited.truncated,
    updatedAt: note.updatedAt,
  };
};

const limitCollectionNotes = (notes, totalLimit) => {
  let remaining = totalLimit;
  let truncated = false;

  const formatted = notes.map((note) => {
    const plain = htmlToPlainText(note.content);
    const allowance = Math.max(0, Math.min(plain.length, remaining));
    const limited = limitPlainText(plain, allowance);
    remaining -= limited.text.length;

    if (limited.truncated || allowance < plain.length || remaining <= 0) {
      truncated = true;
    }

    return {
      _id: note._id,
      title: note.title,
      groupId: note.groupId,
      content: limited.text,
      structure: extractHtmlStructure(note.content),
      truncated: limited.truncated || allowance < plain.length,
      updatedAt: note.updatedAt,
    };
  });

  return { notes: formatted, truncated };
};

const getDescendantGroupIds = async (groupId, userId) => {
  const ids = [groupId];
  const children = await Group.find({ parentGroupId: groupId, userId }).select('_id');

  for (const child of children) {
    const descendantIds = await getDescendantGroupIds(child._id, userId);
    ids.push(...descendantIds);
  }

  return ids;
};

export const reviewNote = asyncHandler(async (req, res) => {
  try {
    const { noteId } = req.body;
    if (!noteId) {
      res.status(400);
      throw new Error('noteId is required');
    }

    const note = await SubTopic.findOne({ _id: noteId, userId: req.user._id });
    if (!note) {
      res.status(404);
      throw new Error('Note not found or unauthorized');
    }

    const formattedNote = formatLimitedNote(note, NOTE_LIMIT);
    if (!formattedNote.content) {
      res.status(400);
      throw new Error('This note has no content to review');
    }

    const context = {
      topicName: await getTopicName(note.topicId, req.user._id),
      categoryName: await getCategoryName(note.categoryId, req.user._id),
      groupName: await getGroupName(note.groupId, req.user._id),
    };

    const aiResponse = await generateNoteReview({ context, note: formattedNote });

    res.status(200).json({
      type: 'note',
      provider: aiResponse.provider,
      model: aiResponse.model,
      result: aiResponse.result,
      truncated: formattedNote.truncated,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    normalizeError(error, res);
  }
});

export const summarizeGroup = asyncHandler(async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) {
      res.status(400);
      throw new Error('groupId is required');
    }

    const group = await Group.findOne({ _id: groupId, userId: req.user._id });
    if (!group) {
      res.status(404);
      throw new Error('Group not found or unauthorized');
    }

    const groupIds = await getDescendantGroupIds(group._id, req.user._id);
    const rawNotes = await SubTopic.find({
      groupId: { $in: groupIds },
      userId: req.user._id,
    }).sort({ order: 1, updatedAt: 1 });

    if (rawNotes.length === 0) {
      res.status(400);
      throw new Error('This group has no notes to summarize');
    }

    const { notes, truncated } = limitCollectionNotes(rawNotes, GROUP_LIMIT);
    const context = {
      topicName: await getTopicName(group.topicId, req.user._id),
      categoryName: await getCategoryName(group.categoryId, req.user._id),
    };

    const aiResponse = await generateGroupSummary({ context, group, notes, truncated });

    res.status(200).json({
      type: 'group',
      provider: aiResponse.provider,
      model: aiResponse.model,
      result: aiResponse.result,
      truncated,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    normalizeError(error, res);
  }
});

export const summarizeCategory = asyncHandler(async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      res.status(400);
      throw new Error('categoryId is required');
    }

    const category = await Category.findOne({ _id: categoryId, userId: req.user._id });
    if (!category) {
      res.status(404);
      throw new Error('Category not found or unauthorized');
    }

    const groups = await Group.find({ categoryId, userId: req.user._id }).sort({ createdAt: 1 });
    const groupIds = groups.map((group) => group._id);
    const rawNotes = await SubTopic.find({
      userId: req.user._id,
      categoryId,
      $or: [
        { groupId: null },
        { groupId: { $in: groupIds } },
      ],
    }).sort({ order: 1, updatedAt: 1 });

    if (rawNotes.length === 0) {
      res.status(400);
      throw new Error('This category has no notes to summarize');
    }

    const { notes, truncated } = limitCollectionNotes(rawNotes, CATEGORY_LIMIT);
    const directNotes = notes.filter((note) => !note.groupId);
    const groupedNotes = notes.reduce((acc, note) => {
      if (!note.groupId) return acc;
      const key = note.groupId.toString();
      acc[key] = acc[key] || [];
      acc[key].push(note);
      return acc;
    }, {});

    const context = {
      topicName: await getTopicName(category.topicId, req.user._id),
    };

    const aiResponse = await generateCategorySummary({
      context,
      category,
      groups,
      directNotes,
      groupedNotes,
      truncated,
    });

    res.status(200).json({
      type: 'category',
      provider: aiResponse.provider,
      model: aiResponse.model,
      result: aiResponse.result,
      truncated,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    normalizeError(error, res);
  }
});
