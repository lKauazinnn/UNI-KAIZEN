import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import { api } from '../../services/api';
import { Exam } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Button } from '../../components/ui';

const statusTone: Record<string, 'amber' | 'green' | 'neutral'> = { draft: 'amber', published: 'green', archived: 'neutral' };

export default function Exams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exams').then(({ data }) => setExams(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Simulados"
        subtitle="Monte um simulado com questões aprovadas e publique para a turma."
        actions={<Link to="/professor/simulados/novo"><Button><Plus size={16} /> Novo simulado</Button></Link>}
      />

      {loading ? (
        <Spinner label="Carregando simulados..." />
      ) : exams.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum simulado"
            description="Crie seu primeiro simulado selecionando questões aprovadas do banco."
            action={<Link to="/professor/simulados/novo"><Button><Plus size={16} /> Novo simulado</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <Link key={exam.id} to={`/professor/simulados/${exam.id}`} className="block">
              <Card hover>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 shrink-0">
                    <ClipboardList size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-100">{exam.title}</p>
                      <Badge tone={statusTone[exam.status] ?? 'neutral'}>
                        {exam.status === 'draft' ? 'Rascunho' : exam.status === 'published' ? 'Publicado' : 'Arquivado'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {exam.turmas?.name ?? 'Turma'} · {exam.questions?.length ?? 0} questão(ões) ·{' '}
                      {exam.status === 'published' && exam.publishedAt
                        ? `Publicado em ${new Date(exam.publishedAt).toLocaleDateString('pt-BR')}`
                        : `Criado em ${new Date(exam.createdAt).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <span className="text-slate-500 text-sm font-semibold shrink-0 hidden sm:block">
                    {exam.status === 'draft' ? 'Pré-visualizar' : exam.status === 'published' ? 'Ver resultados' : 'Ver'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}