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

export interface ExtractedQuestion {
  number?: number;
  statement: string;
  alternatives: ExtractedAlternative[];
  images: ExtractedImage[];
  gabarito?: string;
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
  const perPage: string[] = (raw as any).text
    ? [String((raw as any).text)]
    : (raw.text ?? '').split(/\f/).filter((p) => p.trim().length > 0);

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

    let gabarito: string | undefined;
    if (alternatives.length > 0) {
      gabarito = guessAlternativeFromStatement(statement);
    }
    if (!gabarito && number !== undefined) {
      gabarito = gabaritoMap.get(number);
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
    });
  }

  return { questions, answeredFromKey: gabaritoMap.size > 0 };
}

// ─── Gabarito agregado ────────────────────────────────────────────────────

function extractGabaritoKey(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!GABARITO_HEADER_RE.test(line)) continue;

    // Examina a linha do cabeçalho e as 3 seguintes, procurando "número -> letra"
    const candidates = [line, lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean);
    let foundPair = false;
    for (const candidate of candidates) {
      const matches = Array.from(candidate.matchAll(GABARITO_LINE_RE));
      if (matches.length === 0) continue;
      for (const m of matches) {
        map.set(parseInt(m[1], 10), m[2].toUpperCase());
        foundPair = true;
      }
      if (foundPair) break;
    }
    break;
  }
  return map;
}

// ─── Fatiamento em blocos de questão ──────────────────────────────────────

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
      if (current.length > 0) blocks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n').trim());
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