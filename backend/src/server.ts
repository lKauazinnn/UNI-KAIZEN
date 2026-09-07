import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MulterError } from 'multer';
import authRoutes from './routes/auth.routes';
import classRoutes from './routes/class.routes';
import catalogRoutes from './routes/catalog.routes';
import importRoutes from './routes/import.routes';
import questionRoutes from './routes/question.routes';
import examRoutes from './routes/exam.routes';
import attemptRoutes from './routes/attempt.routes';
import noticeRoutes from './routes/notice.routes';
import auditRoutes from './routes/audit.routes';
import adminRoutes from './routes/admin.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { MAX_UPLOAD_MB } from './controllers/import.controller';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

// Na Vercel o app roda como Serverless Function (api/index.ts) e não pode
// chamar listen(); localmente ele sobe um servidor de processo normal.
const IS_SERVERLESS = Boolean(process.env.VERCEL);

class CorsError extends Error {
  constructor(public origin: string) {
    super(`Origem não permitida pelo CORS: ${origin}`);
    this.name = 'CorsError';
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────
// FRONTEND_URL aceita uma lista separada por vírgula. Vazio = libera tudo
// (conveniente em dev; em produção defina a URL pública do frontend).
const allowedOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Cada deploy de preview da Vercel tem um subdomínio novo, então a lista fixa
// nunca bate. Ligue esta flag só se precisar testar previews no navegador —
// a API exige Bearer token e não usa cookies, mas ainda assim fica mais larga.
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true';
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(cors({
  origin(origin, callback) {
    // Sem Origin: curl, health check, chamada server-to-server.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);

    const normalized = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    if (allowVercelPreviews && VERCEL_PREVIEW_RE.test(normalized)) return callback(null, true);

    console.warn(`[cors] origem bloqueada: ${origin} (permitidas: ${allowedOrigins.join(', ') || 'todas'})`);
    return callback(new CorsError(origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Kaizen Laboratórios Educacionais API. Use /api/*.' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Diagnóstico de ambiente — só fora de produção, e sem expor URLs/segredos.
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', async (req, res) => {
    const supabase = (await import('./lib/supabase')).default;
    const { error } = await supabase.from('users').select('count').limit(1);
    res.json({
      dbReachable: !error,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasAi: Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
      aiProvider: process.env.GEMINI_API_KEY ? 'gemini' : process.env.GROQ_API_KEY ? 'groq' : null,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    });
  });
}

// Tratamento de erro central
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof MulterError) {
    // LIMIT_FILE_SIZE tem mensagem genérica ("File too large"); explicitamos o teto.
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Arquivo muito grande. O limite é ${MAX_UPLOAD_MB} MB por upload.` });
    }
    return res.status(400).json({ error: err.message });
  }
  // Erros do express.json(): sem isso um corpo malformado cai no 500 generico
  // abaixo e vira ruido de log, como se o servidor tivesse falhado.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição excede o limite.' });
  }
  if (err instanceof CorsError) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[server] erro:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`🚀 Kaizen API running on http://localhost:${PORT}`);
  });
}

export default app;
