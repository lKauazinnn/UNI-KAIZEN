import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileQuestion, ChevronRight, CheckCheck, Search, X, AlertTriangle, FileUp, FolderTree } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Question } from '../../types';
import { PageHeader, Card, Badge, Spinner, EmptyState, Button, Input, ConfirmDialog } from '../../components/ui';

const tabs = [
  { key: 'pending', label: 'Revisar' },
  { key: 'approved', label: 'Banco aprovado' },
  { key: 'rejected', label: 'Rejeitadas' },
  { key: 'all', label: 'Todas' },
] as const;

type BatchRejection = { id: string; number?: number | null; reason?: string | null };

export default function Questions() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get('status') ?? 'pending');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchMsg, setBatchMsg] = useState('');
  const [batchError, setBatchError] = useState('');
  const [batchRejected, setBatchRejected] = useState<BatchRejection[]>([]);
  // B18: busca por enunciado para reencontrar as questões depois.
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [confirmBatch, setConfirmBatch] = useState(false);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { status: tab === 'all' ? 'all' : tab };
    if (query.trim()) params.q = query.trim();
    api
      .get('/questions', { params })
      // A API devolve um array puro quando não há paginação.
      .then(({ data }) => {
        const list: Question[] = Array.isArray(data) ? data : data?.items ?? [];
        list.sort((a, b) => {
          if (a.number != null && b.number != null) return a.number - b.number;
          if (a.number != null) return -1;
          if (b.number != null) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setQuestions(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTab(searchParams.get('status') ?? 'pending');
  }, [searchParams]);

  // debounce simples do campo de busca
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(load, [tab, query]);

  const countOf: Record<string, number> = {
    pending: (questions).filter((q) => q.status === 'pending').length,
  };

  const approveValidBatch = async () => {
    setConfirmBatch(false);
    setBatchMsg('');
    setBatchError('');
    setBatchRejected([]);
    try {
      const { data } = await api.post('/questions/approve-valid');
      const rejected: BatchRejection[] = data.rejected ?? [];
      setBatchMsg(`Lote processado: ${data.approved} aprovada(s), ${rejected.length} rejeitada(s) por invalidez.`);
      // B17: os motivos ficam na tela até o professor fechar o painel.
      setBatchRejected(rejected);
      load();
    } catch (err) {
      setBatchError(apiError(err));
    }
  };

  const dismissBatch = () => {
    setBatchMsg('');
    setBatchError('');
    setBatchRejected([]);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Banco de questões"
        subtitle="A IA prepara. Você confere e aprova."
        actions={
          // Importar e Catálogo são AÇÕES de Questões — o menu lateral fica
          // com as cinco áreas do backlog.
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/professor/importar">
              <Button variant="ghost"><FileUp size={16} /> Importar PDF</Button>
            </Link>
            <Link to="/professor/catalogo">
              <Button variant="ghost"><FolderTree size={16} /> Catálogo</Button>
            </Link>
            {tab === 'pending' && (
       <Button variant="success" onClick={() => setConfirmBatch(true)}>
                 <CheckCheck size={16} /> Aprovar todas as questões
              </Button>
            )}
          </div>
        }
      />

      {batchError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{batchError}</div>
      )}

      {batchMsg && (
        <div className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-card)] overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[color:var(--border)]">
            <p className="text-sm font-bold text-slate-100">{batchMsg}</p>
            <button onClick={dismissBatch} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0" title="Fechar">
              <X size={16} />
            </button>
          </div>

          {batchRejected.length > 0 ? (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3 text-amber-400">
                <AlertTriangle size={16} className="shrink-0" />
                <p className="text-sm font-semibold">
                  Estas questões ficaram fora do banco e precisam de ajuste manual:
                </p>
              </div>
              <ul className="space-y-2">
                {batchRejected.map((r) => (
                  <li key={r.id} className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge tone="red">{r.number ? `Questão ${r.number}` : 'Questão sem número'}</Badge>
                      <Link to={`/professor/questoes/${r.id}/revisar`} className="text-xs font-semibold text-primary-300 hover:text-primary-200">
                        Corrigir →
                      </Link>
                    </div>
                    <p className="text-sm text-slate-200">{r.reason || 'Questão inválida'}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-emerald-400">Nenhuma questão foi rejeitada neste lote.</p>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(searchInput);
            }}
            placeholder="Buscar pelo enunciado da questão..."
            className="!pl-10 !pr-10"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-200"
              title="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

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
        <Card>
          <EmptyState
            title="Nada por aqui"
            description={
              query.trim()
                ? `Nenhuma questão encontrada para "${query.trim()}".`
                : tab === 'pending'
                ? 'Nenhuma questão aguardando revisão. Importe um PDF para começar.'
                : `Nenhuma questão com o filtro "${tabs.find((t) => t.key === tab)?.label}".`
            }
          />
        </Card>
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
                      {q.status === 'approved' ? 'Aprovada' : q.status === 'rejected' ? 'Rejeitada' : 'Pré-aprovada'}
                    </Badge>
                    {q.gabarito && <Badge tone="teal">Gabarito: {q.gabarito.toUpperCase()}</Badge>}
                    {q.catalog_items?.name && <Badge tone="blue">{q.catalog_items.name}</Badge>}
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-2">{q.statement}</p>
                  {q.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2">
                      Motivo da rejeição: {q.rejectionReason}
                    </p>
                  )}
                </div>
                <Link to={`/professor/questoes/${q.id}/revisar`} className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-300" title="Revisar">
                  <ChevronRight size={18} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmBatch}
        onClose={() => setConfirmBatch(false)}
        onConfirm={approveValidBatch}
        title="Aprovar todas as questões"
        message="As questões pendentes válidas entrarão no banco aprovado. Questões com dados incompletos ficarão marcadas para correção."
        confirmLabel="Aprovar todas"
      />
    </div>
  );
}
