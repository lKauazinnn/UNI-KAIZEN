import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { api } from '../../services/api';
import { MyResult } from '../../types';
import { PageHeader, Card, Badge, Spinner, ProgressBar } from '../../components/ui';
import { QuestionView } from '../../components/QuestionView';

export default function ExamResult() {
  const { id } = useParams();
  const location = useLocation();
  const summary = (location.state as any)?.summary as { correct: number; total: number; percent: number } | null;

  const [data, setData] = useState<MyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/exams/${id}/my-result`).then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner label="Corrigindo seu simulado..." />;
  if (!data) return <div className="py-16 text-center text-sm text-slate-400">Nenhum resultado disponível para este simulado.</div>;

  const percent = data.percent ?? summary?.percent ?? 0;

  const feedback =
    percent >= 70
      ? 'Excelente! Você dominou bem o conteúdo.'
      : percent >= 50
        ? 'Bom trabalho! Revise os pontos abaixo para melhorar.'
        : 'Continue praticando. Releia as questões erradas e refaça o conteúdo.';

  return (
    <div className="animate-fade-in max-w-3xl">
      <Link to="/aluno/simulados" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Simulados
      </Link>

      <PageHeader title="Resultado do simulado" />

      <Card className="mb-6 text-center py-10">
        <div className="mx-auto mb-4 w-fit p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20">
          <Trophy size={32} className="text-primary-400" />
        </div>
        <p className="text-5xl font-bold text-slate-100 mb-2">{percent}%</p>
        <p className="text-slate-300 mb-1">
          Você acertou <b className="text-primary-300">{data.correct}</b> de <b className="text-slate-100">{data.total}</b> questões.
        </p>
        <p className="text-sm text-slate-400">{feedback}</p>
        <div className="max-w-sm mx-auto mt-5"><ProgressBar percent={percent} /></div>
      </Card>

      <Card>
        <h2 className="font-bold text-slate-100 mb-1">Revisão por questão</h2>
        <p className="text-sm text-slate-400 mb-4">Veja o gabarito oficial e compare com sua resposta.</p>
        <div className="space-y-4">
          {data.questions.map((q, i) => {
            const isCorrect = q.isCorrect;
            return (
              <div key={i} className="rounded-xl border border-[color:var(--border)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone="neutral">Questão {q.number ?? i + 1}</Badge>
                  {isCorrect === null ? (
                    <Badge tone="amber">Não respondida</Badge>
                  ) : isCorrect ? (
                    <Badge tone="green">Correta ✓</Badge>
                  ) : (
                    <Badge tone="red">Errada ✗</Badge>
                  )}
                </div>
                <QuestionView
                  question={{
                    id: `result-${i}`,
                    organizationId: '',
                    createdBy: '',
                    statement: q.statement,
                    alternatives: q.alternatives ?? [],
                    images: q.images ?? [],
                    gabarito: q.gabarito,
                    status: 'approved',
                    createdAt: '',
                  }}
                  mode="result"
                  index={i}
                  selected={q.selected}
                />
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-slate-400">
                    Sua resposta: <b className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>{q.selected ?? '—'}</b>
                  </span>
                  <span className="text-slate-400">
                    Gabarito: <b className="text-primary-300">{q.gabarito ?? '—'}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
