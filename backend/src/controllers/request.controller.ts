import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAudit } from '../lib/audit';

const createSchema = z
  .object({
    type: z.enum(['vinculo', 'mensagem']),
    turmaId: z.string().nullable().optional(),
    message: z.string().trim().max(2000, 'Mensagem muito longa').optional(),
  })
  .refine((data) => data.type !== 'vinculo' || !!data.turmaId, {
    message: 'Escolha a turma para solicitar o vínculo',
    path: ['turmaId'],
  })
  .refine((data) => data.type !== 'mensagem' || !!data.message?.trim(), {
    message: 'Escreva a mensagem para o professor',
    path: ['message'],
  });

const handleSchema = z.object({
  action: z.enum(['aprovar', 'recusar', 'responder']),
  response: z.string().trim().max(2000).optional(),
});

/**
 * Solicitações gerais do aluno.
 *
 * Antes o aluno era totalmente passivo: só entrava numa turma se o professor o
 * encontrasse e o vinculasse, e não tinha nenhum canal para falar com ele. Aqui
 * ele abre o pedido e o professor despacha do outro lado.
 */
export class RequestController {
  // Aluno vê as próprias; professor/admin veem as da organização.
  async list(req: AuthRequest, res: Response) {
    try {
      const isStaff = req.userRole === 'professor' || req.userRole === 'admin';

      let query = supabase
        .from('solicitacoes')
        .select('*, turmas(id, name), users!solicitacoes_userId_fkey(id, name, email)')
        .eq('organizationId', req.organizationId!)
        .order('createdAt', { ascending: false })
        .limit(200);

      if (!isStaff) query = query.eq('userId', req.userId!);
      const status = req.query.status as string | undefined;
      if (status && status !== 'all') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) {
        console.error('[solicitacoes] erro ao listar:', error.message);
        return res.status(500).json({ error: 'Erro ao listar solicitações' });
      }
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar solicitações' });
    }
  }

  // Turmas da organização que o aluno ainda não integra — o que ele pode pedir.
  async availableClasses(req: AuthRequest, res: Response) {
    try {
      const { data: memberships } = await supabase
        .from('turma_members')
        .select('turmaId')
        .eq('userId', req.userId!);
      const jaVinculado = new Set((memberships ?? []).map((m) => m.turmaId));

      const { data: turmas, error } = await supabase
        .from('turmas')
        .select('id, name, archived')
        .eq('organizationId', req.organizationId!)
        .order('name', { ascending: true });
      if (error) return res.status(500).json({ error: 'Erro ao listar turmas' });

      return res.json((turmas ?? []).filter((t) => !t.archived && !jaVinculado.has(t.id)));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar turmas' });
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const parsed = createSchema.parse(req.body);

      // A turma precisa ser da mesma organização (B04): sem isso o aluno
      // poderia pedir vínculo em turma de outra instituição por id.
      if (parsed.turmaId) {
        const { data: turma } = await supabase
          .from('turmas')
          .select('id, organizationId')
          .eq('id', parsed.turmaId)
          .single();
        if (!turma || turma.organizationId !== req.organizationId) {
          return res.status(400).json({ error: 'Turma inválida' });
        }

        const { data: jaMembro } = await supabase
          .from('turma_members')
          .select('id')
          .eq('turmaId', parsed.turmaId)
          .eq('userId', req.userId!)
          .maybeSingle();
        if (jaMembro) return res.status(409).json({ error: 'Você já participa desta turma.' });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('solicitacoes')
        .insert({
          id: randomUUID(),
          organizationId: req.organizationId!,
          userId: req.userId!,
          turmaId: parsed.turmaId ?? null,
          type: parsed.type,
          message: parsed.message?.trim() || null,
          status: 'pendente',
          updatedAt: now,
        })
        .select()
        .single();

      if (error) {
        // Índice parcial único: já existe pedido de vínculo aberto para a turma.
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Você já tem uma solicitação aberta para esta turma.' });
        }
        console.error('[solicitacoes] erro ao criar:', error.message);
        return res.status(500).json({ error: 'Erro ao registrar solicitação' });
      }

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'create',
        entityType: 'solicitacao',
        entityId: data.id,
        details: { type: parsed.type, turmaId: parsed.turmaId ?? null },
      });

      return res.status(201).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao registrar solicitação' });
    }
  }

  // Professor despacha: aprova o vínculo, recusa, ou responde uma mensagem.
  async handle(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = handleSchema.parse(req.body);

      const { data: solicitacao } = await supabase
        .from('solicitacoes')
        .select('*')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (!solicitacao) return res.status(404).json({ error: 'Solicitação não encontrada' });
      if (solicitacao.status !== 'pendente') {
        return res.status(409).json({ error: 'Esta solicitação já foi tratada.' });
      }

      if (parsed.action === 'aprovar') {
        if (solicitacao.type !== 'vinculo') {
          return res.status(400).json({ error: 'Só solicitações de vínculo podem ser aprovadas.' });
        }
        const now = new Date().toISOString();
        const { error: linkError } = await supabase.from('turma_members').insert({
          id: randomUUID(),
          turmaId: solicitacao.turmaId,
          userId: solicitacao.userId,
          status: 'ativo',
          updatedAt: now,
        });
        // 23505 = o professor já havia vinculado o aluno por fora; o pedido
        // apenas acompanha o estado real em vez de virar erro na tela dele.
        if (linkError && linkError.code !== '23505') {
          console.error('[solicitacoes] erro ao vincular:', linkError.message);
          return res.status(500).json({ error: 'Erro ao vincular o aluno à turma' });
        }
      }

      const status =
        parsed.action === 'aprovar' ? 'aprovada' : parsed.action === 'recusar' ? 'recusada' : 'respondida';

      const { data, error } = await supabase
        .from('solicitacoes')
        .update({
          status,
          response: parsed.response?.trim() || null,
          handledBy: req.userId!,
          handledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .select()
        .single();
      if (error || !data) return res.status(500).json({ error: 'Erro ao atualizar solicitação' });

      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: 'update',
        entityType: 'solicitacao',
        entityId: id,
        details: { action: parsed.action, status },
      });

      return res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao atualizar solicitação' });
    }
  }

  // O aluno pode desistir enquanto ninguém tratou.
  async cancel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: solicitacao } = await supabase
        .from('solicitacoes')
        .select('id, userId, status, organizationId')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (!solicitacao) return res.status(404).json({ error: 'Solicitação não encontrada' });
      if (solicitacao.userId !== req.userId) return res.status(403).json({ error: 'Solicitação de outro usuário' });
      if (solicitacao.status !== 'pendente') {
        return res.status(409).json({ error: 'Solicitação já tratada não pode ser cancelada.' });
      }

      const { error } = await supabase.from('solicitacoes').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Erro ao cancelar solicitação' });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao cancelar solicitação' });
    }
  }
}
