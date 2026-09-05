import { ReactNode } from 'react';
import { Loader2, Inbox } from 'lucide-react';

const cx = (...cls: (string | false | undefined | null)[]) => cls.filter(Boolean).join(' ');

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/20',
    outline: 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
    danger: 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20',
    success: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };
  return (
    <button
      className={cx(
        'font-semibold inline-flex items-center justify-center gap-2 focus-ring disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={cx(
        'bg-[color:var(--bg-card)] border border-[color:var(--border)] rounded-2xl p-5',
        hover && 'hover-lift cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'amber' | 'teal' | 'blue' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    teal: 'bg-primary-500/10 text-primary-300 border-primary-500/20',
    blue: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', tones[tone])}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <Loader2 size={32} className="animate-spin text-primary-400" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="p-4 rounded-2xl bg-slate-500/10">
        <Inbox size={32} className="text-slate-400" />
      </div>
      <h3 className="font-bold text-lg text-slate-200">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Input({ label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</span>}
      <input
        className={cx(
          'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm transition',
          className
        )}
        {...props}
      />
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Select({ label, hint, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</span>}
      <select
        className={cx(
          'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm transition',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Textarea({ label, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</span>}
      <textarea
        className={cx(
          'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm transition min-h-[100px]',
          className
        )}
        {...props}
      />
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cx(
          'relative bg-[color:var(--bg-card)] border border-[color:var(--border)] rounded-2xl shadow-2xl w-full animate-scale-in max-h-[90vh] overflow-y-auto',
          wide ? 'max-w-3xl' : 'max-w-lg'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
          <h3 className="font-bold text-lg text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className={cx('h-full rounded-full transition-all', color ?? 'bg-primary-400')}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}