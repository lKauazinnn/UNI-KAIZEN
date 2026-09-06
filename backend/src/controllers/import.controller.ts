import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import multer from 'multer';
import supabase from '../lib/supabase';
import { AuthRequest } from '../middlewares/auth.middleware';
import { extractQuestionsFromPdf } from '../lib/pdf';
import { extractVisualRegions } from '../lib/pdf-visuals';
import { classifyQuestion } from '../lib/ai';
import { logAudit } from '../lib/audit';

const VISUAL_BUCKET = 'question-visuals';

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

        // B11: renderiza cada página e recorta a região visual de cada questão
        const regions = await extractVisualRegions(file.buffer).catch((visualError) => {
          console.error('[import] falha ao extrair visuais:', visualError);
          return [];
        });
        const regionByNumber = new Map<number, any>();
        for (const region of regions) {
          if (!regionByNumber.has(region.questionNumber)) regionByNumber.set(region.questionNumber, region);
        }

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

          const region = regionByNumber.get(q.number ?? -1);
          let images = q.images;
          if (region) {
            const key = `pag${region.pageIndex}-q${q.number ?? index + 1}.png`;
            const url = await this.uploadVisual(req.organizationId!, job.id, key, region.buffer);
            if (url) {
              images = [
                {
                  url,
                  caption: q.images.length > 0 ? q.images[0].caption : `Visual da página ${region.pageIndex}`,
                  source: 'pdf-page',
                  page: region.pageIndex,
                },
              ];
            }
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
              images,
              // A origem vem do extrator, por questão. Palpite heurístico NUNCA
              // é gravado como 'document' (B12).
              gabarito: q.gabarito?.toUpperCase() ?? null,
              gabaritoOrigin: q.gabarito ? q.gabaritoOrigin ?? 'heuristic' : null,
              gabaritoConfidence: q.gabarito ? q.gabaritoConfidence ?? 0.4 : null,
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
            regionByNumber.size === 0
              ? 'Não foi possível extrair automaticamente o visual de cada questão deste PDF. Revise cada questão visualmente antes de aprovar.'
              : undefined,
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

  // ─── Supabase Storage (B11: gráficos/imagens reais por questão) ──────────
  private async ensureVisualBucket() {
    const { error } = await supabase.storage.getBucket(VISUAL_BUCKET);
    if (!error) return;
    const { error: createError } = await supabase.storage.createBucket(VISUAL_BUCKET, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
    });
    if (createError) {
      console.error('[storage] erro ao criar bucket:', createError.message);
    }
  }

  private async uploadVisual(orgId: string, jobId: string, key: string, buffer: Buffer): Promise<string | null> {
    await this.ensureVisualBucket();
    const path = `${orgId}/${jobId}/${key}`;
    const { error: uploadError } = await supabase.storage
      .from(VISUAL_BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      console.error('[storage] erro ao enviar visual:', uploadError.message);
      return null;
    }
    const { data } = await supabase.storage.from(VISUAL_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  }
}

export { upload as importUploadMiddleware };