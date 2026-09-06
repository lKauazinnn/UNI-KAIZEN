import { FormEvent, useEffect, useState } from 'react';
import { Users, Send, Clock, CheckCircle2 } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Turma } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, Button, Input, Spinner, EmptyState, Badge } from '../../components/ui';

type PendingTurma = { id: string; name: string };

const storageKey = (userId?: string) => `@kaizen:joinRequests:${userId ?? 'anon'}`;

function readPendingIds(userId?: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writePendingIds(userId: string | undefined, ids: string[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    /* storage indisponível — o professor ainda vê a solicitação */
  }
}

export default function AlunoTurmas() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [pending, setPending] = useState<PendingTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadPending = async (userId?: string) => {
    const ids = readPendingIds(userId);
    if (ids.length === 0) {
      setPending([]);
      return;
    }
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await api.get(`/classes/${id}`);
          if (data?.membershipStatus === 'pendente') return { id, name: data.name as string };
          return null;
        } catch {
          // 403/404 → a solicitação foi recusada ou a turma não existe mais
          return null;
        }
      })
    );
    const stillPending = results.filter((r): r is PendingTurma => r !== null);
    setPending(stillPending);
    writePendingIds(userId, stillPending.map((p) => p.id));
  };

  const load = () => {
    setLoading(true);
    api
      .get('/classes')
      .then(({ data }) => setTurmas(data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
    loadPending(user?.id);
  };

  useEffect(load, [user?.id]);

  const requestJoin = async (e: FormEvent) => {
    e.preventDefault();
    const turmaId = code.trim();
    if (!turmaId) return;
    setError('');
    setFeedback('');
    setSending(true);
    try {
      const { data } = await api.post(`/classes/${turmaId}/join-request`);
      const ids = readPendingIds(user?.id);
      if (!ids.includes(turmaId)) writePendingIds(user?.id, [...ids, turmaId]);
      setFeedback(data?.message ?? 'Solicitação enviada. Aguarde a aprovação do professor.');
      setCode('');
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Minhas turmas" subtitle="Veja as turmas em que você participa e solicite vínculo a novas turmas." />

      <Card className="mb-6">
        <h2 className="font-bold text-slate-100 mb-1">Solicitar vínculo a uma turma</h2>
        <p className="text-sm text-slate-400 mb-4">
          Informe o código da turma fornecido pelo seu professor. Ele receberá sua solicitação e precisará aprová-la.
        </p>
        <form onSubmit={requestJoin} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Input
              label="Código da turma"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Cole aqui o código enviado pelo professor"
              className="font-mono"
              required
            />
          </div>
          <Button type="submit" loading={sending} className="sm:mb-0">
            <Send size={16} /> Solicitar vínculo
          </Button>
        </form>

        {feedback && (
          <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
        )}
      </Card>

      {pending.length > 0 && (
        <Card className="mb-6 border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-400" />
            <h2 className="font-bold text-slate-100">Solicitações aguardando aprovação ({pending.length})</h2>
          </div>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{p.id}</p>
                </div>
                <span className="shrink-0"><Badge tone="amber">Pendente</Badge></span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner label="Carregando turmas..." />
      ) : turmas.length === 0 ? (
        <Card>
          <EmptyState
            title="Você ainda não participa de nenhuma turma"
            description="Peça o código da turma ao seu professor e envie uma solicitação de vínculo no campo acima."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map((turma) => (
            <Card key={turma.id} className={`h-full flex flex-col ${turma.archived ? 'opacity-70 border-dashed' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${turma.archived ? 'bg-slate-500/10 border-slate-500/20' : 'bg-primary-500/10 border-primary-500/20'}`}>
                  <Users size={22} className={turma.archived ? 'text-slate-400' : 'text-primary-400'} />
                </div>
                {turma.archived ? (
                  <Badge tone="amber">Arquivada</Badge>
                ) : (
                  <Badge tone="green">
                    <CheckCircle2 size={12} /> Ativo
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-slate-100 mb-1 flex-1">{turma.name}</h3>
              <p className="text-xs text-slate-400">
                Vinculado desde {new Date(turma.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
