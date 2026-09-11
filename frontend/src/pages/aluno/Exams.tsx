import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Timer, Play } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Exam } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Button } from '../../components/ui';

export default function AlunoExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const turmaId = searchParams.get('turmaId');

  useEffect(() => {
    api.get('/exams').then(({ data }) => setExams(Array.isArray(data) ? data : [])).catch((err) => setError(apiError(err))).finally(() => setLoading(false));
  }, []);

  const visibleExams = turmaId ? exams.filter((exam) => exam.turmaId === turmaId) : exams;
  const turmaName = visibleExams[0]?.turmas?.name;

  return (
    <div className="animate-fade-in">
      <PageHeader title={turmaName ? `Simulados de ${turmaName}` : 'Simulados'} subtitle="Escolha um simulado publicado para responder." />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <Spinner label="Carregando simulados..." />
      ) : visibleExams.length === 0 ? (
        <Card><EmptyState title="Nenhum simulado publicado" description="Quando o professor publicar um simulado ele aparecerá aqui." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visibleExams.map((exam) => {
            const started = exam.hasAttempt;
            return (
              <Link key={exam.id} to={started ? `/aluno/simulados/${exam.id}/responder` : `/aluno/simulados/${exam.id}/responder`} className="block">
                <Card hover className="h-full flex flex-col">
                  <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 w-fit mb-4">
                    <BookOpen size={22} className="text-primary-400" />
                  </div>
                  <h3 className="font-bold text-slate-100 mb-1 flex-1">{exam.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Timer size={12} /> {exam.turmas?.name}
                    </span>
                    <span className="text-sm font-semibold text-primary-300 flex items-center gap-1.5">
                      <Play size={14} /> {started ? 'Continuar' : 'Iniciar'}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
