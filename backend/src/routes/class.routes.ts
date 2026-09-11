import { Router } from 'express';
import { ClassController } from '../controllers/class.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireProfessorOrAdmin } from '../middlewares/role.middleware';

const router = Router();
const controller = new ClassController();

router.post('/', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.create(req, res));
router.get('/', authMiddleware, (req, res) => controller.list(req, res));
router.get('/:id', authMiddleware, (req, res) => controller.getById(req, res));
router.patch('/:id', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.rename(req, res));
router.post('/:id/archive', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.archive(req, res));

router.post('/:id/students/link', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.linkStudent(req, res));
router.get('/:id/students/search', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.searchStudents(req, res));
router.post('/:id/students/import-csv', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.importCsv(req, res));
router.delete('/:id/students/:studentId', authMiddleware, requireProfessorOrAdmin, (req, res) => controller.removeStudent(req, res));

export default router;
