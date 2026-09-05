import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

const createNoticeSchema = z.object({ message: z.string().min(1, 'Mensagem obrigatória').max(500) });

export class NoticeController {
  // Professor envia aviso à turma (B27)
  async create(req: AuthRequest, res: Response) {
    try {
      const { id: turmaId } = req.params;
      const { message } = createNoticeSchema.parse(req.body);

      const { data: turma } = await supabase
        .from('turmas')
        .select('organizationId, professorId')
        .eq('id', turmaId)
        .single();
      if (!turma || turma.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }
      if (req.userRole !== 'admin' && turma.professorId !== req.userId) {
        return res.status(403).json({ error: 'Sem permissão para avisar essa turma' });
      }

      const { data, error } = await supabase
        .from('notices')
        .insert({ id: randomUUID(), turmaId, createdBy: req.userId!, message, updatedAt: new Date().toISOString() })
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao enviar aviso' });
      return res.status(201).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao enviar aviso' });
    }
  }

  // Aluno vê os avisos das turmas onde é membro
  async listForStudent(req: AuthRequest, res: Response) {
    try {
      const { data: memberships } = await supabase
        .from('turma_members')
        .select('turmaId')
        .eq('userId', req.userId!)
        .eq('status', 'ativo');
      const turmaIds = (memberships ?? []).map((m) => m.turmaId);
      if (turmaIds.length === 0) return res.json([]);

      const { data, error } = await supabase
        .from('notices')
        .select('*, turmas(id, name), users(name)')
        .in('turmaId', turmaIds)
        .order('createdAt', { ascending: false })
        .limit(50);
      if (error) return res.status(500).json({ error: 'Erro ao listar avisos' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar avisos' });
    }
  }

  // Avisos de uma turma específica (professor/adm)
  async listByTurma(req: AuthRequest, res: Response) {
    try {
      const { id: turmaId } = req.params;
      const { data: turma } = await supabase
        .from('turmas')
        .select('organizationId, professorId')
        .eq('id', turmaId)
        .single();
      if (!turma || turma.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }
      if (req.userRole !== 'admin' && turma.professorId !== req.userId) {
        return res.status(403).json({ error: 'Sem permissão' });
      }
      const { data, error } = await supabase
        .from('notices')
        .select('*, users(name)')
        .eq('turmaId', turmaId)
        .order('createdAt', { ascending: false });
      if (error) return res.status(500).json({ error: 'Erro ao listar avisos' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar avisos' });
    }
  }
}