import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle2, XCircle, MessageSquare, Send } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Textarea } from '../../components/ui';

type Solicitacao = {
  id: string;
  type: 'vinculo' | 'mensagem';
  status: 'pendente' | 'aprovada' | 'recusada' | 'respondida';
  message?: string | null;
  response?: string | null;
  createdAt: string;
  turmas?: { id: string; name: string } | null;
  users?: { id: string; name: string; email: string } | null;
};

const tabs = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'all', label: 'Todas' },
] as const;

const statusTone = { pendente: 'amber', aprovada: 'green', recusada: 'red', respondida: 'blue' } as const;
const statusLabel = { pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada', respondida: 'Respondida' } as const;

export default function ProfessorSolicitacoes() {
  const [tab, setTab] = useState<string>('pendente');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get('/solicitacoes', { params: { status: tab } })
      .then(({ data }) => setSolicitacoes(Array.isArray(data) ? data : []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const despachar = async (id: string, action: 'aprovar' | 'recusar' | 'responder') => {
    setError('');
    setBusyId(id);
    try {
      await api.post(`/solicitacoes/${id}/handle`, { action, response: respostas[id]?.trim() || undefined });
      setRespostas((prev) => ({ ...prev, [id]: '' }));
      setFeedback(
        action === 'aprovar'
          ? 'Aluno vinculado à turma.'
          : action === 'recusar'
          ? 'Solicitação recusada.'
          : 'Resposta enviada ao aluno.'
      );
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const pendentes = solicitacoes.filter((s) => s.status === 'pendente').length;

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Solicitações"
        subtitle="Pedidos de entrada em turma e mensagens enviadas pelos alunos."
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}

      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1.5 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              tab === t.key ? 'bg-white dark:bg-slate-900 text-primary-500 shadow' : 'text-slate-500'
            }`}
          >
            {t.label}
            {t.key === 'pendente' && pendentes > 0 && <span className="ml-1.5 text-xs">({pendentes})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Carregando solicitações..." />
      ) : solicitacoes.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma solicitação"
            description={
              tab === 'pendente'
                ? 'Nada aguardando resposta. Os pedidos dos alunos aparecem aqui.'
                : 'Nenhum aluno enviou solicitação ainda.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map((s) => (
            <Card key={s.id} className="!p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge tone={s.type === 'vinculo' ? 'blue' : 'neutral'}>
                  {s.type === 'vinculo' ? <><Users size={12} /> Vínculo de turma</> : <><MessageSquare size={12} /> Mensagem</>}
                </Badge>
                <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                {s.turmas?.name && <Badge tone="teal">{s.turmas.name}</Badge>}
              </div>

              <p className="text-sm font-bold text-slate-100">
                {s.users?.name ?? 'Aluno'}
                <span className="ml-2 text-xs font-normal text-slate-400">{s.users?.email}</span>
              </p>

              {s.message && <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{s.message}</p>}

              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Clock size={12} />
                {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>

              {s.response && (
                <div className="mt-3 rounded-lg bg-primary-500/10 border border-primary-500/20 px-3 py-2">
                  <p className="text-xs font-bold text-primary-300 uppercase tracking-wide mb-0.5">Sua resposta</p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{s.response}</p>
                </div>
              )}

              {s.status === 'pendente' && (
                <div className="mt-4 space-y-3 border-t border-[color:var(--border)] pt-4">
                  <Textarea
                    label="Resposta ao aluno (opcional)"
                    value={respostas[s.id] ?? ''}
                    onChange={(e) => setRespostas((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="Escreva um retorno para o aluno..."
                    className="min-h-[70px]"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    {s.type === 'vinculo' ? (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => despachar(s.id, 'recusar')}
                          loading={busyId === s.id}
                          className="!text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle size={16} /> Recusar
                        </Button>
                        <Button variant="success" onClick={() => despachar(s.id, 'aprovar')} loading={busyId === s.id}>
                          <CheckCircle2 size={16} /> Aprovar e vincular
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => despachar(s.id, 'responder')}
                        loading={busyId === s.id}
                        disabled={!respostas[s.id]?.trim()}
                      >
                        <Send size={16} /> Responder
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
