// Extração de elementos visuais do PDF (B11).
// Renderiza cada página com pdf.js + @napi-rs/canvas, localiza os blocos de
// questão pelas coordenadas do texto e recorta a região de cada questão como
// PNG — preservando imagens, gráficos, mapas, tabelas e diagramas exatamente
// como aparecem para o aluno.
import { createCanvas, Path2D as NapiPath2D, DOMMatrix as NapiDOMMatrix } from '@napi-rs/canvas';

export interface VisualRegion {
  questionNumber: number;
  pageIndex: number; // 1-based
  buffer: Buffer; // PNG
  width: number;
  height: number;
}

const SCALE = 2;
const X_PAD = 12; // unidades PDF
const BOTTOM_PAD = 14;
const TOP_PAD = 120; // espaço acima do texto para capturar figuras posicionadas antes da questão

const GABARITO_TERMINATOR_RE = /^(gabarito|respostas|answer key|respostas das quest[õo]es|gabarito comentado)/i;

let pdfjsPromise: Promise<any> | null = null;
let pdfCanvasFactory: any = null;

type PdfCanvasFactory = {
  create: (w: number, h: number) => { canvas: any; context: any };
  reset: (c: any, w: number, h: number) => void;
  destroy: (c: any) => void;
};

function makeCanvasFactory(): PdfCanvasFactory {
  return {
    create(w: number, h: number) {
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext('2d') as any };
    },
    reset(c: any, w: number, h: number) {
      c.canvas.width = w;
      c.canvas.height = h;
    },
    destroy(c: any) {
      c.canvas.width = 0;
      c.canvas.height = 0;
      c.canvas = null as any;
      c.context = null as any;
    },
  };
}

// Carrega o pdf.js (legacy ESM) uma única vez e prepara o polyfill de canvas.
async function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // @ts-ignore - módulo ESM sem tipos; usamos somente getDocument
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (typeof (globalThis as any).Path2D === 'undefined') (globalThis as any).Path2D = NapiPath2D;
      if (typeof (globalThis as any).DOMMatrix === 'undefined') (globalThis as any).DOMMatrix = NapiDOMMatrix;
      pdfCanvasFactory = makeCanvasFactory();
      return mod;
    })();
  }
  return pdfjsPromise;
}

// Extrai visuais reais preservando cada questão que estiver numerada.
export async function extractVisualRegions(pdfBuffer: Buffer): Promise<VisualRegion[]> {
  const regions: VisualRegion[] = [];
  const pdfjs = await loadPdfjs();
  const input = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);

  const doc = await pdfjs.getDocument({
    data: input,
    useSystemFonts: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    canvasFactory: pdfCanvasFactory,
  }).promise;

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const text = await page.getTextContent();
      const blocks = buildBlocks(text.items ?? []);
      if (blocks.length === 0) continue;

      const viewport = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

      // Silencia warnings de fontes padrão não embutidas (ex: Helvetica puro)
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        await page.render({
          canvasContext: canvas.getContext('2d') as any,
          viewport,
          canvasFactory: pdfCanvasFactory,
        }).promise;
      } catch (pageError) {
        console.error('[pdf-visuals] falha ao renderizar página', pageNumber, pageError);
        continue;
      } finally {
        console.warn = originalWarn;
      }

      for (const block of blocks) {
        const crop = cropRegion(canvas, viewport, block);
        if (!crop) continue;
        regions.push({
          questionNumber: block.number,
          pageIndex: pageNumber,
          buffer: crop.buffer,
          width: crop.width,
          height: crop.height,
        });
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }

  return regions;
}

interface Block {
  number: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function buildBlocks(items: any[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str.trim();
    if (!str) continue;
    if (GABARITO_TERMINATOR_RE.test(str)) break;

    const start = questionNumberFromItem(str);
    const tx = item.transform?.[4] ?? 0;
    const ty = item.transform?.[5] ?? 0;
    const th = item.height ?? 0;
    const tw = item.width ?? 0;

    if (start !== null) {
      if (current) blocks.push(current);
      current = { number: start, minX: tx, maxX: tx + tw, minY: ty - th, maxY: ty };
      continue;
    }

    if (!current) continue;
    current.minX = Math.min(current.minX, tx);
    current.maxX = Math.max(current.maxX, tx + tw);
    current.minY = Math.min(current.minY, ty - th);
    current.maxY = Math.max(current.maxY, ty);
  }

  if (current) blocks.push(current);
  return blocks;
}

function questionNumberFromItem(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  if (/^\(?[A-Ea-e]\)?$/.test(s)) return null; // alternativa isolada
  const numeric = s.match(/^(\d{1,3})\s*[\.\)\]\:]\s*/);
  if (numeric) return parseInt(numeric[1], 10);
  const named = s.match(/^\b(?:quest[ãa]o|questao)\s*\.?\s*(\d{1,3})\b/i);
  if (named) return parseInt(named[1], 10);
  const short = s.match(/^\bq\.?\s*(\d{1,3})\b/i);
  if (short) return parseInt(short[1], 10);
  return null;
}

function cropRegion(canvas: any, viewport: any, block: Block): { buffer: Buffer; width: number; height: number } | null {
  const blockHeight = block.maxY - block.minY;
  const topPad = Math.max(TOP_PAD, blockHeight * 0.12);

  const bottomLeft = viewport.convertToViewportPoint(block.minX - X_PAD, block.minY - BOTTOM_PAD);
  const topRight = viewport.convertToViewportPoint(block.maxX + X_PAD, block.maxY + topPad);

  let sx = Math.min(bottomLeft[0], topRight[0]);
  let sy = Math.min(bottomLeft[1], topRight[1]);
  let sw = Math.abs(topRight[0] - bottomLeft[0]);
  let sh = Math.abs(topRight[1] - bottomLeft[1]);

  if (!isFinite(sx) || !isFinite(sy) || !isFinite(sw) || !isFinite(sh)) return null;

  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > canvas.width) sw = canvas.width - sx;
  if (sy + sh > canvas.height) sh = canvas.height - sy;
  if (sw < 24 || sh < 24) return null;

  const width = Math.ceil(sw);
  const height = Math.ceil(sh);
  const out = createCanvas(width, height);
  const ctx = out.getContext('2d') as any;
  ctx.drawImage(canvas, Math.floor(sx), Math.floor(sy), width, height, 0, 0, width, height);
  return { buffer: out.toBuffer('image/png'), width, height };
}