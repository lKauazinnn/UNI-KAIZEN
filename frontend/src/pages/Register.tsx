import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, apiError } from '../services/api';
import { AuthShell, AuthLink } from '../components/AuthShell';
import { Button, Input, Select } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('aluno');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<{ name: string; slug: string }[]>([]);
  // Só o professor cria instituição nova. O aluno escolhe uma existente: digitar
  // o nome à mão criava uma organização paralela e ele nunca aparecia para o
  // professor na hora de vincular à turma.
  const [novaOrg, setNovaOrg] = useState(false);

  useEffect(() => {
    api
      .get('/auth/organizations')
      .then(({ data }) => setOrganizations(Array.isArray(data) ? data : []))
      .catch(() => setOrganizations([]));
  }, []);

  // Sem nenhuma organização cadastrada, o primeiro acesso precisa poder criar.
  const precisaCriar = novaOrg || organizations.length === 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register({ name, email, password, role, organizationSlug });
      navigate(user.role === 'aluno' ? '/aluno/inicio' : user.role === 'admin' ? '/admin/dashboard' : '/inicio');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <>
          Já tem conta? <AuthLink to="/login">Entrar</AuthLink>
        </>
      }
    >
      <h2 className="text-xl font-bold text-slate-100 mb-1">Criar conta</h2>
      <p className="text-sm text-slate-400 mb-6">
        Use o mesmo identificador de organização para que professores e alunos fiquem na mesma instituição.
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Souza" required autoFocus />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escola.com" required />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          required
        />
        <Select label="Sou" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="aluno">Aluno</option>
          <option value="professor">Professor</option>
        </Select>
        {precisaCriar ? (
          <Input
            label="Organização"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            placeholder="Ex.: colegio-einstein"
            hint={
              organizations.length === 0
                ? 'Nenhuma instituição cadastrada ainda — esta será a primeira.'
                : 'Atenção: um nome diferente cria uma instituição NOVA, separada das existentes.'
            }
            required
          />
        ) : (
          <Select
            label="Organização"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            hint="Escolha a instituição em que você já estuda ou leciona."
            required
          >
            <option value="">Selecione a instituição...</option>
            {organizations.map((org) => (
              <option key={org.slug} value={org.slug}>
                {org.name}
              </option>
            ))}
          </Select>
        )}

        {organizations.length > 0 && role === 'professor' && (
          <button
            type="button"
            onClick={() => {
              setNovaOrg(!novaOrg);
              setOrganizationSlug('');
            }}
            className="text-xs font-semibold text-primary-300 hover:text-primary-200"
          >
            {novaOrg ? '← Escolher uma instituição existente' : '+ Minha instituição não está na lista'}
          </button>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
