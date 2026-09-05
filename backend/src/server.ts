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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
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

app.get('/debug', async (req, res) => {
  const supabase = (await import('./lib/supabase')).default;
  const { data, error } = await supabase.from('users').select('count').limit(1);
  res.json({
    data,
    error,
    url: process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasAi: Boolean(process.env.GROQ_API_KEY),
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
  });
});

// Tratamento de erro central
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[server] erro:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Kaizen API running on http://localhost:${PORT}`);
  });
}

export default app;