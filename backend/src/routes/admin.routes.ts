import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware, requireAdmin);
router.post('/users', (req, res) => AdminController.createUser(req, res));
router.get('/users', (req, res) => AdminController.listUsers(req, res));
router.patch('/users/:id', (req, res) => AdminController.updateUser(req, res));

export default router;