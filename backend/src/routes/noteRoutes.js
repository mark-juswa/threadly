import express from 'express';
import { 
  getAllNotes, 
  createNote,
  getNote,
  updateNote, 
  deleteNote,
  createTopic,
  updateTopic,
  deleteTopic,
  createCategory,
  updateCategory,
  deleteCategory,
  createGroup,
  updateGroup,
  deleteGroup
} from '../controllers/noteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// 1. Hierarchy Fetching
router.get('/', getAllNotes);

// 2. Topic Routes
router.post('/topics', createTopic);
router.put('/topics/:id', updateTopic);
router.delete('/topics/:id', deleteTopic);

// 3. Category Routes
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// 4. Group Routes
router.post('/groups', createGroup);
router.put('/groups/:id', updateGroup);
router.delete('/groups/:id', deleteGroup);

// 5. Note Operations
router.post('/', createNote);
router.get('/:id', getNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router;