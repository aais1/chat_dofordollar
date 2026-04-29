import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import { getWelcomeMessage, updateWelcomeMessage, uploadMedia } from '../controllers/misc.controller.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Welcome message
router.get('/welcome', protect, getWelcomeMessage);
router.put('/welcome', protect, adminOnly, updateWelcomeMessage);

// Media upload
router.post('/upload', protect, upload.single('file'), uploadMedia);

export default router;
