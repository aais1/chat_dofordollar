import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  createStatus, getStatuses, getStatusViews, recordView
} from '../controllers/status.controller.js';

const router = Router();

router.use(protect);

router.post('/', adminOnly, createStatus);
router.get('/', getStatuses);
router.get('/:statusId/views', adminOnly, getStatusViews);
router.post('/:statusId/view', recordView);

export default router;
