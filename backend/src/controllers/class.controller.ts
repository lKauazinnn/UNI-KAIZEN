import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const createClassSchema = z.object({ name: z.string().min(2, 'Nome da turma muito curto') });
const renameClassSchema = z.object({ name: z.string().min(2, 'Nome da turma muito curto') });
const linkStudentSchema = z.object({ userId: z.string().uuid().optional(), email: z.string().email('Email inválido').optional() }).refine((data) => data.userId || data.email, 'Selecione um aluno');
const csvImportSchema = z.object({ students: z.string().min(1, 'Nenhum aluno no CSV') });

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
        let classesQuery = supabase.from('turmas').select('*').eq('organizationId', orgId);
        if (req.userRole !== 'admin') classesQuery = classesQuery.eq('professorId', req.userId!);
        const { data, error } = await classesQuery.order('createdAt', { ascending: false });
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
        .eq('organizationId', orgId)
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

      // Professor: membros da turma. Aluno: apenas confirma participação.
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
      const { userId, email } = linkStudentSchema.parse(req.body);
      const normalized = email?.trim().toLowerCase();
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const { data: activeClass } = await supabase.from('turmas').select('archived').eq('id', id).single();
      if (activeClass?.archived) return res.status(400).json({ error: 'Não é possível vincular aluno a uma turma arquivada' });

      // A turma é vinculada a um aluno já cadastrado e pesquisado dentro da
      // organização. Isso elimina solicitação pendente e evita criar usuários
      // com credenciais temporárias no meio do fluxo principal.
      let studentQuery = supabase.from('users').select('id, name, email, role').eq('organizationId', req.organizationId!).eq('role', 'aluno');
      if (userId) studentQuery = studentQuery.eq('id', userId);
      else studentQuery = studentQuery.eq('email', normalized!);
      const { data: student } = await studentQuery.maybeSingle();

      if (student) {
        const { data: existing } = await supabase
          .from('turma_members')
          .select('id')
          .eq('turmaId', id)
          .eq('userId', student.id)
          .maybeSingle();
        if (existing) return res.status(400).json({ error: 'Aluno já vinculado a essa turma' });

        const member = await this.addMember(req, id, student.id, 'ativo');
        if (!member) return res.status(500).json({ error: 'Não foi possível criar o vínculo' });
        return res.status(201).json({ student });
      }

      return res.status(404).json({ error: 'Aluno não encontrado. Cadastre o aluno antes de vinculá-lo.' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao vincular aluno' });
    }
  }

  async searchStudents(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ok = await this.assertOwnership(req, id, res);
      if (!ok) return;

      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const safeQuery = query.replace(/[%,()]/g, ' ').trim();

      // Busca vazia devolve os alunos DISPONÍVEIS da organização em vez de uma
      // lista vazia. O professor não sabe de cor o nome de quem se cadastrou —
      // exigir 2 caracteres para mostrar qualquer coisa fazia o modal de
      // vínculo abrir sempre vazio, como se não houvesse aluno nenhum.
      const { data: linked } = await supabase.from('turma_members').select('userId').eq('turmaId', id);
      const linkedIds = (linked ?? []).map((member) => member.userId);
      let studentsQuery = supabase
        .from('users')
        .select('id, name, email, role')
        .eq('organizationId', req.organizationId!)
        .eq('role', 'aluno')
        .order('name', { ascending: true })
        .limit(safeQuery.length >= 2 ? 20 : 50);
      if (safeQuery.length >= 2) {
        studentsQuery = studentsQuery.or(`name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`);
      }
      if (linkedIds.length > 0) studentsQuery = studentsQuery.not('id', 'in', `(${linkedIds.join(',')})`);
      const { data, error } = await studentsQuery;
      if (error) return res.status(500).json({ error: 'Erro ao pesquisar alunos' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao pesquisar alunos' });
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

        // Busca restrita à organização do professor (B04).
        let { data: existing } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', email)
          .eq('organizationId', req.organizationId!)
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

  // ─── Helpers ────────────────────────────────────────────────────────
  private async assertOwnership(req: AuthRequest, turmaId: string, res: Response): Promise<boolean> {
    const { data: turma } = await supabase
      .from('turmas')
      .select('professorId, organizationId')
      .eq('id', turmaId)
      .single();
    // A checagem de organização vale para TODOS, inclusive admin (B04).
    if (!turma || turma.organizationId !== req.organizationId) {
      res.status(404).json({ error: 'Turma não encontrada' });
      return false;
    }
    // O admin da organização pode administrar turmas de qualquer professor dela.
    if (req.userRole !== 'admin' && turma.professorId !== req.userId) {
      res.status(403).json({ error: 'Você não tem permissão nessa turma' });
      return false;
    }
    return true;
  }

  private async addMember(req: AuthRequest, turmaId: string, userId: string, status: string) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('turma_members')
      .insert({ id: randomUUID(), turmaId, userId, status, updatedAt: now })
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar membro:', JSON.stringify(error));
      return null;
    }
    return data;
  }
}
