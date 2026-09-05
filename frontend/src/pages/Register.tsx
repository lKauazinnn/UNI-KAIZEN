import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiError } from '../services/api';
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password, role, organizationSlug });
      navigate(role === 'aluno' ? '/aluno/inicio' : '/inicio');
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
          JÃ¡ tem conta? <AuthLink to="/login">Entrar</AuthLink>
        </>
      }
    >
      <h2 className="text-xl font-bold text-slate-100 mb-1">Criar conta</h2>
      <p className="text-sm text-slate-400 mb-6">
        Use o mesmo identificador de organizaÃ§Ã£o para que professores e alunos fiquem na mesma instituiÃ§Ã£o.
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
          placeholder="MÃ­nimo 6 caracteres"
          minLength={6}
          required
        />
        <Select label="Sou" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="aluno">Aluno</option>
          <option value="professor">Professor</option>
        </Select>
        <Input
          label="OrganizaÃ§Ã£o"
          value={organizationSlug}
          onChange={(e) => setOrganizationSlug(e.target.value)}
          placeholder="Ex.: colegio-einstein"
          hint="Professores e alunos da mesma instituiÃ§Ã£o usam o mesmo nome."
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}