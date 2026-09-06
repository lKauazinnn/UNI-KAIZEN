import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send, Timer } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { TakeData, TakeQuestion } from '../../types';
import { PageHeader, Button, Badge, Spinner, ConfirmDialog } from '../../components/ui';

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<TakeData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const started = await api.post(`/exams/${id}/start`);
        if (started.data?.status === 'submitted') {
          navigate(`/aluno/simulados/${id}/resultado`, { replace: true });
          return;
        }
        const { data } = await api.get(`/exams/${id}/take`);
        const map: Record<string, string | null> = {};
        data.questions.forEach((q: TakeQuestion) => { map[q.id] = q.selected; });
        setAnswers(map);
        setData(data);
      } catch (err) {
        const msg = apiError(err);
        if (msg.includes('não')) {
          navigate('/aluno/simulados', { replace: true });
          return;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!data?.attempt) return;
    const interval = window.setInterval(async () => {
      const entries = Object.entries(answers).filter(([, v]) => v !== null);
      if (entries.length === 0) return;
      setSaving(true);
      try {
        await api.put(`/attempts/${data.attempt.id}/answers`, {
          answers: Object.entries(answers)
            .filter(([, v]) => v !== null)
            .map(([questionId, selected]) => ({ questionId, selected })),
        });
        setLastSaved(new Date());
      } catch {
        /* silencioso: salva novamente no próximo tick */
      } finally {
        setSaving(false);
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [data, answers]);

  const select = (questionId: string, letter: string | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
    setError('');
  };

  const saveNow = async () => {
    if (!data?.attempt) return;
    setSaving(true);
    try {
      await api.put(`/attempts/${data.attempt.id}/answers`, {
        answers: Object.entries(answers)
          .filter(([, v]) => v !== null)
          .map(([questionId, selected]) => ({ questionId, selected })),
      });
      setLastSaved(new Date());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!data?.attempt) return;
    setSaving(true);
    try {
      await saveNow();
      const { data: result } = await api.post(`/attempts/${data.attempt.id}/submit`);
      navigate(`/aluno/simulados/${id}/resultado`, { state: { summary: { correct: result.correct, total: result.total, percent: result.percent } }, replace: true });
    } catch (err) {
      setError(apiError(err));
      setConfirmSubmit(false);
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Preparando seu simulado..." />;
  if (!data) return <div className="py-16 text-center text-sm text-slate-400">{error || 'Não foi possível carregar o simulado.'}</div>;

  const answered = Object.values(answers).filter((v) => v !== null).length;

  return (
    <div className="animate-fade-in max-w-3xl">
      <Link to="/aluno/simulados" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Simulados
      </Link>

      <PageHeader
        title={data.examTitle}
        subtitle={`${data.questions.length} questão(ões)`}
        actions={
          <div className="flex items-center gap-3">
            {lastSaved && <span className="text-xs text-slate-500">Salvo às {lastSaved.toLocaleTimeString('pt-BR')}</span>}
            {saving && <span className="text-xs text-slate-400 animate-pulse-soft">Salvando...</span>}
            <Badge tone={answered === data.questions.length ? 'green' : 'amber'}>
              {answered}/{data.questions.length} respondidas
            </Badge>
          </div>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

      <div className="space-y-5">
        {data.questions.map((q, index) => (
          <div key={q.id} className="rounded-2xl bg-[color:var(--bg-card)] border border-[color:var(--border)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="neutral">Questão {q.number ?? index + 1}</Badge>
              {answers[q.id] && <Badge tone="teal">Respondida: {answers[q.id]}</Badge>}
            </div>
            <p className="text-slate-100 leading-relaxed whitespace-pre-wrap mb-4">{q.statement}</p>
            {q.images && q.images.length > 0 && (
              q.images[0]?.url ? (
                <div className="mb-4 rounded-xl border border-[color:var(--border)] overflow-hidden">
                  <img src={q.images[0].url} alt={q.images[0].caption || 'Elemento visual da questão'} className="w-full h-auto" />
                  {q.images[0].caption && (
                    <p className="px-3 py-2 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/60">{q.images[0].caption}</p>
                  )}
                </div>
              ) : (
              <div className="mb-4 rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
                <p className="text-xs text-slate-400">{q.images.map((i) => i.caption || i.type || 'Figura').join(' · ')}</p>
              </div>
              )
            )}
            <div className="space-y-2.5">
              {q.alternatives.map((alt) => {
                const isSelected = answers[q.id] === alt.letter;
                return (
                  <button
                    key={alt.letter}
                    onClick={() => select(q.id, isSelected ? null : alt.letter)}
                    className={`w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      isSelected
                        ? 'border-primary-500/60 bg-primary-500/10'
                        : 'border-[color:var(--border)] hover:border-slate-500'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition ${
                        isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-500 text-slate-300'
                      }`}
                    >
                      {alt.letter}
                    </span>
                    <span className="text-sm text-slate-200 leading-relaxed">{alt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-16 lg:bottom-4 mt-8 bg-[color:var(--bg-card)]/90 backdrop-blur rounded-2xl border border-[color:var(--border)] p-4 flex flex-col sm:flex-row items-center gap-3">
        {answered === data.questions.length ? (
          <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 flex-1">
            <CheckCircle2 size={16} /> Todas as questões respondidas — você pode finalizar.
          </span>
        ) : (
          <span className="text-sm text-slate-400 flex-1">
            Responda todas as questões para finalizar. Suas respostas são salvas automaticamente.
          </span>
        )}
        <Button variant="outline" onClick={saveNow} disabled={saving} className="w-full sm:w-auto">
          <Timer size={16} /> Salvar respostas
        </Button>
        <Button onClick={() => setConfirmSubmit(true)} disabled={saving || answered === 0} className="w-full sm:w-auto bg-primary-500">
          <Send size={16} /> Finalizar e corrigir
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={submit}
        title="Finalizar simulado"
        message={`Você respondeu ${answered} de ${data.questions.length} questão(ões). Após entregar, não é possível alterar as respostas.`}
        confirmLabel="Finalizar e corrigir"
      />
    </div>
  );
}