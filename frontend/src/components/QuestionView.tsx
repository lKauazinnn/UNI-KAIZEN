import { Question } from '../types';
import { Badge } from './ui';

export function QuestionView({
  question,
  compact,
}: {
  question: Question;
  compact?: boolean;
}) {
  const gabarito = question.gabarito?.toUpperCase();
  const whatsappTip = 'Os elementos visuais (imagens, gráficos, mapas) do PDF original são preservados como referência para validação manual.';

  return (
    <div className="space-y-4">
      {(question.number || question.status || question.gabarito || question.catalogItemId) && (
        <div className="flex flex-wrap items-center gap-2">
          {question.number && <Badge tone="neutral">Questão {question.number}</Badge>}
          {question.status && (
            <Badge tone={question.status === 'approved' ? 'green' : question.status === 'rejected' ? 'red' : 'amber'}>
              {question.status === 'approved' ? 'Aprovada' : question.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
            </Badge>
          )}
          {question.gabarito && <Badge tone="teal">Gabarito: {gabarito}</Badge>}
          {question.catalogItemId && question.catalog_items?.name && (
            <Badge tone="blue">{question.catalog_items.name}</Badge>
          )}
          {question.classificationSource === 'ai' && <Badge tone="neutral">IA</Badge>}
          {question.classificationSource === 'professor' && <Badge tone="neutral">Professor</Badge>}
        </div>
      )}

      <div className="text-slate-100 leading-relaxed whitespace-pre-wrap">{question.statement}</div>

      {question.images && question.images.length > 0 && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs font-bold text-primary-300 uppercase tracking-wide mb-1">Referência visual preservada</p>
          <p className="text-sm text-slate-300">{whatsappTip}</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {question.images.map((img, i) => (
              <li key={img.id ?? i}>• {img.caption || img.type || 'Figura'}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {question.alternatives.map((alt) => (
          <div
            key={alt.letter}
            className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-white dark:bg-slate-900/40 px-4 py-3"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300">
              {alt.letter}
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{alt.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}