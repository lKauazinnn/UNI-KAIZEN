import { Link } from 'react-router-dom';
import { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';

export function AuthShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3.5 rounded-2xl bg-primary-500/15 border border-primary-500/20 mb-4">
            <FlaskConical size={32} className="text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Kaizen Laboratórios</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            A IA prepara. O professor confere e aprova. <br /> O aluno evolui.
          </p>
        </div>
        <div className="rounded-2xl bg-[color:var(--bg-card)] border border-[color:var(--border)] p-6 sm:p-8 shadow-2xl">
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-primary-400 hover:text-primary-300 transition">
      {children}
    </Link>
  );
}