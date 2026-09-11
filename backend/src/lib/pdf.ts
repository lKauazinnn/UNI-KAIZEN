import pdf from 'pdf-parse';

export interface ExtractedAlternative {
  letter: string;
  text: string;
}

export interface ExtractedImage {
  url?: string;
  caption?: string;
  source?: string;
  page?: number;
}

/**
 * Procedência do gabarito. O backlog é explícito: o gabarito não pode ser
 * inventado silenciosamente, e a origem tem de ficar registrada (B12).
 *  - 'document'  → lido da tabela de gabarito do próprio PDF (confiável)
 *  - 'heuristic' → deduzido por heurística do texto (SUSPEITO, exige conferência)
 */
export type GabaritoOrigin = 'document' | 'heuristic';

export interface ExtractedQuestion {
  number?: number;
  statement: string;
  alternatives: ExtractedAlternative[];
  images: ExtractedImage[];
  gabarito?: string;
  gabaritoOrigin?: GabaritoOrigin;
  gabaritoConfidence?: number;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  answeredFromKey?: boolean;
}

// ─── Regexes helpers ──────────────────────────────────────────────────────

// Número que abre uma questão: "1." "1)" "01." "QUESTÃO 1" "Questão 3"
const QUESTION_START_RE =
  /^(?:\s*)(?:[\s\S]*?\b(?:quest[ãa]o|questao|q\.?|quest\.?)\s*[\.:]?\s*)?(\d+)\s*[\.\)\]\:]\s*(?=\S)/im;
const QUESTION_HEADER_RE =
  /^([^(\r\n]*?\b(?:[qQ]uest[ãa]o|[qQ]uestao|\bQ\b)\s*\.?\s*\d+[\.\)\]]?\s*[-–:]?\s*)/;

// Alternativa: "(A) texto" ou "A) texto"
const ALTERNATIVE_RE = /^\(?([A-Ea-e])\)\s*(.*)$/;

// Linha de gabarito agregado: "1 - C", "1) B 2) A", "01. D"
const GABARITO_LINE_RE = /(?:^|\s)(\d{1,3})\s*(?:[-–—:]|\b-\b)?\s*\(?\s*([A-Ea-e])\s*\)?(?=\s|$)/g;

const GABARITO_HEADER_RE = /^(gabarito|respostas|answer key|respostas das quest[õo]es|gabarito comentado)/i;

const VISUAL_REFERENCE_RE =
  /\b(figura|fig\.|gr[áa]ficos?|mapas?|imagem|diagrama|charge|tabela)\s*[\w\s]*(\d+)?|\(\s*(figura|imagem)\s*\d*\s*\)/gi;

const LETTER_RE = /^\(?([A-Ea-e])\)?$/;

// ─── Parser principal ─────────────────────────────────────────────────────

export async function extractQuestionsFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  // pdf-parse (pdf.js 1.10) se comporta de forma inconsistente com Buffer no
  // runtime esbuild/tsx; sempre passamos uma Uint8Array limpa.
  const input = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const raw = await pdf(input as unknown as Buffer);

  // Peças de texto por página (para rastrear referências visuais por página)
  const perPage: string[] = String((raw as any).text ?? raw.text ?? '')
    .split(/\f/)
    .filter((p) => p.trim().length > 0);

  const fullText = perPage.join('\n');

  // 1) Detectar gabarito agregado antes de fatiar as questões
  const gabaritoMap = extractGabaritoKey(fullText);

  // 2) Fatiar em blocos de questão
  const blocks = splitIntoQuestionBlocks(fullText);

  // 3) Para cada bloco, extrair enunciado, alternativas, elementos visuais
  const questions: ExtractedQuestion[] = [];
  let unnamedCounter = 0;

  for (const block of blocks) {
    if (!block || !block.trim()) continue;

    const numberedMatch = QUESTION_START_RE.exec(block);
    let number: number | undefined = numberedMatch ? parseInt(numberedMatch[1], 10) : undefined;

    let remainder = block;
    const headerMatch = QUESTION_HEADER_RE.exec(remainder);
    if (headerMatch) {
      remainder = remainder.slice(headerMatch[0].length);
    }

    const { alternatives, withoutAlternatives } = extractAlternatives(remainder);
    let statement = withoutAlternatives.trim();
    const images = extractVisualReferences(statement);

    // B12 — o gabarito da tabela do documento SEMPRE tem prioridade sobre a
    // heurística. A heurística é um palpite e é marcada como tal, para o
    // professor conferir. Nunca gravamos palpite como se viesse do documento.
    let gabarito: string | undefined;
    let gabaritoOrigin: GabaritoOrigin | undefined;
    let gabaritoConfidence: number | undefined;

    if (number !== undefined) {
      const fromKey = gabaritoMap.get(number);
      if (fromKey) {
        gabarito = fromKey;
        gabaritoOrigin = 'document';
        gabaritoConfidence = 0.95;
      }
    }

    if (!gabarito && alternatives.length > 0) {
      const guess = guessAlternativeFromStatement(statement);
      if (guess) {
        gabarito = guess;
        gabaritoOrigin = 'heuristic';
        gabaritoConfidence = 0.4;
      }
    }

    // Coerência: a letra precisa existir entre as alternativas extraídas.
    // Um gabarito "E" numa questão com 4 alternativas é ruído, não resposta.
    if (gabarito && alternatives.length > 0) {
      const letters = new Set(alternatives.map((a) => a.letter.toUpperCase()));
      if (!letters.has(gabarito.toUpperCase())) {
        gabarito = undefined;
        gabaritoOrigin = undefined;
        gabaritoConfidence = undefined;
      }
    }

    if (!number) {
      unnamedCounter += 1;
    }

    // Sem alternativas não é uma questão de múltipla escolha utilizável — mas
    // ainda assim entra na revisão para o professor decidir.
    questions.push({
      number: number ?? unnamedCounter,
      statement: statement || '(enunciado não identificado — revisar)',
      alternatives,
      images,
      gabarito,
      gabaritoOrigin,
      gabaritoConfidence,
    });
  }

  return { questions, answeredFromKey: gabaritoMap.size > 0 };
}

// ─── Gabarito agregado ────────────────────────────────────────────────────

/**
 * Lê TODAS as tabelas de gabarito do documento.
 *
 * A versão anterior parava no primeiro cabeçalho e na primeira linha com pares,
 * então uma prova de 45 questões só recebia o gabarito da primeira linha — as
 * demais ficavam sem resposta e eram contadas como erro de todos os alunos.
 * Aqui percorremos cada bloco de gabarito até ele acabar de fato.
 */
function extractGabaritoKey(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Quantas linhas seguidas sem nenhum par "número → letra" encerram o bloco.
  const MAX_GAP = 2;

  for (let i = 0; i < lines.length; i++) {
    if (!GABARITO_HEADER_RE.test(lines[i])) continue;

    let gap = 0;
    for (let j = i; j < lines.length; j++) {
      const candidate = lines[j];

      // Um novo cabeçalho de gabarito (outra matéria, outro caderno) continua o bloco.
      if (j > i && GABARITO_HEADER_RE.test(candidate)) {
        gap = 0;
        continue;
      }

      const matches = Array.from(candidate.matchAll(GABARITO_LINE_RE));
      if (matches.length === 0) {
        gap += 1;
        if (gap > MAX_GAP) break;
        continue;
      }

      gap = 0;
      for (const m of matches) {
        const num = parseInt(m[1], 10);
        // Primeira ocorrência vence: tabelas repetidas não sobrescrevem.
        if (!map.has(num)) map.set(num, m[2].toUpperCase());
      }
      i = j; // não reprocessa linhas já consumidas por este bloco
    }
  }
  return map;
}

// ─── Fatiamento em blocos de questão ──────────────────────────────────────

const INSTRUCTION_PATTERNS = [
  /tempo total para resolu[çc][ãa]o da prova/i,
  /n[ãa]o [ée] permitido deixar o local/i,
  /apenas caneta esferogr[áa]fica/i,
  /caderno de quest[õo]es [ée] composto por/i,
  /devolu[çc][ãa]o dos cadernos/i,
  /aguarde o aviso para iniciar a prova/i,
  /instru[çc][õo]es gerais/i,
  /leia com aten[çc][ãa]o as instru[çc][õo]es/i,
  /folha de respostas/i,
  /ser[ãa]o divulgadas as m[ée]dias/i,
  /preencha o cart[ãa]o-resposta/i,
];

function isInstructionBlock(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((p) => p.test(text));
}

function splitIntoQuestionBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const isQuestionStart = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const m = trimmed.match(/^(?:(\d+)\s*[\.\)\]\:]\s*|\b(?:quest[ãa]o|quest[ãa]o\s*\d+|quest\.?\s*\d+|q\.\s*\d+)\b[\s\.\:]*\d*\s*[\.\)\:]?)/i);
    if (!m) return false;
    // Não confundir número de alternativa isolada com início de questão
    if (/^\(?[A-Ea-e]\)?\s*$/.test(trimmed)) return false;
    return true;
  };

  for (const line of lines) {
    // Nada depois do bloco de gabarito pertence a uma questão
    if (GABARITO_HEADER_RE.test(line.trim())) break;
    if (isQuestionStart(line)) {
      if (current.length > 0) {
        const blk = current.join('\n').trim();
        if (!isInstructionBlock(blk)) blocks.push(blk);
      }
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const blk = current.join('\n').trim();
    if (!isInstructionBlock(blk)) blocks.push(blk);
  }
  return blocks.filter((b) => b.length > 0);
}

// ─── Alternativas ─────────────────────────────────────────────────────────

function extractAlternatives(block: string): {
  alternatives: ExtractedAlternative[];
  withoutAlternatives: string;
} {
  const rawLines = block.split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);

  const alternativeLines: { line: string; letter: string; text: string }[] = [];
  for (const line of lines) {
    const m = ALTERNATIVE_RE.exec(line);
    if (m && m[2] && m[2].trim().length > 0) {
      alternativeLines.push({ line, letter: m[1].toUpperCase(), text: m[2].trim() });
    }
  }

  // Identifica onde as alternativas começam no bloco original
  if (alternativeLines.length === 0) {
    return { alternatives: [], withoutAlternatives: block };
  }

  const firstAltLine = alternativeLines[0].line;
  const idx = rawLines.findIndex((l) => l.trim() === firstAltLine);
  const statement = rawLines.slice(0, idx).join('\n').trim();

  // Cada alternativa pode ter continuação (linha seguinte sem iniciar com letra)
  const alternatives: ExtractedAlternative[] = [];
  let adding = false;
  for (const line of rawLines) {
    const t = line.trim();
    const m = ALTERNATIVE_RE.exec(t);
    if (m && m[2] && m[2].trim().length > 0 && alternatives.length < alternativeLines.length) {
      alternatives.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
      adding = true;
    } else if (adding && alternatives.length > 0) {
      alternatives[alternatives.length - 1].text += ' ' + t;
    }
  }

  return { alternatives, withoutAlternatives: statement || block };
}

// ─── Gabarito por afirmação no final do enunciado ─────────────────────────

function guessAlternativeFromStatement(statement: string): string | undefined {
  // Frases típicas: "assinale a alternativa correta" + final "(D)" "(C)" ou terminar em "C)" "E)"
  const sentenceTail = statement.split(/\r?\n/).pop() ?? statement;
  const mTail = LETTER_RE.exec(sentenceTail.trim());
  if (mTail) return mTail[1].toUpperCase();
  return undefined;
}

// ─── Elementos visuais ────────────────────────────────────────────────────

function extractVisualReferences(text: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const matches = Array.from(text.matchAll(VISUAL_REFERENCE_RE));
  const seen = new Set<string>();
  for (const m of matches) {
    const caption = m[0].replace(/\s+/g, ' ').trim();
    if (seen.has(caption)) continue;
    seen.add(caption);
    images.push({ caption, source: 'pdf-reference' });
  }
  return images;
}
