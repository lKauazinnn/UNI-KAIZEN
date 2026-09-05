import { Response } from 'express';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

export class DashboardController {
  // Início do professor: turmas, pendências de revisão, simulados recentes
  async professor(req: AuthRequest, res: Response) {
    try {
      const orgId = req.organizationId!;
      const userId = req.userId!;

      const isAdmin = req.userRole === 'admin';

      // Turmas (professor ou todas do org se admin)
      let turmasQuery = supabase.from('turmas').select('id, name, archived, createdAt');
      if (isAdmin) {
        turmasQuery = turmasQuery.eq('organizationId', orgId);
      } else {
        turmasQuery = turmasQuery.eq('organizationId', orgId).eq('professorId', userId);
      }
      const { data: turmas } = await turmasQuery.order('createdAt', { ascending: false }).limit(10);

      const turmaIds = (turmas ?? []).map((t) => t.id);

      // Pendências de revisão: questões pending da organização
      const { data: pending } = await supabase
        .from('questions')
        .select('id, number, status')
        .eq('organizationId', orgId)
        .eq('status', 'pending')
        .limit(50);

      // Simulados recentes (rascunho + publicados) das turmas do professor
      let recentExams: any[] = [];
      if (turmaIds.length > 0) {
        const { data } = await supabase
          .from('exams')
          .select('id, title, status, publishedAt, createdAt, turmas(name)')
          .in('turmaId', turmaIds)
          .order('createdAt', { ascending: false })
          .limit(10);
        recentExams = data ?? [];
      }

      return res.json({
        turmas: turmas ?? [],
        pendingReviews: pending?.length ?? 0,
        recentExams,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao carregar o painel' });
    }
  }

  // Início do aluno: simulados disponíveis, avisos, últimos resultados
  async aluno(req: AuthRequest, res: Response) {
    try {
      const { data: memberships } = await supabase
        .from('turma_members')
        .select('turmaId')
        .eq('userId', req.userId!)
        .eq('status', 'ativo');
      const turmaIds = (memberships ?? []).map((m) => m.turmaId);

      // Simulados disponíveis
      let exams: any[] = [];
      if (turmaIds.length > 0) {
        const { data } = await supabase
          .from('exams')
          .select('id, title, status, publishedAt, turmas(id, name)')
          .eq('organizationId', req.organizationId!)
          .eq('status', 'published')
          .in('turmaId', turmaIds)
          .order('publishedAt', { ascending: false });
        exams = data ?? [];
      }

      // Avisos
      let notices: any[] = [];
      if (turmaIds.length > 0) {
        const { data } = await supabase
          .from('notices')
          .select('id, message, createdAt, turmas(name), users(name)')
          .in('turmaId', turmaIds)
          .order('createdAt', { ascending: false })
          .limit(20);
        notices = data ?? [];
      }

      // Tentativas do aluno → resultados
      const { data: attempts } = await supabase
        .from('attempts')
        .select('id, examId, status, submittedAt, exams(title, turmas(name))')
        .eq('userId', req.userId!)
        .eq('status', 'submitted')
        .order('submittedAt', { ascending: false })
        .limit(10);

      const results: any[] = [];
      for (const attempt of attempts ?? []) {
        const { data: answers } = await supabase
          .from('answers')
          .select('isCorrect')
          .eq('attemptId', attempt.id);
        const correct = (answers ?? []).filter((a) => a.isCorrect).length;
        const total = (answers ?? []).length;
        results.push({
          attemptId: attempt.id,
          examId: attempt.examId,
          examTitle: (attempt as any).exams?.title ?? null,
          turmaName: (attempt as any).exams?.turmas?.name ?? null,
          correct,
          total,
          percent: total > 0 ? Math.round((correct / total) * 100) : 0,
          submittedAt: attempt.submittedAt,
        });
      }

      return res.json({ exams, notices, results });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao carregar o painel' });
    }
  }
}