import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Save, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Question, CatalogItem } from '../../types';
import { PageHeader, Button, Badge, Spinner, Textarea, Input, Select, ConfirmDialog } from '../../components/ui';
import { QuestionView } from '../../components/QuestionView';

export default function QuestionReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState<Question | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [statement, setStatement] = useState('');
  const [alternatives, setAlternatives] = useState<{ letter: string; text: string }[]>([]);
  const [gabarito, setGabarito] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/questions/${id}`), api.get('/catalog/tree')])
      .then(([q, c]) => {
        setQuestion(q.data);
        setCatalog(c.data);
        setStatement(q.data.statement);
        setAlternatives(q.data.alternatives ?? []);
        setGabarito(q.data.gabarito?.toUpperCase() ?? '');
        setCatalogItemId(q.data.catalogItemId ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    setStatement(question!.statement);
    setAlternatives(question!.alternatives ?? []);
    setGabarito(question!.gabarito?.toUpperCase() ?? '');
    setCatalogItemId(question!.catalogItemId ?? '');
    setEditing(true);
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const payload: any = { statement, alternatives, gabarito: gabarito || null };
      if (catalogItemId) {
        await api.post(`/questions/${id}/classificate`, { catalogItemId });
      } else {
        payload.catalogItemId = null;
      }
      const { data } = await api.patch(`/questions/${id}`, payload);
      setQuestion((prev) => ({ ...(data as Question), catalog_items: prev?.catalog_items }));
      setFeedback('Questão salva.');
      setTimeout(() => setFeedback(''), 3000);
      setEditing(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: 'approved' | 'rejected') => {
    setSaving(true);
    try {
      if (status === 'approved') {
        const { data } = await api.post(`/questions/${id}/approve`);
        setQuestion((prev) => ({ ...(prev as Question), ...(data as Question), catalogItemId: prev?.catalogItemId, catalog_items: prev?.catalog_items }));
      } else {
        const { data } = await api.patch(`/questions/${id}`, { statement: question!.statement, alternatives: question!.alternatives });
        setQuestion((prev) => ({ ...(prev as Question), ...(data as Question), status: 'pending', catalogItemId: prev?.catalogItemId, catalog_items: prev?.catalog_items }));
      }
      setFeedback(status === 'approved' ? 'Questão aprovada para o banco.' : 'Questão marcada como pendente.');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api.delete(`/questions/${id}`);
    navigate('/professor/questoes');
  };

  const setAlt = (index: number, text: string) => {
    const letters = 'ABCDE';
    const copy = [...alternatives];
    copy[index] = { letter: letters[index] ?? `${index + 1}`, text };
    setAlternatives(copy);
  };

  const addAlt = () => {
    if (alternatives.length >= 5) return;
    setAlternatives([...alternatives, { letter: 'ABCDE'[alternatives.length], text: '' }]);
  };

  if (loading) return <Spinner label="Carregando questão..." />;
  if (!question) return <Spinner label="Questão não encontrada" />;

  return (
    <div className="animate-fade-in max-w-3xl">
      <Link to="/professor/questoes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Banco de questões
      </Link>

      <PageHeader
        title={`Questão ${question.number ?? ''}`.trim() || 'Questão'}
        actions={
          !editing ? (
            <>
              <Button variant="outline" onClick={startEdit}><Pencil size={16} /> Editar</Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)} className="!bg-transparent !text-red-400 hover:bg-red-500/10"><Trash2 size={16} /> Excluir</Button>
              {question.status !== 'approved' && (
                <Button variant="success" onClick={() => setStatus('approved')} loading={saving}><CheckCircle2 size={16} /> Aprovar</Button>
              )}
            </>
          ) : (
            <Button onClick={save} loading={saving}><Save size={16} /> Salvar alterações</Button>
          )
        }
      />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
      {feedback && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{feedback}</div>}

      {question.status === 'pending' && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
          Esta questão foi preparada pela IA. Confira o enunciado, as alternativas e o gabarito antes de aprovar.
        </div>
      )}

      {editing ? (
        <div className="rounded-2xl bg-[color:var(--bg-card)] border border-[color:var(--border)] p-6 space-y-4">
          <Textarea label="Enunciado" value={statement} onChange={(e) => setStatement(e.target.value)} className="min-h-[100px]" required />

          <div>
            <span className="block text-sm font-semibold text-slate-300 mb-1.5">Alternativas</span>
            <div className="space-y-2">
              {alternatives.map((alt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {alt.letter}
                  </span>
                  <Input value={alt.text} onChange={(e) => setAlt(i, e.target.value)} className="flex-1" />
                  {alternatives.length > 2 && (
                    <button className="text-slate-500 hover:text-red-400" onClick={() => setAlternatives(alternatives.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {alternatives.length < 5 && (
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addAlt}>+ Adicionar alternativa</Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Gabarito" value={gabarito} onChange={(e) => setGabarito(e.target.value)}>
              <option value="">Sem gabarito</option>
              {alternatives.filter((a) => a.text.trim()).map((alt) => (
                <option key={alt.letter} value={alt.letter}>Letra {alt.letter}</option>
              ))}
            </Select>
            <Select label="Classificação (tópico/subtópico)" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
              <option value="">Não classificar</option>
              {catalog.map((dis) => (
                <optgroup key={dis.id} label={dis.name}>
                  {(dis.topics ?? []).map((topic) => (
                    <optgroup key={topic.id} label={`  ${topic.name}`}>
                      {(topic.subtopics ?? []).map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} className="mr-2">Cancelar</Button>
            <Button onClick={save} loading={saving}>Salvar</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[color:var(--bg-card)] border border-[color:var(--border)] p-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {question.status && (
              <Badge tone={question.status === 'approved' ? 'green' : question.status === 'rejected' ? 'red' : 'amber'}>
                {question.status === 'approved' ? 'Aprovada' : question.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
              </Badge>
            )}
            {question.gabarito && <Badge tone="teal">Gabarito: {question.gabarito.toUpperCase()}</Badge>}
            {question.classificationSource === 'ai' && <Badge tone="neutral">Classificação sugerida por IA — conferir</Badge>}
            {question.catalogItemId && question.catalog_items?.name && <Badge tone="blue">{question.catalog_items.name}</Badge>}
          </div>
          <QuestionView question={question} />
          <p className="mt-4 text-xs text-slate-500">Esta é a prévia exata do que o aluno verá ao responder o simulado.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Excluir questão"
        message="Esta ação não pode ser desfeita. A questão será removida permanentemente."
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}