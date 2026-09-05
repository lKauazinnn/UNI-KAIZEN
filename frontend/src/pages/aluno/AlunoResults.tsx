import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { api } from '../../services/api';
import { AlunoDashboard } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, ProgressBar, Button } from '../../components/ui';

export default function AlunoResults() {
  const [data, setData] = useState<AlunoDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/aluno').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Carregando histórico..." />;

  const results = data?.results ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Meus resultados" subtitle="Seu histórico de desempenho nos simulados entregues." />

      {results.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum resultado ainda"
            description="Entregue um simulado para ver seu desempenho aqui."
            action={<Link to="/aluno/simulados"><Button><BarChart3 size={16} /> Ver simulados</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <Link key={r.attemptId} to={`/aluno/simulados/${r.examId}/resultado`} className="block">
              <Card hover>
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 truncate">{r.examTitle}</p>
                    <p className="text-xs text-slate-400">{r.turmaName} · {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('pt-BR') : ''}</p>
                  </div>
                  <span className="text-xl font-bold text-primary-300 shrink-0">{r.percent}%</span>
                </div>
                <ProgressBar percent={r.percent} />
                <p className="text-xs text-slate-500 mt-1.5">{r.correct} de {r.total} corretas</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}