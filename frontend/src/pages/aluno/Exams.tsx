import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Timer, Play } from 'lucide-react';
import { api } from '../../services/api';
import { Exam } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Button } from '../../components/ui';

export default function AlunoExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exams').then(({ data }) => setExams(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Simulados" subtitle="Escolha um simulado publicado para sua turma." />

      {loading ? (
        <Spinner label="Carregando simulados..." />
      ) : exams.length === 0 ? (
        <Card><EmptyState title="Nenhum simulado publicado" description="Quando o professor publicar um simulado ele aparecerá aqui." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {exams.map((exam) => {
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