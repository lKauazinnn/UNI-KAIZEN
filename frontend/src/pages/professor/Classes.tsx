import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Pencil, Archive, ChevronRight } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Turma } from '../../types';
import { PageHeader, Card, Button, Input, Modal, Spinner, EmptyState, Badge, ConfirmDialog } from '../../components/ui';

const tabs = [
  { key: 'ativas', label: 'Ativas' },
  { key: 'arquivadas', label: 'Arquivadas' },
] as const;

export default function Classes() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('ativas');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [renameTarget, setRenameTarget] = useState<Turma | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<Turma | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/classes').then(({ data }) => setTurmas(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/classes', { name });
      setTurmas((prev) => [data, ...prev]);
      setOpen(false);
      setName('');
      setTab('ativas');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openRename = (turma: Turma) => {
    setRenameError('');
    setRenameValue(turma.name);
    setRenameTarget(turma);
  };

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    setRenameError('');
    setSaving(true);
    try {
      await api.patch(`/classes/${renameTarget.id}`, { name: renameValue });
      setRenameTarget(null);
      setFeedback(`Turma renomeada para "${renameValue}".`);
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setRenameError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      await api.post(`/classes/${target.id}/archive`);
      setFeedback(`Turma "${target.name}" arquivada. Ela agora aparece na aba Arquivadas.`);
      setTimeout(() => setFeedback(''), 5000);
      load();
    } catch (err) {
      setFeedback('');
      setError(apiError(err));
    }
  };

  const counts = useMemo(
    () => ({
      ativas: turmas.filter((t) => !t.archived).length,
      arquivadas: turmas.filter((t) => t.archived).length,
    }),
    [turmas]
  );

  const visible = turmas.filter((t) => (tab === 'arquivadas' ? !!t.archived : !t.archived));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Turmas"
        subtitle="Agrupe seus alunos e publique simulados por turma."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova turma
          </Button>
        }
      />

      {feedback && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>
      )}
      {error && !open && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
      )}

      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1.5 mb-6 overflow-x-auto w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              tab === t.key ? 'bg-white dark:bg-slate-900 text-primary-500 shadow' : 'text-slate-500'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Carregando turmas..." />
      ) : visible.length === 0 ? (
        <Card>
          {tab === 'arquivadas' ? (
            <EmptyState
              title="Nenhuma turma arquivada"
              description="Turmas arquivadas saem da lista ativa mas continuam acessíveis por aqui."
            />
          ) : (
            <EmptyState
              title="Nenhuma turma criada"
              description="Crie a primeira turma para vincular seus alunos e distribuir simulados."
              action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nova turma</Button>}
            />
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((turma) => (
            <Card key={turma.id} className={`h-full flex flex-col ${turma.archived ? 'opacity-70 border-dashed' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${turma.archived ? 'bg-slate-500/10 border-slate-500/20' : 'bg-primary-500/10 border-primary-500/20'}`}>
                  <Users size={22} className={turma.archived ? 'text-slate-400' : 'text-primary-400'} />
                </div>
                {turma.archived && <Badge tone="amber">Arquivada</Badge>}
              </div>

              <Link to={`/professor/turmas/${turma.id}`} className="block group flex-1">
                <h3 className="font-bold text-slate-100 mb-1 group-hover:text-primary-300 transition inline-flex items-center gap-1">
                  {turma.name}
                  <ChevronRight size={16} className="text-slate-500 group-hover:text-primary-300" />
                </h3>
                <p className="text-xs text-slate-400">
                  Criada em {new Date(turma.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </Link>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[color:var(--border)]">
                <Button size="sm" variant="outline" onClick={() => openRename(turma)}>
                  <Pencil size={14} /> Renomear
                </Button>
                {!turma.archived && (
                  <Button size="sm" variant="ghost" className="text-slate-500 hover:text-amber-400" onClick={() => setArchiveTarget(turma)}>
                    <Archive size={14} /> Arquivar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova turma">
        <form onSubmit={create} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <Input label="Nome da turma" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: 3º Ano A — Ensino Médio" required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Criar turma</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Renomear turma">
        <form onSubmit={rename} className="space-y-4">
          {renameError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{renameError}</div>}
          <Input label="Novo nome" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Ex.: 3º Ano A — Ensino Médio" required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar nome</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={archive}
        title="Arquivar turma"
        message={`A turma "${archiveTarget?.name ?? ''}" sairá da lista de turmas ativas e passará a aparecer somente na aba Arquivadas. Os alunos e simulados existentes são preservados.`}
        confirmLabel="Arquivar"
        danger
      />
    </div>
  );
}
