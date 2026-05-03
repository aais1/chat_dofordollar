import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getMyChat, getAllChats, getMessages, sendMessage, markAsRead, deleteChat,
  togglePin, toggleArchive, deleteMessage
} from '../controllers/chat.controller.js';

const router = Router();

router.use(protect);

router.get('/my-chat', getMyChat);
router.get('/', adminOnly, getAllChats);
router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', sendMessage);
router.patch('/:chatId/read', markAsRead);
router.patch('/:chatId/pin', adminOnly, togglePin);
router.patch('/:chatId/archive', adminOnly, toggleArchive);
router.delete('/:chatId', adminOnly, deleteChat);
router.delete('/messages/:messageId', adminOnly, deleteMessage);

export default router;
