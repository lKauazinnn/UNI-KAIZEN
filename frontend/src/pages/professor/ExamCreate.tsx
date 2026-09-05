import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ListOrdered } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Question, Turma } from '../../types';
import { PageHeader, Button, Card, Badge, Spinner, EmptyState, Input, Select, EmptyState as Empty } from '../../components/ui';

export default function ExamCreate() {
  const navigate = useNavigate();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [turmaId, setTurmaId] = useState('');
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Question[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/questions', { params: { status: 'approved' } })])
      .then(([t, q]) => {
        setTurmas(t.data);
        setQuestions(q.data);
        if (t.data?.[0]) setTurmaId(t.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return questions;
    return questions.filter(
      (q) =>
        q.statement.toLowerCase().includes(term) ||
        q.alternatives.some((a) => a.text.toLowerCase().includes(term)) ||
        q.catalog_items?.name?.toLowerCase().includes(term) ||
        String(q.number ?? '').includes(term)
    );
  }, [questions, search]);

  const toggle = (q: Question) => {
    setSelected((prev) => (prev.some((s) => s.id === q.id) ? prev.filter((s) => s.id !== q.id) : [...prev, q]));
  };

  const create = async () => {
    setError('');
    if (!title.trim()) return setError('Dê um título ao simulado.');
    if (!turmaId) return setError('Selecione a turma.');
    if (selected.length === 0) return setError('Selecione pelo menos uma questão.');
    setSaving(true);
    try {
      const { data } = await api.post('/exams', { title, turmaId, questionIds: selected.map((q) => q.id) });
      navigate(`/professor/simulados/${data.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Carregando banco de questões..." />;

  return (
    <div className="animate-fade-in max-w-5xl">
      <Link to="/professor/simulados" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 mb-4">
        <ArrowLeft size={16} /> Simulados
      </Link>

      <PageHeader title="Novo simulado" subtitle="Selecione questões aprovadas do banco e defina a turma." />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <Card className="!p-4">
            <Input label="Título do simulado" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Simulado 01 — Eletricidade" />
          </Card>

          <Card className="!p-4">
            <Select label="Turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Card>

          <Card className="!p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-100">Banco de questões aprovadas</h2>
              <span className="text-xs text-slate-500">{filtered.length} encontrada(s)</span>
            </div>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por enunciado, assunto ou número..." className="mb-4" />
            {filtered.length === 0 ? (
              <Empty title="Nenhuma questão aprovada" description="Aprove questões na fila de revisão para montar simulados." />
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filtered.map((q) => {
                  const isSel = selected.some((s) => s.id === q.id);
                  return (
                    <button key={q.id} onClick={() => toggle(q)} className={`w-full text-left rounded-xl border px-4 py-3 transition ${isSel ? 'border-primary-500/50 bg-primary-500/10' : 'border-[color:var(--border)] hover:border-slate-500'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${isSel ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-500 text-transparent'}`}>
                          ✓
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {q.number && <Badge tone="neutral">Q{q.number}</Badge>}
                            {q.gabarito && <Badge tone="teal">Gabarito: {q.gabarito.toUpperCase()}</Badge>}
                            {q.catalog_items?.name && <Badge tone="blue">{q.catalog_items.name}</Badge>}
                          </div>
                          <p className="text-sm text-slate-200 line-clamp-2">{q.statement}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <ListOrdered size={16} className="text-primary-400" />
              <h2 className="font-bold text-slate-100">Questões selecionadas</h2>
            </div>
            {selected.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma questão selecionada.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selected.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-xs font-bold text-primary-300">{i + 1}</span>
                    <p className="flex-1 text-xs text-slate-300 truncate">{q.number ? `Q${q.number}` : 'Questão'} — {q.statement}</p>
                    <button className="text-slate-500 hover:text-red-400" onClick={() => toggle(q)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-400 mt-4">{selected.length} questão(ões) · ordem igual à seleção</p>
          </Card>

          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

          <Button onClick={create} className="w-full" loading={saving} disabled={selected.length === 0}>
            <Plus size={16} /> Criar simulado
          </Button>
        </aside>
      </div>
    </div>
  );
}