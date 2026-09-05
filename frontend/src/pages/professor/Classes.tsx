import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Turma } from '../../types';
import { PageHeader, Card, Button, Input, Modal, Spinner, EmptyState, Badge } from '../../components/ui';

export default function Classes() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

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

      {loading ? (
        <Spinner label="Carregando turmas..." />
      ) : turmas.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma turma criada"
            description="Crie a primeira turma para vincular seus alunos e distribuir simulados."
            action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nova turma</Button>}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map((turma) => (
            <Link key={turma.id} to={`/professor/turmas/${turma.id}`} className="block">
              <Card hover className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
                    <Users size={22} className="text-primary-400" />
                  </div>
                  {turma.archived && <Badge tone="neutral">Arquivada</Badge>}
                </div>
                <h3 className="font-bold text-slate-100 mb-1">{turma.name}</h3>
                <p className="text-xs text-slate-400">
                  Criada em {new Date(turma.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </Card>
            </Link>
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
    </div>
  );
}