import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';
import { normalizeEmail, resolveSystemRole, UserRole } from '../lib/roles';
import { logAudit } from '../lib/audit';

const addUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['professor', 'aluno']),
});

const changeRoleSchema = z.object({ role: z.enum(['admin', 'professor', 'aluno']) });

const AdminControllerInstance = {
  // Cria usuário na organização do admin
  async createUser(req: AuthRequest, res: Response) {
    try {
      const parsed = addUserSchema.parse(req.body);
      const email = normalizeEmail(parsed.email);

      const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (existing) return res.status(400).json({ error: 'Usuário já existe' });

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: randomUUID(),
          name: parsed.name,
          email,
          password: await bcrypt.hash(parsed.password, 10),
          role: parsed.role,
          isActive: true,
          organizationId: req.organizationId!,
          updatedAt: new Date().toISOString(),
        })
        .select('id, name, email, role, isActive, createdAt')
        .single();
      if (error || !user) return res.status(500).json({ error: 'Erro ao criar usuário' });

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'create', entityType: 'user', entityId: user.id, details: { role: parsed.role } });
      return res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  },

  // Lista usuários da organização
  async listUsers(req: AuthRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, isActive, createdAt')
        .eq('organizationId', req.organizationId!)
        .order('createdAt', { ascending: false });
      if (error) return res.status(500).json({ error: 'Erro ao listar usuários' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  },

  // Altera papel (admin/professor/aluno) e status
  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = changeRoleSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body as any);

      if (id === req.userId) return res.status(400).json({ error: 'Você não pode alterar seu próprio usuário' });

      const { data: target } = await supabase
        .from('users')
        .select('organizationId, email')
        .eq('id', id)
        .single();
      if (!target || target.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (parsed.role !== undefined) updates.role = parsed.role;
      if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;

      const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao atualizar usuário' });

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'update', entityType: 'user', entityId: id, details: updates });
      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  },
};

export { AdminControllerInstance as AdminController, requireAdmin };
export type { UserRole };