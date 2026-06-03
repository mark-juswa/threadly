import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { aiRateLimiter } from '../middleware/aiRateLimiter.js';
import {
  reviewNote,
  summarizeGroup,
  summarizeCategory,
} from '../controllers/aiController.js';

const router = express.Router();

router.use(protect);

router.post('/note-review', aiRateLimiter('note'), reviewNote);
router.post('/group-summary', aiRateLimiter('group'), summarizeGroup);
router.post('/category-summary', aiRateLimiter('category'), summarizeCategory);

export default router;
