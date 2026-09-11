import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Modal, Input, Select, ConfirmDialog } from '../../components/ui';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'professor' | 'aluno';
  isActive: boolean;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno',
};

const ROLE_TONE: Record<string, 'teal' | 'blue' | 'neutral'> = {
  admin: 'teal',
  professor: 'blue',
  aluno: 'neutral',
};

export default function AdminUsuarios() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'professor' });
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<{ id: string; active: boolean } | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/users')
      .then(({ data }) => setUsers(data))
      .catch(() => setError('Não foi possível carregar os usuários.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'professor' });
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async () => {
    if (!roleTarget) return;
    setError('');
    try {
      await api.patch(`/admin/users/${roleTarget.id}`, { role: roleTarget.role });
      setRoleTarget(null);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const toggleActive = async () => {
    if (!confirm) return;
    setError('');
    try {
      await api.patch(`/admin/users/${confirm.id}`, { isActive: !confirm.active });
      setConfirm(null);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading) return <Spinner label="Carregando usuários..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gerenciamento de usuários"
        subtitle="Crie contas de professores e alunos e administre os acessos da organização."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus size={16} /> Novo usuário
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>
      )}

      {users.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum usuário"
            description="Cadastre professores e alunos para começar."
            action={<Button onClick={() => setCreateOpen(true)}><UserPlus size={16} /> Novo usuário</Button>}
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-[color:var(--border)]">
                  <th className="px-5 py-3 font-bold">Usuário</th>
                  <th className="px-5 py-3 font-bold">Papel</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-b border-[color:var(--border)] last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/20 font-bold text-primary-300">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate">
                              {u.name} {isMe && <Badge tone="teal">você</Badge>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          {u.role === 'admin' && <ShieldCheck size={14} className="text-primary-300" />}
                          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        {isMe ? (
                          <span className="text-xs text-slate-500">Conta atual</span>
                        ) : (
                          <div className="flex gap-2">
                            {u.role === 'admin' ? (
                              <Badge tone="teal">Administrador protegido</Badge>
                            ) : (
                              <select
                                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 text-xs px-2 py-1.5"
                                value={u.role}
                                onChange={(e) => {
                                  setRoleTarget({ ...u, role: e.target.value as AdminUser['role'] });
                                }}
                              >
                                <option value="professor">Professor</option>
                                <option value="aluno">Aluno</option>
                              </select>
                            )}
                            <Button size="sm" variant={u.isActive ? 'ghost' : 'success'} onClick={() => setConfirm({ id: u.id, active: u.isActive })}>
                              {u.isActive ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-card)] p-4 text-sm text-slate-400">
        <UsersIcon size={18} className="mt-0.5 shrink-0 text-primary-400" />
        <p>
           <b className="text-slate-300">Como os professores vinculam alunos?</b> No detalhe da turma, use{' '}
           <span className="text-slate-200 font-semibold">Vincular aluno</span> para pesquisar um aluno cadastrado e confirmar o vínculo.
        </p>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo usuário">
        <form onSubmit={createUser} className="space-y-4">
          {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}
          <Input
            label="Nome completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ana Souza"
            required
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="nome@escola.com"
            required
          />
          <Input
            label="Senha inicial"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
          />
          <Select label="Papel" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="professor">Professor</option>
            <option value="aluno">Aluno</option>
          </Select>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Criar usuário
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!roleTarget} onClose={() => setRoleTarget(null)} title="Alterar papel">
        <p className="text-sm text-slate-400 mb-6">
          Alterar o papel de <b className="text-slate-200">{roleTarget?.name}</b> para{' '}
          <b className="text-slate-200">{roleTarget ? ROLE_LABEL[roleTarget.role] : ''}</b>?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setRoleTarget(null)}>
            Cancelar
          </Button>
          <Button onClick={changeRole}>Confirmar</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={toggleActive}
        title={confirm?.active ? 'Desativar usuário' : 'Ativar usuário'}
        message={
          confirm?.active
            ? 'O usuário perderá o acesso ao sistema até ser reativado.'
            : 'O usuário voltará a ter acesso ao sistema.'
        }
        confirmLabel={confirm?.active ? 'Desativar' : 'Ativar'}
        danger={!!confirm?.active}
      />
    </div>
  );
}
