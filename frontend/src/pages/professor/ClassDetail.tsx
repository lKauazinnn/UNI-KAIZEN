import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, UserPlus, ClipboardList, FileText, Check, X, Megaphone } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { TurmaDetail, Notice } from '../../types';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Modal, Input, Textarea, ConfirmDialog } from '../../components/ui';

export default function ClassDetail() {
  const { id } = useParams();
  const [turma, setTurma] = useState<TurmaDetail | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvResult, setCsvResult] = useState<any[] | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/classes/${id}`), api.get(`/notices/turma/${id}`)])
      .then(([t, n]) => { setTurma(t.data); setNotices(n.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const linkStudent = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post(`/classes/${id}/students/link`, { email: linkEmail });
      setFeedback(`Aluno ${data.student?.name ?? linkEmail} vinculado com sucesso.`);
      setLinkOpen(false);
      setLinkEmail('');
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post(`/classes/${id}/students/import-csv`, { students: csv });
      setCsvResult(data.results);
      setCsv('');
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (memberId: string, approve: boolean) => {
    await api.post(`/classes/${id}/join-requests/${memberId}`, { approve });
    load();
  };

  const removeStudent = async () => {
    if (!removeId) return;
    await api.delete(`/classes/${id}/students/${removeId}`);
    setRemoveId(null);
    load();
  };

  const sendNotice = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/notices/turma/${id}`, { message: noticeMsg });
      setNoticeMsg('');
      setNoticeOpen(false);
      setFeedback('Aviso enviado para a turma.');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const pending = (turma?.members ?? []).filter((m) => m.status === 'pendente');
  const active = (turma?.members ?? []).filter((m) => m.status === 'ativo');

  if (loading) return <Spinner label="Carregando turma..." />;
  if (!turma) return <EmptyState title="Turma não encontrada" />;

  return (
    <div className="animate-fade-in">
      <Link to="/professor/turmas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Turmas
      </Link>

      <PageHeader
        title={turma.name}
        subtitle={`${active.length} aluno(s) ativo(s)`}
        actions={
          <>
            <Button variant="outline" onClick={() => setCsvOpen(true)}><FileText size={16} /> Importar CSV</Button>
            <Button variant="outline" onClick={() => setNoticeOpen(true)}><Megaphone size={16} /> Avisar turma</Button>
            <Button onClick={() => setLinkOpen(true)}><UserPlus size={16} /> Vincular aluno</Button>
          </>
        }
      />

      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {pending.length > 0 && (
            <Card className="border-amber-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-soft" />
                <h2 className="font-bold text-slate-100">Solicitações de vínculo ({pending.length})</h2>
              </div>
              <div className="space-y-2">
                {pending.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{m.users?.name ?? 'Aluno'}</p>
                      <p className="text-xs text-slate-400 truncate">{m.users?.email}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => decide(m.id, false)}><X size={14} /> Recusar</Button>
                      <Button size="sm" variant="success" onClick={() => decide(m.id, true)}><Check size={14} /> Aprovar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-bold text-slate-100 mb-4">Alunos ({active.length})</h2>
            {active.length === 0 ? (
              <EmptyState title="Sem alunos na turma" description="Vincule por e-mail, importe um CSV, ou os alunos podem solicitar vínculo." />
            ) : (
              <div className="space-y-2">
                {active.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{m.users?.name ?? 'Aluno'}</p>
                      <p className="text-xs text-slate-400 truncate">{m.users?.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400" onClick={() => setRemoveId(m.userId)}>
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-bold text-slate-100 mb-4">Simulados da turma</h2>
            {!turma.exams || turma.exams.length === 0 ? (
              <EmptyState title="Nenhum simulado" description="Crie um simulado e escolha esta turma." action={<Link to="/professor/simulados/novo" className="text-sm font-semibold text-primary-300">Novo simulado</Link>} />
            ) : (
              <div className="space-y-2">
                {turma.exams.map((exam) => (
                  <Link key={exam.id} to={`/professor/simulados/${exam.id}`} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition">
                    <ClipboardList size={16} className="text-primary-400" />
                    <span className="flex-1 font-semibold text-slate-200">{exam.title}</span>
                    <Badge tone={exam.status === 'published' ? 'green' : exam.status === 'draft' ? 'amber' : 'neutral'}>
                      {exam.status === 'published' ? 'Publicado' : exam.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="lg:col-span-1 self-start">
          <h2 className="font-bold text-slate-100 mb-4">Avisos</h2>
          {notices.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum aviso enviado ainda.</p>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="rounded-xl border border-[color:var(--border)] p-3">
                  <p className="text-sm text-slate-200">{n.message}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {n.users?.name} · {new Date(n.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Vincular aluno */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Vincular aluno">
        <p className="text-sm text-slate-400 mb-4">
          Se o e-mail não existir, o aluno será criado com uma senha temporária exibida a seguir.
        </p>
        <form onSubmit={linkStudent} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <Input label="E-mail do aluno" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="aluno@escola.com" required />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Vincular</Button>
          </div>
        </form>
      </Modal>

      {/* Importar CSV */}
      <Modal open={csvOpen} onClose={() => { setCsvOpen(false); setCsvResult(null); }} title="Importar alunos (CSV)">
        {!csvResult ? (
          <form onSubmit={importCsv} className="space-y-4">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
            <Textarea
              label="Lista de alunos"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"ana@escola.com;Ana Souza\nbruno@escola.com;Bruno Lima\ncaio@escola.com;Caio Dias"}
              className="min-h-[140px] font-mono"
              required
            />
            <p className="text-xs text-slate-500">Uma linha por aluno: <b>email;Nome</b>. Alunos não cadastrados são criados com senha temporária.</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setCsvOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Importar</Button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-sm text-slate-400 mb-4">{csvResult.length} linha(s) processadas.</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {csvResult.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded-lg border border-[color:var(--border)] px-3 py-2">
                  <span className="text-slate-300 truncate">{r.name ? `${r.name} (${r.email})` : r.email}</span>
                  <Badge tone={r.status === 'criado' || r.status === 'vinculado' ? 'green' : 'amber'}>{r.status}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { setCsvOpen(false); setCsvResult(null); }}>Concluir</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Aviso */}
      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title="Enviar aviso para a turma">
        <form onSubmit={sendNotice} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <Textarea label="Mensagem" value={noticeMsg} onChange={(e) => setNoticeMsg(e.target.value)} placeholder="Ex.: O simulado será publicado na sexta-feira." maxLength={500} required />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setNoticeOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Enviar aviso</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={removeStudent}
        title="Remover aluno"
        message="O aluno deixará de ter acesso aos simulados desta turma."
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}