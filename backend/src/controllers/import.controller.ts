import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import multer from 'multer';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { extractQuestionsFromPdf } from '../lib/pdf';
import { classifyQuestion } from '../lib/ai';
import { logAudit } from '../lib/audit';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/pdf/i.test(file.mimetype) && !/.pdf$/i.test(file.originalname)) {
      return cb(new Error('Apenas arquivos PDF são aceitos'));
    }
    cb(null, true);
  },
});

export class ImportController {
  // Formato do Supabase: multer middleware na rota
  async upload(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'Envie um arquivo PDF' });

      const now = new Date().toISOString();
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          id: randomUUID(),
          organizationId: req.organizationId!,
          userId: req.userId!,
          fileName: file.originalname,
          status: 'processing',
          updatedAt: now,
        })
        .select()
        .single();

      if (jobError || !job) {
        console.error('Erro ao criar job:', JSON.stringify(jobError));
        return res.status(500).json({ error: 'Erro ao iniciar importação' });
      }

      // ── Extração (B10: separar questões; B11: preservar visuais; B12: gabarito) ──
      try {
        const result = await extractQuestionsFromPdf(file.buffer);
        const catalog = await this.fetchCatalogForOrg(req.organizationId!);

        // Classificação assistida por IA (B13) — opcional, sequencial
        const inserted: any[] = [];
        for (const [index, q] of result.questions.entries()) {
          let suggestion: { catalogItemId: string | null; source: 'ai' | 'professor' | null; suggestedName?: string } | null = null;
          if (q.statement.replace(/\([A-Ea-e]\)\s*$/, '').trim().length > 0) {
            suggestion = await classifyQuestion(
              q.statement + '\n' + q.alternatives.map((a) => `${a.letter}) ${a.text}`).join('\n'),
              catalog.map((c) => ({ id: c.id, level: c.level, name: c.name, parentId: c.parentId }))
            );
          }

          const { data: created, error: qErr } = await supabase
            .from('questions')
            .insert({
              id: randomUUID(),
              organizationId: req.organizationId!,
              importJobId: job.id,
              createdBy: req.userId!,
              number: q.number ?? index + 1,
              statement: q.statement,
              alternatives: q.alternatives.filter((a) => a.text.trim().length > 0),
              images: q.images,
              gabarito: q.gabarito?.toUpperCase() ?? null,
              gabaritoOrigin: q.gabarito ? 'document' : null,
              gabaritoConfidence: q.gabarito ? (result.answeredFromKey ? 0.95 : 0.6) : null,
              catalogItemId: suggestion?.catalogItemId ?? null,
              classificationSource: suggestion?.source ?? null,
              status: 'pending',
              updatedAt: now,
            })
            .select('id, number, statement, alternatives, images, gabarito, gabaritoOrigin, catalogItemId, classificationSource, status')
            .single();

          if (qErr) {
            console.error('Erro ao inserir questão:', JSON.stringify(qErr));
          } else if (created) {
            inserted.push(created);
          }
        }

        const { error: updateError } = await supabase
          .from('import_jobs')
          .update({
            status: 'completed',
            totalQuestions: inserted.length,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', job.id);

        if (updateError) console.error('Erro ao finalizar job:', JSON.stringify(updateError));

        await logAudit({
          organizationId: req.organizationId!,
          userId: req.userId!,
          action: 'create',
          entityType: 'import_job',
          entityId: job.id,
          details: { fileName: file.originalname, totalQuestions: inserted.length },
        });

        return res.status(201).json({
          job: { ...job, status: 'completed', totalQuestions: inserted.length },
          questions: inserted,
          warnImages:
            'Os elementos visuais detectados foram preservados como referências. ' +
            'A extração completa de imagens do PDF é uma melhoria pós-piloto; revise cada questão visualmente.',
        });
      } catch (extractError) {
        console.error('Erro na extração:', extractError);
        const { error } = await supabase
          .from('import_jobs')
          .update({
            status: 'failed',
            errorMessage: extractError instanceof Error ? extractError.message : 'Falha ao processar o PDF',
            updatedAt: new Date().toISOString(),
          })
          .eq('id', job.id);
        if (error) console.error(error);
        return res.status(500).json({ error: 'Não foi possível interpretar o PDF', jobId: job.id });
      }
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: error?.message ?? 'Erro ao processar o arquivo' });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('organizationId', req.organizationId!)
        .eq('userId', req.userId!)
        .order('createdAt', { ascending: false });
      if (error) return res.status(500).json({ error: 'Erro ao listar importações' });
      return res.json(data ?? []);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao listar importações' });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: job, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', id)
        .eq('organizationId', req.organizationId!)
        .single();
      if (error || !job) return res.status(404).json({ error: 'Importação não encontrada' });

      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('importJobId', id)
        .eq('organizationId', req.organizationId!)
        .order('number', { ascending: true });
      if (qErr) return res.status(500).json({ error: 'Erro ao listar questões' });

      return res.json({ ...job, questions: questions ?? [] });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar importação' });
    }
  }

  private async fetchCatalogForOrg(orgId: string) {
    const { data } = await supabase
      .from('catalog_items')
      .select('id, level, name, parentId')
      .eq('organizationId', orgId);
    return data ?? [];
  }
}

export { upload as importUploadMiddleware };