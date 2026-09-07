import { Question } from '../types';
import { Badge } from './ui';

/**
 * Renderização ÚNICA da questão, usada tanto na conferência do professor
 * quanto na tela em que o aluno responde.
 *
 * O backlog exige que "o professor confira a questão exatamente como o aluno
 * verá" (B14) e que "o visual do professor corresponda ao visual do aluno"
 * (B20). Antes existiam duas árvores de markup independentes, então qualquer
 * ajuste numa tela não aparecia na outra. Aqui a diferença entre os dois modos
 * é só interatividade e exibição do gabarito — a estrutura é a mesma.
 */
export function QuestionView({
  question,
  compact,
  mode = 'review',
  index,
  selected,
  onSelect,
}: {
  question: Question;
  compact?: boolean;
  /** 'review' = professor confere · 'exam' = aluno responde */
  mode?: 'review' | 'exam';
  /** Usado como número quando a questão não tem número próprio */
  index?: number;
  /** Letra marcada pelo aluno (modo 'exam') */
  selected?: string | null;
  /** Marca/desmarca a alternativa (modo 'exam') */
  onSelect?: (letter: string | null) => void;
}) {
  const isExam = mode === 'exam';
  const gabarito = question.gabarito?.toUpperCase();
  const numero = question.number ?? (index !== undefined ? index + 1 : undefined);

  // A origem do gabarito é requisito explícito da tela de revisão: o professor
  // precisa saber se a resposta veio do documento ou foi deduzida (B12).
  const origem = question.gabaritoOrigin;
  const origemLabel =
    origem === 'document'
      ? 'do documento'
      : origem === 'heuristic'
      ? 'deduzido — conferir'
      : origem === 'professor'
      ? 'definido por você'
      : origem === 'ai'
      ? 'sugerido por IA — conferir'
      : null;
  const origemTone = origem === 'document' || origem === 'professor' ? 'green' : 'amber';

  const visuais = question.images ?? [];
  const comUrl = visuais.filter((img) => img.url);
  const semUrl = visuais.filter((img) => !img.url);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {numero !== undefined && <Badge tone="neutral">Questão {numero}</Badge>}

        {isExam
          ? selected && <Badge tone="teal">Respondida: {selected}</Badge>
          : (
            <>
              {question.status && (
                <Badge tone={question.status === 'approved' ? 'green' : question.status === 'rejected' ? 'red' : 'amber'}>
                  {question.status === 'approved' ? 'Aprovada' : question.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                </Badge>
              )}
              {question.gabarito ? (
                <>
                  <Badge tone="teal">Gabarito: {gabarito}</Badge>
                  {origemLabel && <Badge tone={origemTone}>Gabarito {origemLabel}</Badge>}
                </>
              ) : (
                <Badge tone="red">Sem gabarito</Badge>
              )}
              {question.catalogItemId && question.catalog_items?.name && (
                <Badge tone="blue">{question.catalog_items.name}</Badge>
              )}
              {question.classificationSource === 'ai' && <Badge tone="neutral">Classificação por IA</Badge>}
              {question.classificationSource === 'professor' && <Badge tone="neutral">Classificação do professor</Badge>}
            </>
          )}
      </div>

      <div className="text-slate-100 leading-relaxed whitespace-pre-wrap">{question.statement}</div>

      {/* Todos os visuais, não só o primeiro — uma questão pode ter mapa + tabela. */}
      {comUrl.map((img, i) => (
        <div key={img.id ?? `url-${i}`} className="rounded-xl border border-[color:var(--border)] overflow-hidden">
          <img
            src={img.url}
            alt={img.caption || 'Elemento visual da questão'}
            className="w-full h-auto"
          />
          {img.caption && (
            <p className="px-3 py-2 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/60">{img.caption}</p>
          )}
        </div>
      ))}

      {semUrl.length > 0 && (
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs font-bold text-primary-300 uppercase tracking-wide mb-1">Referência visual do PDF</p>
          <ul className="space-y-1 text-sm text-slate-400">
            {semUrl.map((img, i) => (
              <li key={img.id ?? `ref-${i}`}>• {img.caption || img.type || 'Figura'}</li>
            ))}
          </ul>
        </div>
      )}

      {question.alternatives && question.alternatives.length > 0 ? (
        <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
          {question.alternatives.map((alt) => {
            const isSelected = isExam && selected === alt.letter;
            const conteudo = (
              <>
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition ${
                    isSelected
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'border-slate-500 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {alt.letter}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{alt.text}</span>
              </>
            );

            const base = 'w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition';

            return isExam ? (
              <button
                key={alt.letter}
                type="button"
                onClick={() => onSelect?.(isSelected ? null : alt.letter)}
                className={`${base} ${
                  isSelected ? 'border-primary-500/60 bg-primary-500/10' : 'border-[color:var(--border)] hover:border-slate-500'
                }`}
              >
                {conteudo}
              </button>
            ) : (
              <div
                key={alt.letter}
                className={`${base} border-[color:var(--border)] bg-white dark:bg-slate-900/40`}
              >
                {conteudo}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border)] bg-white dark:bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="blue">Questão de Resposta Livre</Badge>
            <span className="text-xs text-slate-400">O aluno digita a resposta em texto/número</span>
          </div>

          {isExam ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Digite sua resposta ou resolução resumida:
              </label>
              <textarea
                value={selected ?? ''}
                onChange={(e) => onSelect?.(e.target.value)}
                placeholder="Digite sua resposta aqui..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-primary-500 min-h-[90px]"
              />
            </div>
          ) : (
            question.gabarito && (
              <div className="rounded-lg bg-primary-500/10 border border-primary-500/20 p-3">
                <p className="text-xs font-bold text-primary-400 uppercase tracking-wide mb-1">
                  Resposta oficial / esperada:
                </p>
                <p className="text-sm font-semibold text-slate-200 whitespace-pre-wrap">
                  {question.gabarito}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
