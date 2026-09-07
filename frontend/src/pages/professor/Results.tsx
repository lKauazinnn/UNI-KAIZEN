import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, ClipboardList } from 'lucide-react';
import { api } from '../../services/api';
import { Exam, ByExamResults, ByQuestionResults } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Select, ProgressBar } from '../../components/ui';

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const examId = searchParams.get('examId') ?? '';

  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [byExam, setByExam] = useState<ByExamResults | null>(null);
  const [byQuestion, setByQuestion] = useState<ByQuestionResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/exams').then(({ data }) => setExams(data.filter((e: Exam) => e.status === 'published'))).catch(() => {}).finally(() => setLoadingExams(false));
  }, []);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    Promise.all([api.get(`/exams/${examId}/results`), api.get(`/exams/${examId}/results/by-question`)])
      .then(([a, q]) => {
        setByExam(a.data);
        setByQuestion(q.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [examId]);

  const submitted = byExam?.students.filter((s) => s.status === 'submitted') ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Resultados" subtitle="Acompanhe o desempenho da turma em cada simulado." />

      <Card className="mb-6 !p-4">
        <Select value={examId} onChange={(e) => setSearchParams(e.target.value ? { examId: e.target.value } : {})} className="max-w-md">
          <option value="">Selecione um simulado publicado...</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{e.title} — {e.turmas?.name}</option>
          ))}
        </Select>
      </Card>

      {loadingExams ? (
        <Spinner label="Carregando simulados..." />
      ) : !examId ? (
        <Card>
          <EmptyState title="Escolha um simulado" description="Selecione um simulado publicado no menu acima para ver os resultados." />
        </Card>
      ) : loading ? (
        <Spinner label="Carregando resultados..." />
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-100 flex items-center gap-2"><BarChart3 size={16} className="text-primary-400" /> Desempenho por aluno</h2>
              <span className="text-sm text-slate-400">{submitted.length}/{byExam?.students.length} alunos responderam</span>
            </div>
            <div className="space-y-2">
              {byExam?.students.map((s) => (
                <div key={s.studentId} className="rounded-xl border border-[color:var(--border)] p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">{s.email}</p>
                    </div>
                    {s.status === 'submitted' ? (
                      <span className="text-sm font-bold text-primary-300 shrink-0">{s.percent}%</span>
                    ) : (
                      <Badge tone={s.status === 'in_progress' ? 'amber' : 'neutral'}>
                        {s.status === 'in_progress' ? 'Em andamento' : 'Não iniciou'}
                      </Badge>
                    )}
                  </div>
                  {s.status === 'submitted' && (
                    <>
                      <ProgressBar percent={s.percent} />
                      <p className="text-xs text-slate-500 mt-1.5">
                        {s.correct} de {byExam?.total} corretas · {s.submittedAt ? `entregue em ${new Date(s.submittedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-100 flex items-center gap-2"><ClipboardList size={16} className="text-primary-400" /> Detalhe por questão</h2>
              <span className="text-sm text-slate-400">{byQuestion?.totalResponded ?? 0} respostas</span>
            </div>
            {!byQuestion?.questions?.length ? (
              <p className="text-sm text-slate-400">Nenhuma resposta enviada ainda.</p>
            ) : (
              <div className="space-y-3">
                {byQuestion.questions.map((q, i) => (
                  <div key={q.questionId} className="rounded-xl border border-[color:var(--border)] p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Badge tone="neutral">Questão {q.number ?? i + 1}</Badge>
                        <span className="text-sm text-slate-300 line-clamp-1">{q.statement}</span>
                      </div>
                      <span className="text-sm font-bold shrink-0" style={{ color: q.rate >= 60 ? '#34d399' : q.rate >= 40 ? '#fbbf24' : '#f87171' }}>
                        {q.rate}%
                      </span>
                    </div>
                    <ProgressBar percent={q.rate} color={q.rate >= 60 ? 'bg-emerald-400' : q.rate >= 40 ? 'bg-amber-400' : 'bg-red-400'} />
                    <p className="text-xs text-slate-500 mt-1.5">
                      {q.correct} acertos em {q.answered} respostas · {byQuestion?.totalAlunos ?? 0} aluno(s) na turma
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}