import { FormEvent, useEffect, useState } from 'react';
import { MessageSquarePlus, Users, Send, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Select, Textarea } from '../../components/ui';

type Solicitacao = {
  id: string;
  type: 'vinculo' | 'mensagem';
  status: 'pendente' | 'aprovada' | 'recusada' | 'respondida';
  message?: string | null;
  response?: string | null;
  createdAt: string;
  turmas?: { id: string; name: string } | null;
};

type TurmaDisponivel = { id: string; name: string };

const statusTone = {
  pendente: 'amber',
  aprovada: 'green',
  recusada: 'red',
  respondida: 'blue',
} as const;

const statusLabel = {
  pendente: 'Aguardando o professor',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  respondida: 'Respondida',
} as const;

function StatusIcon({ status }: { status: Solicitacao['status'] }) {
  if (status === 'aprovada') return <CheckCircle2 size={18} className="text-emerald-400" />;
  if (status === 'recusada') return <XCircle size={18} className="text-red-400" />;
  return <Clock size={18} className="text-amber-400" />;
}

export default function AlunoSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [turmas, setTurmas] = useState<TurmaDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState<'vinculo' | 'mensagem'>('vinculo');
  const [turmaId, setTurmaId] = useState('');
  const [mensagem, setMensagem] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/solicitacoes'), api.get('/solicitacoes/turmas-disponiveis')])
      .then(([s, t]) => {
        setSolicitacoes(Array.isArray(s.data) ? s.data : []);
        setTurmas(Array.isArray(t.data) ? t.data : []);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/solicitacoes', {
        type: tipo,
        turmaId: tipo === 'vinculo' ? turmaId : null,
        message: mensagem.trim() || undefined,
      });
      setMensagem('');
      setTurmaId('');
      setFeedback('Solicitação enviada. O professor será notificado na área de Solicitações.');
      setTimeout(() => setFeedback(''), 5000);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelar = async (id: string) => {
    setError('');
    try {
      await api.delete(`/solicitacoes/${id}`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Solicitações gerais"
        subtitle="Peça entrada em uma turma ou fale diretamente com o professor."
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}

      <Card className="mb-8">
        <h2 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-primary-400" /> Nova solicitação
        </h2>
        <form onSubmit={enviar} className="space-y-4">
          <Select label="O que você precisa?" value={tipo} onChange={(e) => setTipo(e.target.value as 'vinculo' | 'mensagem')}>
            <option value="vinculo">Entrar em uma turma</option>
            <option value="mensagem">Enviar mensagem ao professor</option>
          </Select>

          {tipo === 'vinculo' && (
            <Select
              label="Turma"
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              hint={
                turmas.length === 0
                  ? 'Nenhuma turma disponível — você já participa de todas as turmas ativas da sua instituição.'
                  : 'Só aparecem as turmas da sua instituição em que você ainda não está.'
              }
              required
            >
              <option value="">Selecione a turma...</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          )}

          <Textarea
            label={tipo === 'vinculo' ? 'Observação (opcional)' : 'Mensagem'}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={
              tipo === 'vinculo'
                ? 'Ex.: sou da turma da manhã, entrei depois do início do semestre.'
                : 'Escreva sua dúvida ou pedido para o professor.'
            }
            className="min-h-[90px]"
            required={tipo === 'mensagem'}
          />

          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={tipo === 'vinculo' && !turmaId}>
              <Send size={16} /> Enviar solicitação
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="font-bold text-slate-100 mb-4">Minhas solicitações</h2>

      {loading ? (
        <Spinner label="Carregando solicitações..." />
      ) : solicitacoes.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma solicitação ainda"
            description="Use o formulário acima para pedir entrada em uma turma ou falar com o professor."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map((s) => (
            <Card key={s.id} className="!p-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-slate-500/10 border border-[color:var(--border)] shrink-0">
                  <StatusIcon status={s.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge tone={s.type === 'vinculo' ? 'blue' : 'neutral'}>
                      {s.type === 'vinculo' ? <><Users size={12} /> Vínculo de turma</> : 'Mensagem'}
                    </Badge>
                    <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                    {s.turmas?.name && <Badge tone="teal">{s.turmas.name}</Badge>}
                  </div>
                  {s.message && <p className="text-sm text-slate-300 whitespace-pre-wrap">{s.message}</p>}
                  {s.response && (
                    <div className="mt-2 rounded-lg bg-primary-500/10 border border-primary-500/20 px-3 py-2">
                      <p className="text-xs font-bold text-primary-300 uppercase tracking-wide mb-0.5">Resposta do professor</p>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{s.response}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1.5">
                    Enviada em {new Date(s.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {s.status === 'pendente' && (
                  <button
                    onClick={() => cancelar(s.id)}
                    className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                    title="Cancelar solicitação"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
