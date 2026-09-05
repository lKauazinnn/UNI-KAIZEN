import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../services/api';
import { AuthShell, AuthLink } from '../components/AuthShell';
import { Button, Input } from '../components/ui';

function extractAccessToken() {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('access_token');
  return token;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('access_token') ?? extractAccessToken();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      if (data?.debugResetUrl) {
        setMessage(`Modo desenvolvimento — link de recuperação: ${data.debugResetUrl}`);
      } else {
        setMessage('Se o e-mail existir, enviaremos as instruções de redefinição.');
      }
      setDone(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { accessToken, password });
      setMessage('Senha redefinida com sucesso. Faça login com a nova senha.');
      setDone(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell footer={<AuthLink to="/login">Voltar ao login</AuthLink>}>
      <h2 className="text-xl font-bold text-slate-100 mb-1">Redefinir senha</h2>
      <p className="text-sm text-slate-400 mb-6">
        {accessToken ? 'Defina uma nova senha para sua conta.' : 'Informe seu e-mail para receber as instruções.'}
      </p>

      {message && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 break-all">{message}</div>
      )}
      {error && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

      {accessToken ? (
        <form onSubmit={doReset} className="space-y-4">
          <Input label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
          <Button type="submit" className="w-full" loading={loading} disabled={done}>
            Redefinir senha
          </Button>
        </form>
      ) : (
        <form onSubmit={requestReset} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@escola.com" required />
          <Button type="submit" className="w-full" loading={loading} disabled={done}>
            Enviar instruções
          </Button>
        </form>
      )}
    </AuthShell>
  );
}