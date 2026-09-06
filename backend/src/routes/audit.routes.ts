import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new AuditController();

router.get('/', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.list(req, res));

export default router;