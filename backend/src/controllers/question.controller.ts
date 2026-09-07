import { Response } from 'express';
import { z } from 'zod';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const updateSchema = z.object({
  statement: z.string().min(1, 'Enunciado obrigatório'),
  alternatives: z.array(z.object({ letter: z.string(), text: z.string() })).optional().default([]),
  gabarito: z.string().nullable().optional(),
  gabaritoOrigin: z.enum(['document', 'ai', 'professor']).nullable().optional(),
  catalogItemId: z.string().nullable().optional(),
});

const classificateSchema = z.object({ catalogItemId: z.string() });

export class QuestionController {
  // Lista em lote: ?status=pending|approved|rejected|all&q=&catalogItemId=&page=&pageSize=  (B18 banco de questões)
  async list(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const importJobId = req.query.importJobId as string | undefined;
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const catalogItemId = req.query.catalogItemId as string | undefined;

      // Compatibilidade: sem page/pageSize a rota continua devolvendo o array puro.
      const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const rawPageSize = Number(req.query.pageSize) || 50;
      const pageSize = Math.min(100, Math.max(1, rawPageSize));

      let query = supabase
        .from('questions')
        .select('*, catalog_items(id, name, level)', { count: 'exact' })
        .eq('organizationId', req.organizationId!);

      if (status && status !== 'all') query = query.eq('status', status);
      if (importJobId) query = query.eq('importJobId', importJobId);
      if (catalogItemId) query = query.eq('catalogItemId', catalogItemId);
      const order = req.query.order as string | undefined;
      if (order === 'createdDesc') {
        query = query.order('createdAt', { ascending: false });
      } else if (order === 'createdAsc') {
        query = query.order('createdAt', { ascending: true });
      } else {
        // Padrão amigável: ordenação numérica das questões (1, 2, 3...)
        query = query
          .order('number', { ascending: true, nullsFirst: false })
          .order('createdAt', { ascending: false });
      }

      if (paginated) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      } else {
        query = query.limit(500);
      }

      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: 'Erro ao listar questões' });

      const items = data ?? [];
      if (!paginated) return res.json(items);
      return res.json({ items, page, pageSize, total: count ?? items.length });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar questões' });
    }
  }

  // Tela de revisão (B14): mostra exatamente como o aluno verá.
  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: question, error } = await supabase
        .from('questions')
        .select('*, catalog_items(id, name, level, parentId)')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (error || !question) return res.status(404).json({ error: 'Questão não encontrada' });
      return res.json(question);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar questão' });
    }
  }

  // Editar questão (B15)
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = updateSchema.parse(req.body);

      const { data: existing } = await supabase
        .from('questions')
        .select('organizationId')
        .eq('id', id)
        .single();
      if (!existing || existing.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Questão não encontrada' });
      }

      const updates: Record<string, unknown> = {
        statement: parsed.statement,
        alternatives: parsed.alternatives,
        catalogItemId: parsed.catalogItemId ?? null,
        updatedAt: new Date().toISOString(),
      };
      if (parsed.gabarito !== undefined) {
        updates.gabarito = parsed.gabarito ? parsed.gabarito.toUpperCase() : null;
        updates.gabaritoOrigin = parsed.gabarito ? (parsed.gabaritoOrigin ?? 'professor') : null;
      }

      const { data, error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao editar questão' });

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'update', entityType: 'question', entityId: id });
      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao editar questão' });
    }
  }

  // Excluir questão (B16)
  async remove(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: existing } = await supabase
        .from('questions')
        .select('organizationId, status')
        .eq('id', id)
        .single();
      if (!existing || existing.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Questão não encontrada' });
      }

      // O banco tem ON DELETE CASCADE em exam_questions/answers: apagar uma questão
      // já usada apagaria respostas de alunos e mudaria notas entregues. Bloqueia (409).
      const { data: links, error: linkError } = await supabase
        .from('exam_questions')
        .select('examId')
        .eq('questionId', id);
      if (linkError) return res.status(500).json({ error: 'Erro ao excluir questão' });
      if ((links ?? []).length > 0) {
        return res.status(409).json({
          error:
            'Esta questão está sendo usada em um simulado e não pode ser excluída. Remova-a do simulado antes de excluir.',
          examIds: (links ?? []).map((l) => l.examId),
        });
      }

      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Erro ao excluir questão' });

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'delete',
        entityType: 'question',
        entityId: id,
        details: { status: existing.status },
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao excluir questão' });
    }
  }

  // Aprovar uma questão individual
  async approve(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const validity = await this.validateQuestion(id, req.organizationId!);
      if (!validity.valid) return res.status(400).json({ error: validity.reason ?? 'Questão inválida' });

      const { data, error } = await supabase
        .from('questions')
        .update({ status: 'approved', updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao aprovar questão' });

      await logAudit({ organizationId: req.organizationId!, userId: req.userId!, action: 'approve', entityType: 'question', entityId: id });
      return res.json(data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao aprovar questão' });
    }
  }

  // Aprovar todas as válidas em lote (B17). Inválidas ficam fora e exibem motivo.
  async approveValidBatch(req: AuthRequest, res: Response) {
    try {
      const { importJobId } = req.query;
      let query = supabase
        .from('questions')
        .select('id, number, status')
        .eq('organizationId', req.organizationId!)
        .eq('status', 'pending');
      if (importJobId) query = query.eq('importJobId', String(importJobId));

      const { data: pending, error } = await query;
      if (error) return res.status(500).json({ error: 'Erro ao listar questões' });

      const approved: string[] = [];
      // A UI lista os motivos por questão: { id, number, reason }.
      const rejected: { id: string; number: number | null; reason: string }[] = [];

      for (const q of pending ?? []) {
        const validity = await this.validateQuestion(q.id, req.organizationId!);
        if (validity.valid) {
          await supabase
            .from('questions')
            .update({ status: 'approved', updatedAt: new Date().toISOString() })
            .eq('id', q.id);
          approved.push(q.id);
        } else {
          await supabase
            .from('questions')
            .update({ status: 'rejected', rejectionReason: validity.reason, updatedAt: new Date().toISOString() })
            .eq('id', q.id);
          rejected.push({ id: q.id, number: q.number ?? null, reason: validity.reason ?? 'Inválida' });
        }
      }

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'approve',
        entityType: 'question',
        details: { batch: true, approved: approved.length, rejected: rejected.length },
      });

      return res.json({ approved: approved.length, rejected });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao aprovar questões' });
    }
  }

  // Classificação manual (B13: "o professor pode aceitar ou alterar")
  async classificate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { catalogItemId } = classificateSchema.parse(req.body);

      const { data: item } = await supabase
        .from('catalog_items')
        .select('organizationId')
        .eq('id', catalogItemId)
        .single();
      if (!item || item.organizationId !== req.organizationId) {
        return res.status(400).json({ error: 'Item de catálogo inválido' });
      }

      // O filtro por organizationId no update impede escrita cross-tenant (B04).
      const { data, error } = await supabase
        .from('questions')
        .update({ catalogItemId, classificationSource: 'professor', updatedAt: new Date().toISOString() })
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .select()
        .single();
      if (error || !data) return res.status(404).json({ error: 'Questão não encontrada' });
      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao classificar questão' });
    }
  }

  // Validação técnica mínima para entrar no simulado (suporta múltipla escolha e resposta livre)
  private async validateQuestion(id: string, orgId: string): Promise<{ valid: boolean; reason?: string }> {
    const { data: q } = await supabase
      .from('questions')
      .select('statement, alternatives, gabarito')
      .eq('id', id)
      .eq('organizationId', orgId)
      .single();
    if (!q) return { valid: false, reason: 'Questão não encontrada' };
    if (!q.statement || q.statement.trim().length < 5) return { valid: false, reason: 'Enunciado ausente ou muito curto' };

    const alts = Array.isArray(q.alternatives) ? q.alternatives.filter((a: any) => a?.text?.trim()) : [];
    const gabarito = typeof q.gabarito === 'string' ? q.gabarito.trim() : '';

    if (!gabarito) return { valid: false, reason: 'Sem gabarito ou resposta esperada definida' };

    // Se tem alternativas, valida como múltipla escolha
    if (alts.length > 0) {
      if (alts.length < 2) return { valid: false, reason: 'Menos de 2 alternativas válidas' };
      const letters = alts
        .map((a: any) => String(a?.letter ?? '').trim().toUpperCase())
        .filter((l: string) => l.length > 0);

      if (new Set(letters).size !== letters.length) {
        return { valid: false, reason: 'Alternativas com letras duplicadas' };
      }

      if (!letters.includes(gabarito.toUpperCase())) {
        return { valid: false, reason: 'Gabarito não corresponde a nenhuma alternativa' };
      }
    } else {
      // Resposta livre / dissertativa: precisa apenas de um gabarito / resposta esperada em texto
      if (gabarito.length < 1) {
        return { valid: false, reason: 'Questão dissertativa requer uma resposta esperada' };
      }
    }

    return { valid: true };
  }
}