import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import supabase from '../lib/supabase';
import { isOwnerEmail, resolveSystemRole, UserRole } from '../lib/roles';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  isAdmin?: boolean;
  organizationId?: string;
  userEmail?: string;
  accessToken?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const [, token] = authHeader.split(' ');

  (async () => {
    try {
      let email: string | undefined;
      let isSupabaseToken = false;

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email?: string; id?: string };
        email = decoded.email ?? decoded.id ?? undefined;
      } catch {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user?.email) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        email = data.user.email;
        isSupabaseToken = true;
      }

      if (!email) {
        return res.status(401).json({ error: 'Token inválido' });
      }

      const { data: localUser, error: localUserError } = await supabase
        .from('users')
        .select('id, isAdmin, isActive, email, role, "organizationId"')
        .eq('email', email)
        .maybeSingle();

      if (localUserError || !localUser) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      if (localUser.isActive === false) {
        return res.status(403).json({ error: 'Usuário inativo. Procure um administrador.' });
      }

      const role = resolveSystemRole(localUser);
      req.userId = localUser.id;
      req.userRole = role;
      req.isAdmin = (localUser.isAdmin ?? false) || isOwnerEmail(localUser.email);
      req.organizationId = localUser.organizationId;
      req.userEmail = localUser.email;
      req.accessToken = isSupabaseToken ? token : undefined;

      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  })();
};