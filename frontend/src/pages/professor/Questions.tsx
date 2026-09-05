import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileQuestion, ChevronRight, CheckCheck } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Question } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Button } from '../../components/ui';

const tabs = [
  { key: 'pending', label: 'Revisar' },
  { key: 'approved', label: 'Banco aprovado' },
  { key: 'rejected', label: 'Rejeitadas' },
  { key: 'all', label: 'Todas' },
] as const;

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get('status') ?? 'pending');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchMsg, setBatchMsg] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/questions', { params: { status: tab === 'all' ? 'all' : tab } })
      .then(({ data }) => setQuestions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTab(searchParams.get('status') ?? 'pending');
  }, [searchParams]);

  useEffect(load, [tab]);

  const countOf: Record<string, number> = {
    pending: (questions).filter((q) => q.status === 'pending').length,
  };

  const approveValidBatch = async () => {
    setBatchMsg('');
    try {
      const { data } = await api.post('/questions/approve-valid');
      const rejected = (data.rejected ?? []).length;
      setBatchMsg(`Lote processado: ${data.approved} aprovada(s), ${rejected} rejeitada(s) por invalida.`);
      setTimeout(() => setBatchMsg(''), 6000);
      load();
    } catch (err) {
      setBatchMsg(apiError(err));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Banco de questões"
        subtitle="A IA prepara. Você confere e aprova."
        actions={
          tab === 'pending' ? (
            <Button variant="success" onClick={approveValidBatch}>
              <CheckCheck size={16} /> Aprovar válidas em lote
            </Button>
          ) : undefined
        }
      />

      {batchMsg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${batchMsg.includes('rejeitada') && !batchMsg.includes('Lote') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {batchMsg}
        </div>
      )}

      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1.5 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              tab === t.key ? 'bg-white dark:bg-slate-900 text-primary-500 shadow' : 'text-slate-500'
            }`}
          >
            {t.label}
            {t.key === 'pending' && countOf.pending > 0 && <span className="ml-1.5 text-xs">({countOf.pending})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Carregando questões..." />
      ) : questions.length === 0 ? (
        <Card><EmptyState title="Nada por aqui" description={tab === 'pending' ? 'Nenhuma questão aguardando revisão. Importe um PDF para começar.' : `Nenhuma questão com o filtro "${tabs.find((t) => t.key === tab)?.label}".`} /></Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id} hover className="!p-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 shrink-0">
                  <FileQuestion size={18} className="text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {q.number && <Badge tone="neutral">Questão {q.number}</Badge>}
                    <Badge tone={q.status === 'approved' ? 'green' : q.status === 'rejected' ? 'red' : 'amber'}>
                      {q.status === 'approved' ? 'Aprovada' : q.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                    </Badge>
                    {q.gabarito && <Badge tone="teal">Gabarito: {q.gabarito.toUpperCase()}</Badge>}
                    {q.catalog_items?.name && <Badge tone="blue">{q.catalog_items.name}</Badge>}
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-2">{q.statement}</p>
                  {q.rejectionReason && <p className="text-xs text-red-400 mt-1">Motivo: {q.rejectionReason}</p>}
                </div>
                <Link to={`/professor/questoes/${q.id}/revisar`} className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-300" title="Revisar">
                  <ChevronRight size={18} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}