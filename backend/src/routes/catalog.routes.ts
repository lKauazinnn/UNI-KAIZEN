import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new CatalogController();

router.get('/tree', authMiddleware, (req, res) => controller.tree(req, res));
router.post('/', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.add(req, res));
router.delete('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.remove(req, res));

export default router;