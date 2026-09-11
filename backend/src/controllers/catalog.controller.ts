import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';

const addItemSchema = z.object({
  level: z.number().min(1).max(4),
  name: z.string().min(1, 'Nome obrigatório'),
  parentId: z.string().nullable().optional(),
});

export class CatalogController {
  // Lista a árvore completa: disciplina -> conteúdo -> tópico -> subtópico.
  async tree(req: AuthRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('organizationId', req.organizationId!)
        .order('name', { ascending: true });
      if (error) return res.status(500).json({ error: 'Erro ao buscar catálogo' });

      const items = data ?? [];
      const childrenOf = (parentId: string, level: number): any[] =>
        items
          .filter((item) => item.parentId === parentId && item.level === level)
          .map((item) => ({
            ...item,
            ...(level === 2 ? { topics: childrenOf(item.id, 3) } : {}),
            ...(level === 3 ? { subtopics: childrenOf(item.id, 4) } : {}),
          }));

      const disciplines = items
        .filter((item) => item.level === 1)
        .map((discipline) => {
          const contents = childrenOf(discipline.id, 2);
          // `topics` mantém o contrato antigo para clientes existentes; o
          // nome canônico do segundo nível agora é `contents`.
          return { ...discipline, contents, topics: contents };
        });

      return res.json(disciplines);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar catálogo' });
    }
  }

  async add(req: AuthRequest, res: Response) {
    try {
      const { level, name, parentId } = addItemSchema.parse(req.body);
      if (level === 1 && parentId) return res.status(400).json({ error: 'Disciplina não possui categoria pai' });
      if (level > 1 && !parentId) return res.status(400).json({ error: 'Informe o item pai' });

      // O item pai precisa ser da mesma organização (B04) e do nível imediatamente acima.
      if (parentId) {
        const { data: parent } = await supabase
          .from('catalog_items')
          .select('organizationId, level')
          .eq('id', parentId)
          .single();
        if (!parent || parent.organizationId !== req.organizationId) {
          return res.status(400).json({ error: 'Item pai inválido' });
        }
        if (parent.level !== level - 1) {
          return res.status(400).json({ error: 'Item pai não pertence ao nível correto' });
        }
      }

      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          id: randomUUID(),
          organizationId: req.organizationId!,
          level,
          name,
          parentId: parentId ?? null,
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') return res.status(400).json({ error: 'Item já existe no catálogo' });
        console.error(error);
        return res.status(500).json({ error: 'Erro ao adicionar item' });
      }
      return res.status(201).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
      console.error(error);
      return res.status(500).json({ error: 'Erro ao adicionar item' });
    }
  }

  async remove(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: item } = await supabase
        .from('catalog_items')
        .select('organizationId')
        .eq('id', id)
        .single();
      if (!item || item.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      const { error } = await supabase.from('catalog_items').delete().eq('id', id);
      if (error) {
        if ((error as any).code === '23503') return res.status(400).json({ error: 'Item possui itens filhos — remova-os primeiro' });
        console.error(error);
        return res.status(500).json({ error: 'Erro ao remover item' });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao remover item' });
    }
  }
}
