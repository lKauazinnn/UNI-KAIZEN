import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller';
import { AttemptController } from '../controllers/attempt.controller';
import { ResultController } from '../controllers/result.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const exam = new ExamController();
const attempt = new AttemptController();
const result = new ResultController();

// Simulados
router.post('/', authMiddleware, requireProfessorOrAdmin, (req, res) => exam.create(req, res));
router.get('/', authMiddleware, (req, res) => exam.list(req, res));
router.get('/:id', authMiddleware, (req, res) => exam.getById(req, res));
router.patch('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => exam.update(req, res));
router.post('/:id/publish', authMiddleware, requireProfessorOrAdmin, (req, res) => exam.publish(req, res));
router.post('/:id/archive', authMiddleware, requireProfessorOrAdmin, (req, res) => exam.archive(req, res));

// Tentativas do aluno
router.post('/:id/start', authMiddleware, (req, res) => attempt.start(req, res));
router.get('/:id/take', authMiddleware, (req, res) => attempt.current(req, res));

// Resultados
router.get('/:id/results', authMiddleware, requireProfessorOrAdmin, (req, res) => result.byExam(req, res));
router.get('/:id/results/by-question', authMiddleware, requireProfessorOrAdmin, (req, res) => result.byQuestion(req, res));
router.get('/:id/my-result', authMiddleware, (req, res) => result.myResult(req, res));

export default router;