import { Router } from 'express';
import multer from 'multer';
import { ImportController, importUploadMiddleware } from '../controllers/import.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new ImportController();

router.get('/', authMiddleware, (req, res) => controller.list(req, res));
router.post(
  '/upload',
  authMiddleware,
  requireProfessorOrAdmin,
  importUploadMiddleware.single('file'),
  (req, res) => controller.upload(req, res)
);
router.get('/:id', authMiddleware, (req, res) => controller.getById(req, res));

export default router;