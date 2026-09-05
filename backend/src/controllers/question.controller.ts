import { Response } from 'express';
import { z } from 'zod';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const updateSchema = z.object({
  statement: z.string().min(1, 'Enunciado obrigatório'),
  alternatives: z.array(z.object({ letter: z.string(), text: z.string() })).min(2, 'A questão precisa ter pelo menos 2 alternativas'),
  gabarito: z.string().regex(/^[A-Ea-e]$/, 'Gabarito deve ser uma letra entre A e E').nullable().optional(),
  gabaritoOrigin: z.enum(['document', 'ai', 'professor']).nullable().optional(),
  catalogItemId: z.string().nullable().optional(),
});

const classificateSchema = z.object({ catalogItemId: z.string() });

export class QuestionController {
  // Lista em lote: ?status=pending|approved|rejected|all  (B18 banco de questões)
  async list(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const importJobId = req.query.importJobId as string | undefined;
      let query = supabase
        .from('questions')
        .select('*, catalog_items(id, name, level)')
        .eq('organizationId', req.organizationId!);

      if (status && status !== 'all') query = query.eq('status', status);
      if (importJobId) query = query.eq('importJobId', importJobId);

      const { data, error } = await query.order('createdAt', { ascending: false }).limit(500);
      if (error) return res.status(500).json({ error: 'Erro ao listar questões' });
      return res.json(data ?? []);
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
        .select('id, status')
        .eq('organizationId', req.organizationId!)
        .eq('status', 'pending');
      if (importJobId) query = query.eq('importJobId', String(importJobId));

      const { data: pending, error } = await query;
      if (error) return res.status(500).json({ error: 'Erro ao listar questões' });

      const approved: string[] = [];
      const rejected: { id: string; reason: string }[] = [];

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
          rejected.push({ id: q.id, reason: validity.reason ?? 'Inválida' });
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

      const { data, error } = await supabase
        .from('questions')
        .update({ catalogItemId, classificationSource: 'professor', updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao classificar questão' });
      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao classificar questão' });
    }
  }

  // Validação técnica mínima para entrar no simulado
  private async validateQuestion(id: string, orgId: string): Promise<{ valid: boolean; reason?: string }> {
    const { data: q } = await supabase
      .from('questions')
      .select('statement, alternatives')
      .eq('id', id)
      .eq('organizationId', orgId)
      .single();
    if (!q) return { valid: false, reason: 'Questão não encontrada' };
    const alts = Array.isArray(q.alternatives) ? q.alternatives : [];
    if (!q.statement || q.statement.trim().length < 5) return { valid: false, reason: 'Enunciado ausente ou muito curto' };
    if (alts.filter((a: any) => a?.text?.trim()).length < 2) return { valid: false, reason: 'Menos de 2 alternativas válidas' };
    return { valid: true };
  }
}