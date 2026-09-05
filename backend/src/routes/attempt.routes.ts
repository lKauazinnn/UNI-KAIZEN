import { Router } from 'express';
import { AttemptController } from '../controllers/attempt.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AttemptController();

router.put('/:id/answers', authMiddleware, (req, res) => controller.saveAnswers(req, res));
router.post('/:id/submit', authMiddleware, (req, res) => controller.submit(req, res));

export default router;