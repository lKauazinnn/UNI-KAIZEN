import { Response } from 'express';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ResultController {
  // Painel do professor (B25): alunos + desempenho por simulado
  async byExam(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data: exam } = await supabase
        .from('exams')
        .select('turmaId, organizationId, createdBy')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (!exam) return res.status(404).json({ error: 'Simulado não encontrado' });
      if (req.userRole !== 'admin' && exam.createdBy !== req.userId) {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      const { data: members, error: mErr } = await supabase
        .from('turma_members')
        .select('userId, users(id, name, email)')
        .eq('turmaId', exam.turmaId)
        .eq('status', 'ativo');
      if (mErr) return res.status(500).json({ error: 'Erro ao listar alunos' });

      const { data: attempts, error: aErr } = await supabase
        .from('attempts')
        .select('id, userId, status, submittedAt, startedAt')
        .eq('examId', id);
      if (aErr) return res.status(500).json({ error: 'Erro ao listar tentativas' });

      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('questions(id, gabarito)')
        .eq('examId', id);
      const total = (examQuestions ?? []).length;

      const result = (members ?? []).map((member) => {
        const user = (member as any).users;
        const attempt = (attempts ?? []).find((a) => a.userId === user.id);

        return {
          studentId: user.id,
          name: user.name,
          email: user.email,
          status: attempt?.status ?? 'nao_iniciou',
          correct: 0,
          percent: 0,
          submittedAt: attempt?.submittedAt ?? null,
          startedAt: attempt?.startedAt ?? null,
        };
      });

      // Preenche correção apenas para tentativas enviadas
      const submittedAttempts = (attempts ?? []).filter((a) => a.status === 'submitted');
      for (const attempt of submittedAttempts) {
        const { data: answers } = await supabase
          .from('answers')
          .select('isCorrect')
          .eq('attemptId', attempt.id);
        const correct = (answers ?? []).filter((a) => a.isCorrect).length;
        const studentResult = result.find((r) => r.studentId === attempt.userId);
        if (studentResult) {
          studentResult.correct = correct;
          studentResult.percent = total > 0 ? Math.round((correct / total) * 100) : 0;
        }
      }

      return res.json({ examId: id, total, students: result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar resultados' });
    }
  }

  // Detalhe por questão (B26): taxa de acerto de cada questão
  async byQuestion(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const { data: exam } = await supabase
        .from('exams')
        .select('turmaId, organizationId, createdBy')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (!exam) return res.status(404).json({ error: 'Simulado não encontrado' });
      if (req.userRole !== 'admin' && exam.createdBy !== req.userId) {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('id, "order", questions(id, number, statement)')
        .eq('examId', id)
        .order('order', { ascending: true });

      const { data: attempts } = await supabase
        .from('attempts')
        .select('id')
        .eq('examId', id)
        .eq('status', 'submitted');

      const { data: members } = await supabase
        .from('turma_members')
        .select('userId')
        .eq('turmaId', exam.turmaId)
        .eq('status', 'ativo');

      const totalResponded = (attempts ?? []).length;

      const details = (examQuestions ?? []).map((eq) => {
        const q = (eq as any).questions;
        return { questionId: q.id, number: q.number ?? (eq as any).order, statement: q.statement, answered: 0, correct: 0, rate: 0 };
      });

      for (const attempt of attempts ?? []) {
        const { data: answers } = await supabase
          .from('answers')
          .select('questionId, isCorrect')
          .eq('attemptId', attempt.id);
        const correctMap = new Map((answers ?? []).map((a) => [a.questionId, a.isCorrect]));
        for (const detail of details) {
          const isCorrect = correctMap.get(detail.questionId);
          if (isCorrect === undefined) continue;
          detail.answered += 1;
          if (isCorrect) detail.correct += 1;
        }
      }

      for (const detail of details) {
        detail.rate = detail.answered > 0 ? Math.round((detail.correct / detail.answered) * 100) : 0;
      }

      return res.json({ examId: id, totalAlunos: (members ?? []).length, totalResponded, questions: details });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
  }

  // Aluno: seu próprio resultado
  async myResult(req: AuthRequest, res: Response) {
    try {
      const { examId } = req.params;

      const { data: attempt } = await supabase
        .from('attempts')
        .select('id, status, submittedAt')
        .eq('examId', examId)
        .eq('userId', req.userId!)
        .maybeSingle();

      if (!attempt || attempt.status !== 'submitted') {
        return res.status(404).json({ error: 'Nenhum resultado disponível' });
      }

      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('"order", questions(id, number, statement, gabarito)')
        .eq('examId', examId)
        .order('order', { ascending: true });
      const total = (examQuestions ?? []).length;

      const { data: answers } = await supabase
        .from('answers')
        .select('questionId, selected, isCorrect')
        .eq('attemptId', attempt.id);

      const answerMap = new Map((answers ?? []).map((a) => [a.questionId, a]));
      const correct = (answers ?? []).filter((a) => a.isCorrect).length;

      const questions = (examQuestions ?? []).map((eq) => {
        const q = (eq as any).questions;
        const answer = answerMap.get(q.id);
        return {
          number: q.number ?? (eq as any).order,
          statement: q.statement,
          gabarito: q.gabarito,
          selected: answer?.selected ?? null,
          isCorrect: answer?.isCorrect ?? null,
        };
      });

      return res.json({
        attempt,
        correct,
        total,
        percent: total > 0 ? Math.round((correct / total) * 100) : 0,
        questions,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar resultado' });
    }
  }
}