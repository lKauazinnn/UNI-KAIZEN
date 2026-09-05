import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Inbox, ClipboardList, ArrowRight, FileQuestion, FileUp } from 'lucide-react';
import { api } from '../../services/api';
import { ProfessorDashboard } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState } from '../../components/ui';

const statusTone: Record<string, 'amber' | 'green' | 'neutral' | 'red'> = {
  draft: 'amber',
  published: 'green',
  archived: 'neutral',
  failed: 'red',
};

export default function ProfessorHome() {
  const [data, setData] = useState<ProfessorDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/professor').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Carregando painel..." />;

  const stats = [
    { label: 'Turmas', value: data?.turmas.length ?? 0, to: '/professor/turmas', icon: Users },
    { label: 'Revisões pendentes', value: data?.pendingReviews ?? 0, to: '/professor/questoes', icon: FileQuestion },
    { label: 'Simulados recentes', value: data?.recentExams.length ?? 0, to: '/professor/simulados', icon: ClipboardList },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Painel do professor"
        subtitle="O que precisa da sua atenção hoje."
        actions={
          <>
            <Link to="/professor/importar" className="text-sm font-semibold text-primary-300 hover:text-primary-200 bg-primary-500/10 border border-primary-500/20 px-4 py-2.5 rounded-xl">
              <FileUp size={16} className="inline mr-1.5 -mt-0.5" />
              Importar PDF
            </Link>
            <Link to="/professor/simulados/novo" className="text-sm font-semibold text-white bg-primary-500 hover:bg-primary-400 px-4 py-2.5 rounded-xl shadow-lg shadow-primary-500/20">
              Novo simulado
            </Link>
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="block">
            <Card hover className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
                <stat.icon size={22} className="text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-slate-500" />
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-100">Turmas</h2>
            <Link to="/professor/turmas" className="text-sm font-semibold text-primary-300 hover:text-primary-200">Ver todas</Link>
          </div>
          {data?.turmas.length === 0 ? (
            <EmptyState title="Nenhuma turma ainda" description="Crie uma turma para vincular alunos." />
          ) : (
            <div className="space-y-2">
              {data?.turmas.map((t) => (
                <Link key={t.id} to={`/professor/turmas/${t.id}`} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition">
                  <div className="p-2 rounded-lg bg-slate-500/10"><Users size={16} className="text-slate-400" /></div>
                  <span className="font-semibold text-slate-200">{t.name}</span>
                  {t.archived && <Badge tone="neutral">Arquivada</Badge>}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-100">Simulados recentes</h2>
            <Link to="/professor/simulados" className="text-sm font-semibold text-primary-300 hover:text-primary-200">Ver todos</Link>
          </div>
          {data?.recentExams.length === 0 ? (
            <EmptyState title="Nenhum simulado" description="Crie um simulado a partir do banco de questões aprovadas." />
          ) : (
            <div className="space-y-2">
              {data?.recentExams.map((e: any) => (
                <Link key={e.id} to={`/professor/simulados/${e.id}`} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{e.title}</p>
                    <p className="text-xs text-slate-400">{e.turmas?.name}</p>
                  </div>
                  <Badge tone={statusTone[e.status] ?? 'neutral'}>
                    {e.status === 'draft' ? 'Rascunho' : e.status === 'published' ? 'Publicado' : 'Arquivado'}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {data && data.pendingReviews > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10"><Inbox size={20} className="text-amber-400" /></div>
          <div className="flex-1">
            <p className="font-bold text-amber-300">{data.pendingReviews} questão(is) aguardando revisão</p>
            <p className="text-sm text-slate-300">Revise o que a IA preparou e aprove para liberar no banco de questões.</p>
          </div>
          <Link to="/professor/questoes" className="text-sm font-semibold text-white bg-amber-500 hover:bg-amber-400 px-4 py-2.5 rounded-xl">
            Revisar agora
          </Link>
        </div>
      )}
    </div>
  );
}