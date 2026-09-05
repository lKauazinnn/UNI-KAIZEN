import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../lib/roles';

export const requireRole = (...roles: UserRole[]) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const role = req.userRole;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'Você não tem permissão para essa ação' });
  }
  return next();
};

export const requireProfessorOrAdmin = requireRole('professor', 'admin');
export const requireAdmin = requireRole('admin');