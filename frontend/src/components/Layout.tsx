import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileQuestion,
  ClipboardList,
  BarChart3,
  LogOut,
  FlaskConical,
  BookOpen,
  Timer,
  UserCog,
  Sun,
  Moon,
  MessageSquarePlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const navPrimary = [
  { to: '/inicio', label: 'Início', icon: LayoutDashboard },
];

// Backlog do MVP: o painel do professor tem exatamente cinco áreas
// (Início vem de navPrimary). Importar PDF é uma ação dentro de Questões,
// não uma área do menu.
const navProfessor = [
  { to: '/professor/turmas', label: 'Turmas', icon: Users },
  { to: '/professor/questoes', label: 'Questões', icon: FileQuestion },
  { to: '/professor/simulados', label: 'Simulados', icon: ClipboardList },
  { to: '/professor/resultados', label: 'Resultados', icon: BarChart3 },
  { to: '/professor/solicitacoes', label: 'Solicitações', icon: MessageSquarePlus },
];

// A regra das cinco áreas vale para o painel do professor; o do aluno
// precisa da entrada de turmas para abrir os simulados de cada turma.
const navAluno = [
  { to: '/aluno/turmas', label: 'Minhas turmas', icon: Users },
  { to: '/aluno/simulados', label: 'Simulados', icon: BookOpen },
  { to: '/aluno/resultados', label: 'Meus resultados', icon: BarChart3 },
  // O aluno precisa de um canal próprio: pedir vínculo de turma e falar com o
  // professor sem depender de já ter sido vinculado por ele.
  { to: '/aluno/solicitacoes', label: 'Solicitações gerais', icon: MessageSquarePlus },
];

const navAdmin = [
  { to: '/admin/dashboard', label: 'Visão geral', icon: BarChart3 },
  { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
];

function SidebarItem({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
          isActive
            ? 'bg-primary-500/15 text-primary-300 border border-primary-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isProfessor = user?.role === 'professor' || user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--bg-card)]/50 sticky top-0 h-screen">
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-500/15 border border-primary-500/20">
              <FlaskConical size={22} className="text-primary-400" />
            </div>
            <div>
              <p className="font-bold text-slate-100 leading-tight">Kaizen</p>
              <p className="text-xs text-slate-400">Laboratórios Educacionais</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navPrimary.map((item) => (
            <SidebarItem key={item.to} {...item} />
          ))}

          <p className="px-4 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isProfessor ? 'Painel do professor' : 'Sala de aula'}
          </p>
          {(isProfessor ? navProfessor : navAluno).map((item) => (
            <SidebarItem key={item.to} {...item} />
          ))}

          {user?.role === 'admin' && (
            <>
              <p className="px-4 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Administração</p>
              {navAdmin.map((item) => (
                <SidebarItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[color:var(--border)]">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/20 font-bold text-primary-300">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.roleDisplay ?? user?.role}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar mobile */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 glass border-b border-[color:var(--border)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-primary-400" />
            <span className="font-bold text-slate-100">Kaizen</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-slate-400 text-sm font-semibold">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-[color:var(--border)] flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navPrimary.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `p-2 rounded-lg ${isActive ? 'text-primary-300' : 'text-slate-400'}`} title={label}>
            <Icon size={20} />
          </NavLink>
        ))}
        {(isProfessor ? navProfessor : navAluno).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `p-2 rounded-lg ${isActive ? 'text-primary-300' : 'text-slate-400'}`} title={label}>
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 min-w-0 lg:pl-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 pt-20 lg:pt-10 pb-24 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}

export function NextExamCard() {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-primary-500/10 border border-primary-500/20 p-4 text-primary-300">
      <Timer size={20} className="shrink-0" />
      <p className="text-sm font-semibold">O simulado é respondido online e corrigido automaticamente ao finalizar.</p>
    </div>
  );
}
