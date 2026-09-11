import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown, Library, FolderTree, Tag } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { CatalogItem } from '../../types';
import { PageHeader, Card, Button, Input, Modal, Spinner, EmptyState, Badge, ConfirmDialog } from '../../components/ui';

type Level = 1 | 2 | 3 | 4;
type CreateTarget = { level: Level; parentId: string | null; parentName?: string };
type DeleteTarget = { id: string; name: string; level: number };

const levelLabel: Record<number, string> = { 1: 'Disciplina', 2: 'Conteúdo', 3: 'Tópico', 4: 'Subtópico' };

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
    api.get('/catalog/tree').then(({ data }) => setTree(data)).catch((err) => setError(apiError(err))).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const childrenOf = (item: CatalogItem): CatalogItem[] => {
    if (item.level === 1) return item.contents ?? item.topics ?? [];
    if (item.level === 2) return item.topics ?? item.subtopics ?? [];
    return item.subtopics ?? [];
  };

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
      await api.post('/catalog', { name: newName.trim(), level: createTarget.level, parentId: createTarget.parentId });
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
    try {
      await api.delete(`/catalog/${target.id}`);
      setFeedback(`"${target.name}" removido(a) do catálogo.`);
      setTimeout(() => setFeedback(''), 4000);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const countLevel = (level: number) => {
    const count = (items: CatalogItem[]): number => items.reduce((total, item) => total + (item.level === level ? 1 : 0) + count(childrenOf(item)), 0);
    return count(tree);
  };

  const nodeIcon = (level: number) => level === 1 ? <Library size={18} className="text-primary-400" /> : level === 2 ? <FolderTree size={16} className="text-sky-400" /> : <Tag size={13} className="text-slate-500" />;

  const renderNode = (item: CatalogItem, depth = 0): JSX.Element => {
    const children = childrenOf(item);
    const isOpen = expanded[item.id] ?? depth === 0;
    return (
      <div key={item.id} className={depth === 0 ? 'rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-card)] p-4' : 'rounded-xl border border-[color:var(--border)] px-4 py-3'}>
        <div className="flex items-start gap-3">
          <button onClick={() => toggle(item.id)} className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 shrink-0" title={isOpen ? 'Recolher' : 'Expandir'}>
            {nodeIcon(item.level)}
          </button>
          <button onClick={() => toggle(item.id)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
            {isOpen ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
            <span className={`${item.level === 1 ? 'font-bold' : 'font-semibold'} text-slate-100 truncate`}>{item.name}</span>
            <span className="text-xs text-slate-500 shrink-0">{children.length} filho(s)</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {item.level < 4 && <Button size="sm" variant="outline" onClick={() => openCreate({ level: (item.level + 1) as Level, parentId: item.id, parentName: item.name })}><Plus size={13} /> {levelLabel[item.level + 1]}</Button>}
            <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400" onClick={() => setDeleteTarget({ id: item.id, name: item.name, level: item.level })}><Trash2 size={14} /></Button>
          </div>
        </div>
        {isOpen && children.length > 0 && <div className={`${depth === 0 ? 'mt-4 pl-4' : 'mt-3 pl-5'} border-l border-[color:var(--border)] space-y-2`}>{children.map((child) => renderNode(child, depth + 1))}</div>}
        {isOpen && children.length === 0 && item.level < 4 && <p className="mt-3 pl-5 text-xs text-slate-500">Nenhum {levelLabel[item.level + 1].toLowerCase()} cadastrado.</p>}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Catálogo" subtitle="Organize disciplina, conteúdo, tópico e subtópico para classificar as questões." actions={<Button onClick={() => openCreate({ level: 1, parentId: null })}><Plus size={16} /> Nova disciplina</Button>} />
      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}
      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
      {loading ? <Spinner label="Carregando catálogo..." /> : tree.length === 0 ? (
        <Card><EmptyState title="Nenhuma disciplina cadastrada" description="Crie a primeira para classificar questões." action={<Button onClick={() => openCreate({ level: 1, parentId: null })}><Plus size={16} /> Nova disciplina</Button>} /></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge tone="teal">{countLevel(1)} disciplina(s)</Badge>
            <Badge tone="blue">{countLevel(2)} conteúdo(s)</Badge>
            <Badge tone="neutral">{countLevel(3)} tópico(s)</Badge>
            <Badge tone="neutral">{countLevel(4)} subtópico(s)</Badge>
          </div>
          <div className="space-y-3">{tree.map((item) => renderNode(item))}</div>
        </>
      )}
      <Modal open={!!createTarget} onClose={() => setCreateTarget(null)} title={createTarget ? `Novo ${levelLabel[createTarget.level].toLowerCase()}` : ''}>
        <form onSubmit={create} className="space-y-4">
          {formError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{formError}</div>}
          {createTarget?.parentName && <p className="text-sm text-slate-400">Dentro de <b className="text-slate-200">{createTarget.parentName}</b>.</p>}
          <Input label="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setCreateTarget(null)}>Cancelar</Button><Button type="submit" loading={saving}>Criar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} title={`Excluir ${deleteTarget ? levelLabel[deleteTarget.level].toLowerCase() : 'item'}`} message={deleteTarget ? `"${deleteTarget.name}" será removido(a) do catálogo. Itens filhos precisam ser removidos antes.` : ''} confirmLabel="Excluir" danger />
    </div>
  );
}
