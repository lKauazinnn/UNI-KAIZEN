import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, UserPlus, ClipboardList, FileText, Megaphone, Pencil, Archive, Search } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { TurmaDetail, Notice } from '../../types';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Modal, Input, Textarea, ConfirmDialog } from '../../components/ui';

export default function ClassDetail() {
  const { id } = useParams();
  const [turma, setTurma] = useState<TurmaDetail | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const [linkOpen, setLinkOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvResult, setCsvResult] = useState<any[] | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/classes/${id}`), api.get(`/notices/turma/${id}`)])
      .then(([t, n]) => { setTurma(t.data); setNotices(n.data); })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  // Ao abrir o modal a busca vai vazia de propósito: o backend devolve os
  // alunos disponíveis da organização, então o professor já vê quem pode
  // vincular sem precisar adivinhar o nome.
  useEffect(() => {
    if (!linkOpen || !id) {
      setStudentResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.get(`/classes/${id}/students/search`, { params: { q: studentSearch.trim() } })
        .then(({ data }) => setStudentResults(Array.isArray(data) ? data : []))
        .catch((err) => setError(apiError(err)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [id, linkOpen, studentSearch]);

  const openRename = () => {
    setError('');
    setRenameValue(turma?.name ?? '');
    setRenameOpen(true);
  };

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.patch(`/classes/${id}`, { name: renameValue });
      setRenameOpen(false);
      setFeedback('Turma renomeada com sucesso.');
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setArchiveOpen(false);
    setError('');
    try {
      await api.post(`/classes/${id}/archive`);
      setFeedback('Turma arquivada — ela sai da lista de turmas ativas.');
      setTimeout(() => setFeedback(''), 5000);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const linkStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post(`/classes/${id}/students/link`, { userId: selectedStudent.id });
      setFeedback(`Aluno ${data.student?.name ?? selectedStudent.name} vinculado com sucesso.`);
      setLinkOpen(false);
      setStudentSearch('');
      setStudentResults([]);
      setSelectedStudent(null);
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

  const removeStudent = async () => {
    if (!removeId) return;
    try {
      await api.delete(`/classes/${id}/students/${removeId}`);
      setRemoveId(null);
      load();
    } catch (err) {
      setError(apiError(err));
    }
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

  const active = (turma?.members ?? []).filter((m) => m.status === 'ativo');

  if (loading) return <Spinner label="Carregando turma..." />;
  if (!turma) return <EmptyState title="Turma não encontrada" />;

  return (
    <div className="animate-fade-in">
      <Link to="/professor/turmas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Turmas
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            {turma.name}
            {turma.archived && <Badge tone="amber">Arquivada</Badge>}
          </span>
        }
        subtitle={`${active.length} aluno(s) ativo(s)`}
        actions={
          <>
            <Button variant="outline" onClick={openRename}><Pencil size={16} /> Renomear</Button>
            {!turma.archived && (
              <Button variant="outline" onClick={() => setArchiveOpen(true)}><Archive size={16} /> Arquivar</Button>
            )}
            <Button variant="outline" onClick={() => setCsvOpen(true)}><FileText size={16} /> Importar CSV</Button>
            <Button variant="outline" onClick={() => setNoticeOpen(true)}><Megaphone size={16} /> Avisar turma</Button>
            <Button onClick={() => setLinkOpen(true)}><UserPlus size={16} /> Vincular aluno</Button>
          </>
        }
      />

      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}
      {error && !linkOpen && !csvOpen && !noticeOpen && !renameOpen && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-bold text-slate-100 mb-4">Alunos ({active.length})</h2>
            {active.length === 0 ? (
              <EmptyState title="Sem alunos na turma" description="Use Vincular aluno para pesquisar e confirmar um aluno cadastrado." />
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
                    {n.users?.name} · {new Date(n.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Renomear turma */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Renomear turma">
        <form onSubmit={rename} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <Input label="Novo nome" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Ex.: 3º Ano A — Ensino Médio" required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar nome</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={archive}
        title="Arquivar turma"
        message="A turma sairá da lista de turmas ativas e passará a aparecer somente na aba Arquivadas. Os alunos e simulados existentes são preservados."
        confirmLabel="Arquivar"
        danger
      />

      {/* Vincular aluno */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Vincular aluno">
        <p className="text-sm text-slate-400 mb-4">
          Estes são os alunos da sua organização que ainda não estão nesta turma. Selecione um e confirme o
          vínculo — use a busca para filtrar por nome ou e-mail.
        </p>
        <form onSubmit={linkStudent} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <div className="relative">
            <Input label="Pesquisar aluno" value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); }} placeholder="Nome ou e-mail" autoFocus />
            <Search size={16} className="absolute right-3 bottom-3 text-slate-400" />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2">
            {studentResults.map((student) => (
              <button
                type="button"
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedStudent?.id === student.id ? 'border-primary-500 bg-primary-500/10' : 'border-[color:var(--border)] hover:border-slate-500'}`}
              >
                <p className="font-semibold text-slate-200">{student.name}</p>
                <p className="text-xs text-slate-400">{student.email}</p>
              </button>
            ))}
            {studentResults.length === 0 && (
              <p className="text-sm text-slate-500 py-2">
                {studentSearch.trim()
                  ? 'Nenhum aluno disponível para este filtro.'
                  : 'Nenhum aluno cadastrado nesta organização está fora da turma. Peça ao aluno para se cadastrar usando o mesmo identificador de organização.'}
              </p>
            )}
          </div>
          {selectedStudent && <p className="text-sm text-primary-300">Selecionado: {selectedStudent.name} ({selectedStudent.email})</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={!selectedStudent}>Confirmar vínculo</Button>
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
            <p className="text-sm text-slate-400 mb-4">
              {csvResult.length} linha(s) processadas. Repasse a senha temporária aos alunos criados — eles devem trocá-la no primeiro acesso.
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {csvResult.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm rounded-lg border border-[color:var(--border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-slate-300 truncate">{r.name ? `${r.name} (${r.email})` : r.email}</p>
                    {r.tempPassword ? (
                      <p className="text-[11px] text-primary-300">Senha temporária: <b>{r.tempPassword}</b></p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Já tinha conta — Senha inalterada</p>
                    )}
                  </div>
                  <span className="shrink-0"><Badge tone={r.status === 'criado' || r.status === 'vinculado' ? 'green' : 'amber'}>{r.status}</Badge></span>
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
