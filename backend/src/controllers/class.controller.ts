import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const createClassSchema = z.object({ name: z.string().min(2, 'Nome da turma muito curto') });
const renameClassSchema = z.object({ name: z.string().min(2, 'Nome da turma muito curto') });
const linkStudentSchema = z.object({ email: z.string().email('Email inválido'), name: z.string().optional() });
const csvImportSchema = z.object({ students: z.string().min(1, 'Nenhum aluno no CSV') });
const decisionSchema = z.object({ approve: z.boolean() });

const TEMP_PASSWORD_PREFIX = 'kaizen!'; // senha inicial para alunos criados por CSV

export class ClassController {
  // ─── Professor: CRUD de turmas ──────────────────────────────────────
  async create(req: AuthRequest, res: Response) {
    try {
      const { name } = createClassSchema.parse(req.body);
      const { data, error } = await supabase
        .from('turmas')
        .insert({
          id: randomUUID(),
          name,
          organizationId: req.organizationId!,
          professorId: req.userId!,
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao criar turma' });

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'create', entityType: 'turma', entityId: data.id, details: { name } });
      return res.status(201).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar turma' });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const isProfessor = req.userRole === 'professor' || req.userRole === 'admin';
      const orgId = req.organizationId!;

      if (isProfessor) {
        const { data, error } = await supabase
          .from('turmas')
          .select('*')
          .eq('organizationId', orgId)
          .eq('professorId', req.userId!)
          .order('createdAt', { ascending: false });
        if (error) return res.status(500).json({ error: 'Erro ao listar turmas' });
        return res.json(data ?? []);
      }

      // Aluno: turmas em que é membro
      const { data: memberships, error: memError } = await supabase
        .from('turma_members')
        .select('turmaId')
        .eq('userId', req.userId!)
        .eq('status', 'ativo');
      if (memError) return res.status(500).json({ error: 'Erro ao listar turmas' });

      const ids = memberships?.map((m) => m.turmaId) ?? [];
      if (ids.length === 0) return res.json([]);

      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .in('id', ids)
        .order('createdAt', { ascending: false });
      if (error) return res.status(500).json({ error: 'Erro ao listar turmas' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar turmas' });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: turma, error } = await supabase
        .from('turmas')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !turma) return res.status(404).json({ error: 'Turma não encontrada' });
      if (turma.organizationId !== req.organizationId) return res.status(404).json({ error: 'Turma não encontrada' });

      const isProfessor = turma.professorId === req.userId || req.userRole === 'admin';

      // Professor: membros e solicitações. Aluno: apenas confirma participação.
      if (isProfessor) {
        const { data: members, error: mErr } = await supabase
          .from('turma_members')
          .select('*, users(id, name, email, role)')
          .eq('turmaId', id)
          .order('createdAt', { ascending: true });
        if (mErr) return res.status(500).json({ error: 'Erro ao buscar membros' });
        const { data: exams, error: xErr } = await supabase
          .from('exams')
          .select('id, title, status, createdAt')
          .eq('turmaId', id)
          .order('createdAt', { ascending: false });
        if (xErr) return res.status(500).json({ error: 'Erro ao buscar simulados' });
        return res.json({ ...turma, members: members ?? [], exams: exams ?? [] });
      }

      const { data: membership } = await supabase
        .from('turma_members')
        .select('status')
        .eq('turmaId', id)
        .eq('userId', req.userId!)
        .maybeSingle();
      if (!membership) return res.status(403).json({ error: 'Você não participa dessa turma' });
      return res.json({ ...turma, membershipStatus: membership.status });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar turma' });
    }
  }

  async rename(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name } = renameClassSchema.parse(req.body);
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { data, error } = await supabase
        .from('turmas')
        .update({ name, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao renomear turma' });
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'update', entityType: 'turma', entityId: id, details: { name } });
      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao renomear turma' });
    }
  }

  async archive(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { data, error } = await supabase
        .from('turmas')
        .update({ archived: true, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao arquivar turma' });
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'archive', entityType: 'turma', entityId: id });
      return res.json(data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao arquivar turma' });
    }
  }

  // ─── Vinculação de alunos ───────────────────────────────────────────
  async linkStudent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { email, name } = linkStudentSchema.parse(req.body);
      const normalized = email.trim().toLowerCase();
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      // Aluno já existe?
      let { data: student } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', normalized)
        .maybeSingle();

      if (student && student.role === 'aluno') {
        const { data: existing } = await supabase
          .from('turma_members')
          .select('id')
          .eq('turmaId', id)
          .eq('userId', student.id)
          .maybeSingle();
        if (existing) return res.status(400).json({ error: 'Aluno já vinculado a essa turma' });

        await this.addMember(req, id, student.id, 'ativo');
        return res.status(201).json({ student });
      }

      if (student && student.role !== 'aluno') {
        return res.status(400).json({ error: 'Esse email pertence a um professor/administrador' });
      }

      // Não existe → cria aluno com senha temporária
      const tempPassword = TEMP_PASSWORD_PREFIX + Math.random().toString(36).slice(2, 8);
      const hashed = await bcrypt.hash(tempPassword, 10);

      const { data: created, error } = await supabase
        .from('users')
        .insert({
          id: randomUUID(),
          name: name ?? normalized.split('@')[0],
          email: normalized,
          password: hashed,
          role: 'aluno',
          isActive: true,
          organizationId: req.organizationId!,
          updatedAt: new Date().toISOString(),
        })
        .select('id, name, email, role')
        .single();

      if (error || !created) {
        console.error('Erro ao criar aluno:', JSON.stringify(error));
        return res.status(500).json({ error: 'Erro ao vincular aluno' });
      }

      await this.addMember(req, id, created.id, 'ativo');
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'create', entityType: 'user', entityId: created.id, details: { via: 'link', tempPassword } });
      return res.status(201).json({ student: created, tempPassword });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao vincular aluno' });
    }
  }

  async importCsv(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { students } = csvImportSchema.parse(req.body);
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const results: { name?: string; email: string; status: string; tempPassword?: string }[] = [];

      for (const rawLine of students.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const [emailPart, ...nameParts] = line.split(/[;,]/).map((s) => s.trim());
        const email = (emailPart ?? '').toLowerCase();
        if (!email || !email.includes('@')) {
          results.push({ email: line, status: 'invalido' });
          continue;
        }
        const name = nameParts.join(' ') || email.split('@')[0];

        let { data: existing } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', email)
          .maybeSingle();

        if (existing && existing.role !== 'aluno') {
          results.push({ name, email, status: 'invalido' });
          continue;
        }

        let targetId = existing?.id;
        let tempPassword: string | undefined;

        if (!targetId) {
          tempPassword = TEMP_PASSWORD_PREFIX + Math.random().toString(36).slice(2, 8);
          const { data: created, error } = await supabase
            .from('users')
            .insert({
              id: randomUUID(),
              name,
              email,
              password: await bcrypt.hash(tempPassword, 10),
              role: 'aluno',
              isActive: true,
              organizationId: req.organizationId!,
              updatedAt: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (error || !created) {
            results.push({ name, email, status: 'erro' });
            continue;
          }
          targetId = created.id;
        }

        const { data: already } = await supabase
          .from('turma_members')
          .select('id')
          .eq('turmaId', id)
          .eq('userId', targetId)
          .maybeSingle();

        if (already) {
          results.push({ name, email, status: 'ja-vinculado' });
          continue;
        }

        await this.addMember(req, id, targetId, 'ativo');
        results.push({ name, email, status: targetId === existing?.id ? 'vinculado' : 'criado', tempPassword });
      }

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'create', entityType: 'turma_member', entityId: id, details: { via: 'csv', total: results.length } });
      return res.json({ results });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao importar alunos' });
    }
  }

  async removeStudent(req: AuthRequest, res: Response) {
    try {
      const { id, studentId } = req.params;
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { error } = await supabase
        .from('turma_members')
        .delete()
        .eq('turmaId', id)
        .eq('userId', studentId);
      if (error) return res.status(500).json({ error: 'Erro ao remover aluno' });
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'delete', entityType: 'turma_member', entityId: studentId });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao remover aluno' });
    }
  }

  // ─── Solicitações de vínculo (B07) ──────────────────────────────────
  async requestLink(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: turma, error } = await supabase.from('turmas').select('*').eq('id', id).single();
      if (error || !turma) return res.status(404).json({ error: 'Turma não encontrada' });
      if (turma.organizationId !== req.organizationId) return res.status(404).json({ error: 'Turma não encontrada' });

      const { data: existing } = await supabase
        .from('turma_members')
        .select('status')
        .eq('turmaId', id)
        .eq('userId', req.userId!)
        .maybeSingle();
      if (existing) return res.status(400).json({ error: existing.status === 'pendente' ? 'Solicitação já enviada e em análise' : 'Você já participa dessa turma' });

      await this.addMember(req, id, req.userId!, 'pendente');
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'request', entityType: 'turma_member', entityId: id });
      return res.status(201).json({ ok: true, message: 'Solicitação enviada para o professor' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao solicitar vínculo' });
    }
  }

  async pendingRequests(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { data, error } = await supabase
        .from('turma_members')
        .select('*, users(id, name, email)')
        .eq('turmaId', id)
        .eq('status', 'pendente')
        .order('createdAt', { ascending: true });
      if (error) return res.status(500).json({ error: 'Erro ao buscar solicitações' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar solicitações' });
    }
  }

  async decideRequest(req: AuthRequest, res: Response) {
    try {
      const { id, memberId } = req.params;
      const { approve } = decisionSchema.parse(req.body);
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { data: member } = await supabase
        .from('turma_members')
        .select('userId')
        .eq('id', memberId)
        .eq('turmaId', id)
        .single();
      if (!member) return res.status(404).json({ error: 'Solicitação não encontrada' });

      if (approve) {
        const { data, error } = await supabase
          .from('turma_members')
          .update({ status: 'ativo', updatedAt: new Date().toISOString() })
          .eq('id', memberId)
          .select()
          .single();
        if (error || !data) return res.status(500).json({ error: 'Erro ao aprovar solicitação' });
        await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'approve', entityType: 'turma_member', entityId: member.userId });
        return res.json(data);
      }

      await supabase.from('turma_members').delete().eq('id', memberId);
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'reject', entityType: 'turma_member', entityId: member.userId });
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao decidir solicitação' });
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  private async assertOwnership(req: AuthRequest, turmaId: string, res: Response): Promise<boolean> {
    if (req.userRole === 'admin') return true;
    const { data: turma } = await supabase
      .from('turmas')
      .select('professorId, organizationId')
      .eq('id', turmaId)
      .single();
    if (!turma || turma.organizationId !== req.organizationId || turma.professorId !== req.userId) {
      res.status(403).json({ error: 'Você não tem permissão nessa turma' });
      return false;
    }
    return true;
  }

  private async addMember(req: AuthRequest, turmaId: string, userId: string, status: string) {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('turma_members')
      .insert({ id: randomUUID(), turmaId, userId, status, updatedAt: now })
      .select()
      .single();
    return data;
  }
}