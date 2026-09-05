import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuditController();

router.get('/', authMiddleware, (req, res) => controller.list(req, res));

export default router;