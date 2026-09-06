import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const createSchema = z.object({
  title: z.string().min(2, 'Título do simulado obrigatório'),
  turmaId: z.string(),
  questionIds: z.array(z.string()).min(1, 'Selecione pelo menos uma questão'),
});

const updateSchema = z.object({
  title: z.string().min(2, 'Título do simulado obrigatório').optional(),
  turmaId: z.string().optional(),
  questionIds: z.array(z.string()).min(1, 'Selecione pelo menos uma questão').optional(),
});

export class ExamController {
  async create(req: AuthRequest, res: Response) {
    try {
      const { title, turmaId, questionIds } = createSchema.parse(req.body);

      // Valida turma e pertencimento
      const { data: turma } = await supabase
        .from('turmas')
        .select('organizationId, professorId')
        .eq('id', turmaId)
        .single();
      if (!turma || turma.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }
      if (req.userRole !== 'admin' && turma.professorId !== req.userId) {
        return res.status(403).json({ error: 'Você não administra essa turma' });
      }

      // Valida questões (aprovadas, da organização)
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('id')
        .eq('organizationId', req.organizationId!)
        .eq('status', 'approved')
        .in('id', questionIds);
      if (qErr) return res.status(500).json({ error: 'Erro ao validar questões' });

      const validIds = (questions ?? []).map((q) => q.id);
      const missing = questionIds.filter((id) => !validIds.includes(id));
      if (missing.length > 0) {
        return res.status(400).json({ error: 'Algumas questões não estão aprovadas ou não pertencem à sua organização' });
      }

      const now = new Date().toISOString();
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          id: randomUUID(),
          title,
          turmaId,
          organizationId: req.organizationId!,
          createdBy: req.userId!,
          status: 'draft',
          updatedAt: now,
        })
        .select()
        .single();
      if (examError || !exam) return res.status(500).json({ error: 'Erro ao criar simulado' });

      for (const [index, questionId] of questionIds.entries()) {
        await supabase.from('exam_questions').insert({
          id: randomUUID(),
          examId: exam.id,
          questionId,
          order: index + 1,
        });
      }

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'create', entityType: 'exam', entityId: exam.id, details: { title } });
      return res.status(201).json(exam);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar simulado' });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const isProfessor = req.userRole === 'professor' || req.userRole === 'admin';

      if (isProfessor) {
        const { data: turmas } = await supabase
          .from('turmas')
          .select('id')
          .eq('organizationId', req.organizationId!)
          .eq('professorId', req.userId!);
        const turmaIds = (turmas ?? []).map((t) => t.id);
        const { data, error } = await supabase
          .from('exams')
          .select('*, turmas(id, name)')
          .eq('organizationId', req.organizationId!)
          .in('turmaId', turmaIds.length > 0 ? turmaIds : ['none'])
          .order('createdAt', { ascending: false });
        if (error) return res.status(500).json({ error: 'Erro ao listar simulados' });
        return res.json(data ?? []);
      }

      // Aluno: só simulados publicados das turmas onde é membro
      const { data: memberships } = await supabase
        .from('turma_members')
        .select('turmaId')
        .eq('userId', req.userId!)
        .eq('status', 'ativo');
      const turmaIds = (memberships ?? []).map((m) => m.turmaId);
      if (turmaIds.length === 0) return res.json([]);

      const { data, error } = await supabase
        .from('exams')
        .select('*, turmas(id, name)')
        .eq('organizationId', req.organizationId!)
        .eq('status', 'published')
        .in('turmaId', turmaIds)
        .order('publishedAt', { ascending: false });
      if (error) return res.status(500).json({ error: 'Erro ao listar simulados' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar simulados' });
    }
  }

  // Pré-visualização (B20): o professor vê exatamente o que o aluno verá.
  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: exam, error } = await supabase
        .from('exams')
        .select('*, turmas(id, name), attempts(id, userId, status, submittedAt)')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (error || !exam) return res.status(404).json({ error: 'Simulado não encontrado' });

      const isProfessor = exam.createdBy === req.userId || req.userRole === 'admin';

      // Aluno só acessa simulado publicado da sua turma
      if (!isProfessor) {
        const { data: membership } = await supabase
          .from('turma_members')
          .select('status')
          .eq('turmaId', exam.turmaId)
          .eq('userId', req.userId!)
          .maybeSingle();
        if (!membership || membership.status !== 'ativo' || exam.status !== 'published') {
          return res.status(403).json({ error: 'Simulado não disponível' });
        }
      }

      // O aluno nunca pode receber o gabarito por esta rota (B21).
      const questionFields = isProfessor
        ? 'id, number, statement, alternatives, images, gabarito, gabaritoOrigin, gabaritoConfidence, catalogItemId, classificationSource, status'
        : 'id, number, statement, alternatives, images';

      const { data: examQuestions, error: eqErr } = await supabase
        .from('exam_questions')
        .select(`id, "order", questions(${questionFields})`)
        .eq('examId', id)
        .order('order', { ascending: true });
      if (eqErr) return res.status(500).json({ error: 'Erro ao carregar questões' });

      // hasAttempt é sobre o usuário logado, não sobre a turma inteira.
      const allAttempts = (exam.attempts ?? []) as { userId: string }[];
      const hasAttempt = allAttempts.some((a) => a.userId === req.userId);

      // Aluno não enxerga as tentativas dos colegas.
      const { attempts, ...examWithoutAttempts } = exam as Record<string, unknown>;
      return res.json({
        ...(isProfessor ? exam : examWithoutAttempts),
        questions: examQuestions ?? [],
        hasAttempt,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar simulado' });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = updateSchema.parse(req.body);
      const ok = await this.assertOwner(req, id, res);
      if (!ok) return;

      const { data: current } = await supabase.from('exams').select('status').eq('id', id).single();
      if (current?.status === 'published') {
        return res.status(400).json({ error: 'Simulado publicado não pode ser alterado. Crie uma nova versão.' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (parsed.title) updates.title = parsed.title;

      if (parsed.turmaId) {
        // Mesma validação do create: sem checar o professorId dava para mover
        // o simulado para a turma de outro professor.
        const { data: turma } = await supabase
          .from('turmas')
          .select('organizationId, professorId')
          .eq('id', parsed.turmaId)
          .single();
        if (!turma || turma.organizationId !== req.organizationId) {
          return res.status(404).json({ error: 'Turma não encontrada' });
        }
        if (req.userRole !== 'admin' && turma.professorId !== req.userId) {
          return res.status(403).json({ error: 'Você não administra essa turma' });
        }
        updates.turmaId = parsed.turmaId;
      }

      const { data: exam, error } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .select()
        .single();
      if (error || !exam) return res.status(500).json({ error: 'Erro ao atualizar simulado' });

      if (parsed.questionIds) {
        await supabase.from('exam_questions').delete().eq('examId', id);
        for (const [index, questionId] of parsed.questionIds.entries()) {
          await supabase.from('exam_questions').insert({ id: randomUUID(), examId: id, questionId, order: index + 1 });
        }
      }

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'update', entityType: 'exam', entityId: id });
      return res.json(exam);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao atualizar simulado' });
    }
  }

  async publish(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ok = await this.assertOwner(req, id, res);
      if (!ok) return;

      const { data: examQuestions, error: eqErr } = await supabase
        .from('exam_questions')
        .select('id')
        .eq('examId', id);
      if (eqErr || !examQuestions || examQuestions.length === 0) {
        return res.status(400).json({ error: 'Simulado sem questões — adicione questões antes de publicar' });
      }

      const { data, error } = await supabase
        .from('exams')
        .update({ status: 'published', publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao publicar simulado' });

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'publish',
        entityType: 'exam',
        entityId: id,
        details: { totalQuestions: examQuestions.length },
      });
      return res.json(data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao publicar simulado' });
    }
  }

  async archive(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ok = await this.assertOwner(req, id, res);
      if (!ok) return;

      const { data, error } = await supabase
        .from('exams')
        .update({ status: 'archived', updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao arquivar simulado' });
      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'archive', entityType: 'exam', entityId: id });
      return res.json(data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao arquivar simulado' });
    }
  }

  private async assertOwner(req: AuthRequest, examId: string, res: Response): Promise<boolean> {
    const { data: exam } = await supabase
      .from('exams')
      .select('organizationId, createdBy')
      .eq('id', examId)
      .single();
    // A checagem de organização vale para TODOS, inclusive admin (B04).
    if (!exam || exam.organizationId !== req.organizationId) {
      res.status(404).json({ error: 'Simulado não encontrado' });
      return false;
    }
    // O admin da organização pode administrar simulados de qualquer professor dela.
    if (req.userRole !== 'admin' && exam.createdBy !== req.userId) {
      res.status(403).json({ error: 'Você não tem permissão nesse simulado' });
      return false;
    }
    return true;
  }
}