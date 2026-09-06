import { Response } from 'express';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export class DashboardController {
  // Painel geral do sistema (todo o org, admin + professor)
  async geral(req: AuthRequest, res: Response) {
    try {
      const orgId = req.organizationId!;

      const [tResp, qResp, pResp, aResp] = await Promise.all([
        supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('organizationId', orgId),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('organizationId', orgId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organizationId', orgId).eq('role', 'professor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('organizationId', orgId).eq('role', 'aluno'),
      ]);
      const turmas = tResp.count ?? 0;
      const questoes = qResp.count ?? 0;

      // Turmas e simulados da organização — usados para escopar tentativas/respostas,
      // que não têm organizationId próprio (B04).
      const [{ data: statusRows }, { data: examRows }, { data: orgTurmas }] = await Promise.all([
        supabase.from('questions').select('status').eq('organizationId', orgId),
        supabase.from('exams').select('id, title, status, createdBy, turmaId, turmas(name)').eq('organizationId', orgId).order('createdAt', { ascending: false }).limit(200),
        supabase.from('turmas').select('id').eq('organizationId', orgId),
      ]);

      const orgExamIds = (examRows ?? []).map((e) => e.id);
      const orgTurmaIds = (orgTurmas ?? []).map((t) => t.id);

      const [{ data: attempts }, { data: members }] = await Promise.all([
        orgExamIds.length
          ? supabase.from('attempts').select('id, examId, userId, status, submittedAt').in('examId', orgExamIds)
          : Promise.resolve({ data: [] as any[] }),
        orgTurmaIds.length
          ? supabase.from('turma_members').select('userId').eq('status', 'ativo').in('turmaId', orgTurmaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const questaoCounts = { pending: 0, approved: 0, rejected: 0 };
      for (const q of statusRows ?? []) {
        if (questaoCounts[q.status as keyof typeof questaoCounts] !== undefined) questaoCounts[q.status as keyof typeof questaoCounts] += 1;
      }

      const totalAttempts = (attempts ?? []).length;
      const totalEntregas = (attempts ?? []).filter((a) => a.status === 'submitted').length;
      const totalAlunosVinculados = (members ?? []).length;

      const attemptsByExam = new Map<string, { correct: number; answered: number; submitted: number }>();
      for (const attempt of attempts ?? []) {
        if (attempt.status !== 'submitted') continue;
        if (!attemptsByExam.has(attempt.examId)) attemptsByExam.set(attempt.examId, { correct: 0, answered: 0, submitted: 0 });
        attemptsByExam.get(attempt.examId)!.submitted += 1;
      }

      const orgAttemptIds = (attempts ?? []).map((a) => a.id);
      const { data: allAnswers } = orgAttemptIds.length
        ? await supabase.from('answers').select('attemptId, isCorrect').in('attemptId', orgAttemptIds)
        : { data: [] as any[] };
      for (const ans of allAnswers ?? []) {
        const acc = attemptsByExam.get(ans.attemptId);
        if (!acc || ans.isCorrect === undefined || ans.isCorrect === null) continue;
        acc.answered += 1;
        if (ans.isCorrect) acc.correct += 1;
      }

      const entregasPorDia = new Map<string, number>();
      for (const attempt of attempts ?? []) {
        if (attempt.status !== 'submitted' || !attempt.submittedAt) continue;
        const k = dayKey(new Date(attempt.submittedAt));
        entregasPorDia.set(k, (entregasPorDia.get(k) ?? 0) + 1);
      }
      const entregasSeries = [...entregasPorDia.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([data, entregas]) => ({ data, entregas }));

      const examMedia = (examRows ?? [])
        .filter((e) => attemptsByExam.get(e.id))
        .map((e) => {
          const acc = attemptsByExam.get(e.id)!;
          const media = acc.answered > 0 ? Math.round((acc.correct / acc.answered) * 100) : 0;
          return { id: e.id, titulo: e.title, turma: (e as any).turmas?.name ?? '—', media, entregas: acc.submitted };
        })
        .sort((a, b) => b.media - a.media);

      const byUser = new Map<string, { name: string; correct: number; answered: number }>();
      for (const attempt of attempts ?? []) {
        if (attempt.status !== 'submitted') continue;
        if (!byUser.has(attempt.userId)) byUser.set(attempt.userId, { name: '', correct: 0, answered: 0 });
      }
      // Uma única consulta, restrita à organização (evita N+1 e vazamento cross-tenant).
      const userNames = new Map<string, string>();
      const userIds = [...byUser.keys()].filter(Boolean);
      if (userIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .eq('organizationId', orgId)
          .in('id', userIds);
        for (const u of users ?? []) userNames.set(u.id, u.name ?? 'Aluno');
      }
      for (const [userId, acc] of byUser.entries()) {
        acc.name = userNames.get(userId) ?? 'Aluno';
      }
      for (const ans of allAnswers ?? []) {
        const attempt = (attempts ?? []).find((a) => a.id === ans.attemptId);
        if (!attempt || !byUser.has(attempt.userId) || ans.isCorrect === undefined || ans.isCorrect === null) continue;
        const acc = byUser.get(attempt.userId)!;
        acc.answered += 1;
        if (ans.isCorrect) acc.correct += 1;
      }
      const topAlunos = [...byUser.values()]
        .map((u) => ({ nome: u.name || 'Aluno', acertos: u.correct, respondidas: u.answered, media: u.answered > 0 ? Math.round((u.correct / u.answered) * 100) : 0 }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 8);

      return res.json({
        totais: { turmas, questoes, professores: pResp.count ?? 0, alunos: aResp.count ?? 0, totalEntregas },
        questoesPorStatus: [
          { name: 'Pendentes', value: questaoCounts.pending },
          { name: 'Aprovadas', value: questaoCounts.approved },
          { name: 'Rejeitadas', value: questaoCounts.rejected },
        ],
        simulados: [{
          name: 'Rascunho',
          value: (examRows ?? []).filter((e) => e.status === 'draft').length,
        }, {
          name: 'Publicados',
          value: (examRows ?? []).filter((e) => e.status === 'published').length,
        }, {
          name: 'Arquivados',
          value: (examRows ?? []).filter((e) => e.status === 'archived').length,
        }],
        eficiencia: { totalAttempts, totalEntregas, totalAlunosVinculados },
        entregasPorDia: entregasSeries,
        mediaPorSimulado: examMedia,
        topAlunos,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao carregar o painel geral' });
    }
  }

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

        // O total é o das questões corrigíveis do simulado, NÃO o número de
        // respostas dadas. Usar respostas dadas fazia o aluno que respondeu
        // metade da prova ver 100% aqui e 50% na tela de resultado (B24).
        const { data: examQuestions } = await supabase
          .from('exam_questions')
          .select('questions(gabarito)')
          .eq('examId', attempt.examId);
        const total = (examQuestions ?? []).filter((eq) => (eq as any).questions?.gabarito).length;
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