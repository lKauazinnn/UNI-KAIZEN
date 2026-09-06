import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown, Library, FolderTree, Tag } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { CatalogItem } from '../../types';
import { PageHeader, Card, Button, Input, Modal, Spinner, EmptyState, Badge, ConfirmDialog } from '../../components/ui';

type CreateTarget = { level: 1 | 2 | 3; parentId: string | null; parentName?: string };
type DeleteTarget = { id: string; name: string; level: number };

const levelLabel: Record<number, string> = { 1: 'Disciplina', 2: 'Tópico', 3: 'Subtópico' };

export default function Catalogo() {
  const [tree, setTree] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get('/catalog/tree')
      .then(({ data }) => setTree(data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openCreate = (target: CreateTarget) => {
    setFormError('');
    setNewName('');
    setCreateTarget(target);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTarget) return;
    setFormError('');
    setSaving(true);
    try {
      await api.post('/catalog', {
        name: newName.trim(),
        level: createTarget.level,
        parentId: createTarget.parentId,
      });
      if (createTarget.parentId) setExpanded((prev) => ({ ...prev, [createTarget.parentId as string]: true }));
      setCreateTarget(null);
      setNewName('');
      setFeedback(`${levelLabel[createTarget.level]} criado(a) com sucesso.`);
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setError('');
    try {
      await api.delete(`/catalog/${target.id}`);
      setFeedback(`"${target.name}" removido(a) do catálogo.`);
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const totalTopics = tree.reduce((acc, d) => acc + (d.topics?.length ?? 0), 0);
  const totalSubtopics = tree.reduce(
    (acc, d) => acc + (d.topics ?? []).reduce((a, t) => a + (t.subtopics?.length ?? 0), 0),
    0
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Catálogo"
        subtitle="Organize disciplinas, tópicos e subtópicos para classificar as questões do banco."
        actions={
          <Button onClick={() => openCreate({ level: 1, parentId: null })}>
            <Plus size={16} /> Nova disciplina
          </Button>
        }
      />

      {feedback && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
      )}

      {loading ? (
        <Spinner label="Carregando catálogo..." />
      ) : tree.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma disciplina cadastrada"
            description="Crie a primeira para conseguir classificar questões."
            action={
              <Button onClick={() => openCreate({ level: 1, parentId: null })}>
                <Plus size={16} /> Nova disciplina
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge tone="teal">{tree.length} disciplina(s)</Badge>
            <Badge tone="blue">{totalTopics} tópico(s)</Badge>
            <Badge tone="neutral">{totalSubtopics} subtópico(s)</Badge>
          </div>

          <div className="space-y-3">
            {tree.map((discipline) => {
              const topics = discipline.topics ?? [];
              const isOpen = expanded[discipline.id] ?? false;
              return (
                <Card key={discipline.id} className="!p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggle(discipline.id)}
                      className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 shrink-0 text-primary-400 hover:bg-primary-500/20 transition"
                      title={isOpen ? 'Recolher' : 'Expandir'}
                    >
                      <Library size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => toggle(discipline.id)} className="flex items-center gap-1.5 text-left w-full">
                        {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                        <span className="font-bold text-slate-100 truncate">{discipline.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">({topics.length} tópico(s))</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openCreate({ level: 2, parentId: discipline.id, parentName: discipline.name })}>
                        <Plus size={14} /> Tópico
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-500 hover:text-red-400"
                        onClick={() => setDeleteTarget({ id: discipline.id, name: discipline.name, level: 1 })}
                        title="Excluir disciplina"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pl-4 border-l border-[color:var(--border)] space-y-2">
                      {topics.length === 0 ? (
                        <p className="text-sm text-slate-400 py-2">
                          Nenhum tópico nesta disciplina. Adicione um tópico para detalhar a classificação.
                        </p>
                      ) : (
                        topics.map((topic) => {
                          const subtopics = topic.subtopics ?? [];
                          const topicOpen = expanded[topic.id] ?? false;
                          return (
                            <div key={topic.id} className="rounded-xl border border-[color:var(--border)] px-4 py-3">
                              <div className="flex items-start gap-3">
                                <FolderTree size={16} className="text-sky-400 shrink-0 mt-0.5" />
                                <button onClick={() => toggle(topic.id)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
                                  {topicOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                                  <span className="font-semibold text-slate-200 truncate">{topic.name}</span>
                                  <span className="text-xs text-slate-500 shrink-0">({subtopics.length})</span>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button size="sm" variant="ghost" onClick={() => openCreate({ level: 3, parentId: topic.id, parentName: topic.name })}>
                                    <Plus size={14} /> Subtópico
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-500 hover:text-red-400"
                                    onClick={() => setDeleteTarget({ id: topic.id, name: topic.name, level: 2 })}
                                    title="Excluir tópico"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </div>

                              {topicOpen && (
                                <div className="mt-3 pl-6 space-y-1.5">
                                  {subtopics.length === 0 ? (
                                    <p className="text-xs text-slate-500">Nenhum subtópico cadastrado.</p>
                                  ) : (
                                    subtopics.map((sub) => (
                                      <div key={sub.id} className="flex items-center gap-2 text-sm">
                                        <Tag size={13} className="text-slate-500 shrink-0" />
                                        <span className="flex-1 text-slate-300 truncate">{sub.name}</span>
                                        <button
                                          onClick={() => setDeleteTarget({ id: sub.id, name: sub.name, level: 3 })}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                          title="Excluir subtópico"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!createTarget}
        onClose={() => setCreateTarget(null)}
        title={createTarget ? `Nova ${levelLabel[createTarget.level].toLowerCase()}` : ''}
      >
        <form onSubmit={create} className="space-y-4">
          {formError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{formError}</div>}
          {createTarget?.parentName && (
            <p className="text-sm text-slate-400">
              Dentro de <b className="text-slate-200">{createTarget.parentName}</b>.
            </p>
          )}
          <Input
            label="Nome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={
              createTarget?.level === 1 ? 'Ex.: Matemática' : createTarget?.level === 2 ? 'Ex.: Álgebra' : 'Ex.: Equações do 2º grau'
            }
            required
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setCreateTarget(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Criar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={`Excluir ${deleteTarget ? levelLabel[deleteTarget.level].toLowerCase() : 'item'}`}
        message={
          deleteTarget
            ? `"${deleteTarget.name}" será removido(a) do catálogo.${
                deleteTarget.level < 3 ? ' Itens filhos precisam ser removidos antes.' : ''
              } Questões já classificadas com este item podem perder a classificação.`
            : ''
        }
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
