import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getLabels,
  createLabel,
  toggleChatLabel,
  deleteLabel,
} from '../controllers/label.controller.js';

const router = Router();

router.use(protect);
router.use(adminOnly); // labels are an admin feature

router.get('/', getLabels);
router.post('/', createLabel);
router.patch('/:labelId/chats', toggleChatLabel);
router.delete('/:labelId', deleteLabel);

export default router;
