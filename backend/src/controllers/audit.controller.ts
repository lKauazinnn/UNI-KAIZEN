import { Response } from 'express';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

export class AuditController {
  async list(req: AuthRequest, res: Response) {
    try {
      const entityType = req.query.entityType as string | undefined;
      const action = req.query.action as string | undefined;
      let query = supabase
        .from('audit_logs')
        .select('*, users(name, email)')
        .eq('organizationId', req.organizationId!)
        .order('createdAt', { ascending: false })
        .limit(200);

      if (entityType) query = query.eq('entityType', entityType);
      if (action) query = query.eq('action', action);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: 'Erro ao listar auditoria' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar auditoria' });
    }
  }
}