import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Bell, Target } from 'lucide-react';
import { api } from '../../services/api';
import { AlunoDashboard } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, ProgressBar } from '../../components/ui';

export default function AlunoHome() {
  const [data, setData] = useState<AlunoDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/aluno').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Carregando sala de aula..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Olá, vamos praticar!" subtitle="Responda os simulados publicados pelos seus professores." />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-100 flex items-center gap-2"><BookOpen size={16} className="text-primary-400" /> Simulados disponíveis</h2>
              {data?.exams.length ? <Link to="/aluno/simulados" className="text-sm font-semibold text-primary-300 hover:text-primary-200">Ver todos</Link> : null}
            </div>
            {!data?.exams.length ? (
              <EmptyState title="Nenhum simulado disponível" description="Aguarde o professor publicar um simulado para sua turma." />
            ) : (
              <div className="space-y-2">
                {data.exams.slice(0, 5).map((exam) => (
                  <Link key={exam.id} to={`/aluno/simulados/${exam.id}/responder`} className="block rounded-xl border border-[color:var(--border)] px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 truncate">{exam.title}</p>
                        <p className="text-xs text-slate-400">{exam.turmas?.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary-300 shrink-0">Iniciar →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-100 flex items-center gap-2"><Target size={16} className="text-primary-400" /> Meus resultados</h2>
              {data?.results.length ? <Link to="/aluno/resultados" className="text-sm font-semibold text-primary-300 hover:text-primary-200">Ver histórico</Link> : null}
            </div>
            {!data?.results.length ? (
              <p className="text-sm text-slate-400">Você ainda não entregou nenhum simulado.</p>
            ) : (
              <div className="space-y-3">
                {data.results.slice(0, 5).map((r) => (
                  <div key={r.attemptId} className="rounded-xl border border-[color:var(--border)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-slate-200 truncate">{r.examTitle}</p>
                      <span className="text-sm font-bold text-primary-300 shrink-0">{r.percent}%</span>
                    </div>
                    <ProgressBar percent={r.percent} />
                    <p className="text-xs text-slate-500 mt-1.5">{r.correct} de {r.total} corretas</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <h2 className="font-bold text-slate-100 flex items-center gap-2 mb-4"><Bell size={16} className="text-primary-400" /> Avisos</h2>
          {!data?.notices.length ? (
            <p className="text-sm text-slate-400">Nenhum aviso por enquanto.</p>
          ) : (
            <div className="space-y-3">
              {data.notices.slice(0, 10).map((n) => (
                <div key={n.id} className="rounded-xl border border-[color:var(--border)] p-3">
                  <p className="text-sm text-slate-200">{n.message}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {n.turmas?.name} · {n.users?.name} · {new Date(n.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}