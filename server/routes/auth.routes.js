import { Router } from 'express';
import { signup, login, adminLogin, getMe } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { message: 'Too many login attempts, please try again later' },
// });

router.post('/signup', signup);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.get('/me', protect, getMe);

export default router;
