import { Router } from 'express';
import { QuestionController } from '../controllers/question.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new QuestionController();

// Banco de questões expõe o gabarito: nunca liberar para aluno.
router.get('/', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.list(req, res));
router.get('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.getById(req, res));
router.patch('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.update(req, res));
router.delete('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.remove(req, res));
router.post('/:id/approve', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.approve(req, res));
router.post('/:id/classificate', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.classificate(req, res));
router.post('/approve-valid', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.approveValidBatch(req, res));

export default router;