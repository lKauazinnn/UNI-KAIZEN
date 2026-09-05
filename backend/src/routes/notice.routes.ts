import { Router } from 'express';
import { NoticeController } from '../controllers/notice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new NoticeController();

router.get('/mine', authMiddleware, (req, res) => controller.listForStudent(req, res));
router.post('/turma/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.create(req, res));
router.get('/turma/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.listByTurma(req, res));

export default router;