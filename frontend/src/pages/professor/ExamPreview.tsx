import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Archive, ClipboardList, Users } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Exam } from '../../types';
import { PageHeader, Button, Card, Badge, Spinner, ConfirmDialog } from '../../components/ui';
import { QuestionView } from '../../components/QuestionView';

const examId = () => useParams<{ id: string }>().id;

export default function ExamPreview() {
  const id = examId();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const load = () => {
    if (!id) return;
    api.get(`/exams/${id}`).then(({ data }) => setExam(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const publish = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post(`/exams/${id}/publish`);
      setFeedback('Simulado publicado para a turma.');
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
      setConfirmPublish(false);
    }
  };

  const archive = async () => {
    setBusy(true);
    try {
      await api.post(`/exams/${id}/archive`);
      setFeedback('Simulado arquivado.');
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Carregando simulado..." />;
  if (!exam) return <Card><div className="py-8 text-center text-sm text-slate-400">Simulado não encontrado</div></Card>;

  const questions = exam.questions ?? [];
  const isPublished = exam.status === 'published';

  return (
    <div className="animate-fade-in max-w-3xl">
      <Link to="/professor/simulados" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Simulados
      </Link>

      <PageHeader
        title={exam.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Users size={14} className="inline -mt-0.5" /> {exam.turmas?.name}
            <Badge tone={isPublished ? 'green' : exam.status === 'draft' ? 'amber' : 'neutral'}>
              {isPublished ? 'Publicado' : exam.status === 'draft' ? 'Rascunho' : 'Arquivado'}
            </Badge>
            <span>{questions.length} questão(ões)</span>
          </span>
        }
        actions={
          <>
            {exam.status === 'draft' && (
              <Button variant="success" onClick={() => setConfirmPublish(true)} loading={busy}>
                <Send size={16} /> Publicar
              </Button>
            )}
            <Button variant="outline" onClick={archive} disabled={busy || exam.status === 'archived'}>
              <Archive size={16} />
              {exam.status === 'archived' ? 'Arquivado' : 'Arquivar'}
            </Button>
            {isPublished && (
              <Link to={`/professor/resultados?examId=${exam.id}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20">
                Ver resultados
              </Link>
            )}
          </>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}

      {!isPublished && (
        <div className="mb-6 rounded-2xl border border-primary-500/20 bg-primary-500/5 px-5 py-4 text-sm text-slate-300 flex items-center gap-3">
          <ClipboardList size={16} className="text-primary-300" />
          Pré-visualização exata do que o aluno verá ao responder. Publique para liberar para a turma.
        </div>
      )}

      <div className="space-y-4 pb-10">
        {questions.map((eq, index) => (
          <Card key={eq.id} className="!p-5">
            {/* B20: a pré-visualização é a experiência do ALUNO. O gabarito não
                aparece aqui — ele é conferido na tela de revisão da questão. */}
            <QuestionView question={eq.questions as any} mode="exam" readOnly index={index} compact />
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={publish}
        title="Publicar simulado"
        message={`O simulado "${exam.title}" ficará disponível para ${exam.turmas?.name}. Depois de publicado não é possível editá-lo.`}
        confirmLabel="Publicar"
      />
    </div>
  );
}
