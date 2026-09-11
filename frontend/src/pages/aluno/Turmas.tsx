import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { Turma } from '../../types';
import { PageHeader, Card, Spinner, EmptyState, Badge } from '../../components/ui';

export default function AlunoTurmas() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/classes')
      .then(({ data }) => setTurmas(data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Minhas turmas" subtitle="Selecione uma turma para ver os simulados disponíveis." />

      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <Spinner label="Carregando turmas..." />
      ) : turmas.length === 0 ? (
        <Card>
          <EmptyState
            title="Você ainda não participa de nenhuma turma"
            description="Quando um professor vincular seu usuário, a turma aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map((turma) => (
            <Link to={`/aluno/simulados?turmaId=${turma.id}`} key={turma.id} className="block">
            <Card className={`h-full flex flex-col ${turma.archived ? 'opacity-70 border-dashed' : ''}`}>
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
              <span className="mt-4 text-sm font-semibold text-primary-300 flex items-center gap-1">Ver simulados <ArrowRight size={14} /></span>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
