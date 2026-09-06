import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin, requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new DashboardController();

router.get('/professor', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.professor(req, res));
router.get('/aluno', authMiddleware, (req, res) => controller.aluno(req, res));
router.get('/geral', authMiddleware, requireAdmin, (req, res) => controller.geral(req, res));

export default router;