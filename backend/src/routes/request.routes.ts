import { Router } from 'express';
import { RequestController } from '../controllers/request.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new RequestController();

// Listagem é filtrada por papel dentro do controller: aluno vê só as dele.
router.get('/', authMiddleware, (req, res) => controller.list(req, res));
router.get('/turmas-disponiveis', authMiddleware, (req, res) => controller.availableClasses(req, res));
router.post('/', authMiddleware, (req, res) => controller.create(req, res));
router.delete('/:id', authMiddleware, (req, res) => controller.cancel(req, res));
router.post('/:id/handle', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.handle(req, res));

export default router;
