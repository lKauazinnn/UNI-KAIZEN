import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const saveAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selected: z.string().regex(/^[A-Ea-e]$/).nullable(),
    })
  ),
});

export class AttemptController {
  // Inicia (ou retoma) a tentativa do aluno em um simulado
  async start(req: AuthRequest, res: Response) {
    try {
      const { id: examId } = req.params;

      const { data: exam } = await supabase
        .from('exams')
        .select('id, turmaId, status, organizationId')
        .eq('id', examId)
        .single();
      if (!exam || exam.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Simulado não encontrado' });
      }
      if (exam.status !== 'published') return res.status(403).json({ error: 'Simulado não publicado' });

      const { data: membership } = await supabase
        .from('turma_members')
        .select('status')
        .eq('turmaId', exam.turmaId)
        .eq('userId', req.userId!)
        .maybeSingle();
      if (!membership || membership.status !== 'ativo') {
        return res.status(403).json({ error: 'Você não participa dessa turma' });
      }

      const { data: attempt } = await supabase
        .from('attempts')
        .select('*')
        .eq('examId', examId)
        .eq('userId', req.userId!)
        .maybeSingle();

      if (attempt) {
        if (attempt.status === 'submitted') {
          return res.status(400).json({ error: 'Tentativa já finalizada', attempt });
        }
        return res.json(attempt);
      }

      const { data: created, error } = await supabase
        .from('attempts')
        .insert({
          id: randomUUID(),
          examId,
          userId: req.userId!,
          status: 'in_progress',
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !created) return res.status(500).json({ error: 'Erro ao iniciar tentativa' });
      return res.status(201).json(created);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao iniciar tentativa' });
    }
  }

  // Dados para a tela de resposta com o estado atual (se houver respostas salvas)
  async current(req: AuthRequest, res: Response) {
    try {
      const { id: examId } = req.params;

      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('id, title, turmaId, status, organizationId')
        .eq('id', examId)
        .eq('organizationId', req.organizationId!)
        .single();
      if (examError || !exam) return res.status(404).json({ error: 'Simulado não encontrado' });
      if (exam.status !== 'published') return res.status(403).json({ error: 'Simulado não publicado' });

      const { data: membership } = await supabase
        .from('turma_members')
        .select('status')
        .eq('turmaId', exam.turmaId)
        .eq('userId', req.userId!)
        .maybeSingle();
      if (!membership || membership.status !== 'ativo') return res.status(403).json({ error: 'Acesso negado' });

      const { data: attempt } = await supabase
        .from('attempts')
        .select('*')
        .eq('examId', examId)
        .eq('userId', req.userId!)
        .maybeSingle();

      if (!attempt || attempt.status === 'submitted') {
        return res.status(404).json({ error: 'Nenhuma tentativa em andamento' });
      }

      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('"order", questions(id, number, statement, alternatives, images)')
        .eq('examId', examId)
        .order('order', { ascending: true });

      const { data: savedAnswers } = await supabase
        .from('answers')
        .select('questionId, selected')
        .eq('attemptId', attempt.id);

      const savedMap = new Map((savedAnswers ?? []).map((a) => [a.questionId, a.selected]));

      const questions = (examQuestions ?? []).map((eq) => {
        const q = (eq as any).questions;
        return {
          id: q.id,
          number: q.number,
          statement: q.statement,
          alternatives: q.alternatives ?? [],
          images: q.images ?? [],
          selected: savedMap.get(q.id) ?? null,
        };
      });

      return res.json({ attempt, examTitle: exam.title, questions });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao carregar tentativa' });
    }
  }

  // Salva respostas em andamento (upsert)
  async saveAnswers(req: AuthRequest, res: Response) {
    try {
      const { id: attemptId } = req.params;
      const { answers } = saveAnswersSchema.parse(req.body);

      const { data: attempt } = await supabase
        .from('attempts')
        .select('userId, status, examId')
        .eq('id', attemptId)
        .single();
      if (!attempt || attempt.userId !== req.userId) return res.status(403).json({ error: 'Tentativa não pertence a você' });
      if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Tentativa já finalizada' });

      // Só aceita respostas para questões que realmente estão neste simulado.
      // Sem isso, o aluno podia gravar respostas para qualquer questão da base.
      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('questionId')
        .eq('examId', attempt.examId);
      const allowedQuestionIds = new Set((examQuestions ?? []).map((eq) => eq.questionId));

      const invalid = answers.filter((a) => !allowedQuestionIds.has(a.questionId));
      if (invalid.length > 0) {
        return res.status(400).json({ error: 'Uma ou mais questões não pertencem a este simulado' });
      }

      for (const answer of answers) {
        const { data: existing } = await supabase
          .from('answers')
          .select('id')
          .eq('attemptId', attemptId)
          .eq('questionId', answer.questionId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('answers')
            .update({ selected: answer.selected, updatedAt: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase.from('answers').insert({
            id: randomUUID(),
            attemptId,
            questionId: answer.questionId,
            selected: answer.selected,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await supabase
        .from('attempts')
        .update({ updatedAt: new Date().toISOString() })
        .eq('id', attemptId);

      return res.json({ ok: true, saved: answers.length });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao salvar respostas' });
    }
  }

  // Finaliza a tentativa e corrige automaticamente (B24)
  async submit(req: AuthRequest, res: Response) {
    try {
      const { id: attemptId } = req.params;

      const { data: attempt } = await supabase
        .from('attempts')
        .select('id, examId, userId, status')
        .eq('id', attemptId)
        .single();
      if (!attempt || attempt.userId !== req.userId) return res.status(403).json({ error: 'Tentativa não pertence a você' });
      if (attempt.status === 'submitted') return res.status(400).json({ error: 'Tentativa já finalizada' });

      // B23 — fecha a tentativa ANTES de corrigir, de forma atômica.
      //
      // Corrigir primeiro e só depois mudar o status abria uma janela em que um
      // autosave concorrente ainda passava na checagem de 'in_progress' e
      // sobrescrevia `selected` sem recalcular `isCorrect` — o resultado ficava
      // permanentemente inconsistente ("sua resposta: B / gabarito: C / correta").
      // O filtro por status também garante que dois submits simultâneos não
      // corrijam a mesma tentativa duas vezes.
      const submittedAt = new Date().toISOString();
      const { data: submitted, error: subError } = await supabase
        .from('attempts')
        .update({ status: 'submitted', submittedAt, updatedAt: submittedAt })
        .eq('id', attemptId)
        .eq('status', 'in_progress')
        .select()
        .maybeSingle();
      if (subError) return res.status(500).json({ error: 'Erro ao finalizar tentativa' });
      if (!submitted) return res.status(400).json({ error: 'Tentativa já finalizada' });

      // A partir daqui a tentativa está fechada: nenhuma resposta pode mudar.
      const { data: examQuestions } = await supabase
        .from('exam_questions')
        .select('questions(id, gabarito)')
        .eq('examId', attempt.examId);

      const gabaritoByQuestion = new Map<string, string | null>();
      for (const eq of examQuestions ?? []) {
        const q = (eq as any).questions;
        gabaritoByQuestion.set(q.id, q.gabarito ? q.gabarito.toUpperCase() : null);
      }

      const { data: answers, error: aErr } = await supabase
        .from('answers')
        .select('id, questionId, selected')
        .eq('attemptId', attemptId);
      if (aErr) return res.status(500).json({ error: 'Erro ao ler respostas' });

      // Questões sem gabarito não entram no total: contá-las como erro faria a
      // turma inteira perder ponto por uma falha de importação (B24).
      let correctCount = 0;
      for (const answer of answers ?? []) {
        const gabarito = gabaritoByQuestion.get(answer.questionId);
        const isCorrect =
          answer.selected != null &&
          gabarito != null &&
          answer.selected.toUpperCase() === gabarito.toUpperCase();
        if (isCorrect) correctCount += 1;

        const { error: updErr } = await supabase
          .from('answers')
          .update({ isCorrect, updatedAt: new Date().toISOString() })
          .eq('id', answer.id);
        if (updErr) console.error('[submit] erro ao gravar correção:', JSON.stringify(updErr));
      }

      const total = [...gabaritoByQuestion.values()].filter((g) => g != null).length;

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'submit',
        entityType: 'attempt',
        entityId: attemptId,
        details: { examId: attempt.examId, correct: correctCount, total },
      });

      return res.json({
        attempt: submitted,
        correct: correctCount,
        total,
        percent: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao finalizar tentativa' });
    }
  }
}