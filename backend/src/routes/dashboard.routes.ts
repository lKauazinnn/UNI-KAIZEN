import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = new DashboardController();

router.get('/professor', authMiddleware, (req, res) => controller.professor(req, res));
router.get('/aluno', authMiddleware, (req, res) => controller.aluno(req, res));

export default router;