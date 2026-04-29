import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getAllUsers, toggleBlock, toggleMute, deleteUser, updateProfilePicture
} from '../controllers/user.controller.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.get('/', adminOnly, getAllUsers);
router.patch('/:userId/block', adminOnly, toggleBlock);
router.patch('/:userId/mute', adminOnly, toggleMute);
router.delete('/:userId', adminOnly, deleteUser);
router.patch('/:userId/profile-picture', upload.single('image'), updateProfilePicture);

export default router;
