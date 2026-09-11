import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiError } from '../services/api';
import { AuthShell, AuthLink } from '../components/AuthShell';
import { Button, Input } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const user = JSON.parse(localStorage.getItem('@kaizen:user') || '{}');
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
          Ainda não tem conta? <AuthLink to="/register">Criar conta</AuthLink> ·{' '}
          <AuthLink to="/reset-password">Esqueci a senha</AuthLink>
        </>
      }
    >
      <h2 className="text-xl font-bold text-slate-100 mb-1">Entrar</h2>
      <p className="text-sm text-slate-400 mb-6">Acesse sua organização para continuar.</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escola.com" required autoFocus />
        <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
