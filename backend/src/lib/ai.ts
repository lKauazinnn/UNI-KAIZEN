import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { normalizeEmail } from './roles';

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

function getGroqClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

export const hasAiConfigured = () => Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

export interface CatalogNode {
  id: string;
  level: number;
  name: string;
  parentId: string | null;
}

export interface ClassificationSuggestion {
  catalogItemId: string | null;
  source: 'ai' | 'professor' | null;
  suggestedName?: string;
}

// Sem chave de IA o sistema não inventa classificação: retorna null e a
// revisão fica por conta do professor (princípio: "a IA prepara; o professor
// confere e aprova" — sem IA, não há sugestão, apenas revisão manual).
export async function classifyQuestion(
  statement: string,
  catalog: CatalogNode[]
): Promise<ClassificationSuggestion> {
  if (!hasAiConfigured()) {
    return { catalogItemId: null, source: null };
  }

  const tree = buildCatalogNames(catalog);
  const names = JSON.stringify(tree);

  const aiClient = getGeminiClient();
  const groq = getGroqClient();

  // 1. Tenta classificar usando Google Gemini (GenAI) se a chave estiver configurada
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Catálogo disponível (JSON): ${names}\n\nQuestão:\n${statement.slice(0, 2000)}`,
        config: {
          temperature: 0.1,
          systemInstruction:
            'Você classifica questões de provas em um catálogo educativo com níveis: disciplina (1), tópico (2) e subtópico (3). ' +
            'Responda APENAS com JSON no formato {"level": 1|2|3, "match": "nome exato do item do catálogo"} ' +
            'escolhendo o nível mais específico que fizer sentido. Se nada casar, retorne {"level": null, "match": null}.',
          responseMimeType: 'application/json',
        },
      });

      const raw = response.text ?? '';
      const json = extractJson(raw);
      if (json && json.level && json.match) {
        const matchNorm = normalizeEmail(String(json.match));
        const found =
          catalog.find((c) => c.level === json.level && normalizeEmail(c.name) === matchNorm) ?? null;

        if (found) {
          return {
            catalogItemId: found.id,
            source: 'ai',
            suggestedName: found.name,
          };
        }
      }
    } catch (error) {
      console.error('[ai:gemini] falha ao classificar questão com Gemini:', error);
    }
  }

  // 2. Fallback para Groq se Gemini não estiver configurado ou falhar
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'Você classifica questões de provas em um catálogo educativo com níveis: disciplina (1), tópico (2) e subtópico (3). ' +
              'Responda APENAS com JSON no formato {"level": 1|2|3, "match": "nome exato do item do catálogo"} ' +
              'escolhendo o nível mais específico que fizer sentido. Se nada casar, retorne {"level": null, "match": null}.',
          },
          {
            role: 'user',
            content: `Catálogo disponível (JSON): ${names}\n\nQuestão:\n${statement.slice(0, 2000)}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      const json = extractJson(raw);
      if (json && json.level && json.match) {
        const matchNorm = normalizeEmail(String(json.match));
        const found =
          catalog.find((c) => c.level === json.level && normalizeEmail(c.name) === matchNorm) ?? null;

        return {
          catalogItemId: found?.id ?? null,
          source: 'ai',
          suggestedName: found?.name,
        };
      }
    } catch (error) {
      console.error('[ai:groq] falha ao classificar questão com Groq:', error);
    }
  }

  return { catalogItemId: null, source: 'ai' };
}

export interface ExtractedImageQuestion {
  number?: number | null;
  statement: string;
  type: 'multiple_choice' | 'free_response';
  alternatives: { letter: string; text: string }[];
  gabarito?: string | null;
  gabaritoOrigin?: 'document' | 'ai' | 'professor' | 'heuristic' | null;
  catalogItemId?: string | null;
  classificationSource?: 'ai' | null;
}

export async function extractQuestionFromImage(
  buffer: Buffer,
  mimeType: string,
  catalog: CatalogNode[]
): Promise<ExtractedImageQuestion[]> {
  const aiClient = getGeminiClient();
  if (!aiClient) {
    throw new Error('Chave GEMINI_API_KEY necessária para extração de questões a partir de imagens.');
  }

  const base64Data = buffer.toString('base64');
  const tree = buildCatalogNames(catalog);
  const catalogNames = JSON.stringify(tree);

  const prompt =
    'Você é um especialista em extração e digitalização de provas e exames educativos.\n' +
    'Analise a imagem enviada com máxima fidelidade e extraia todas as questões contidas nela.\n' +
    'Para cada questão identificada, retorne um objeto no array com os seguintes campos:\n' +
    '- "number": número da questão (ex.: 1, 2, etc.) se visível, ou null se não houver;\n' +
    '- "type": "multiple_choice" (se tiver alternativas A, B, C...) ou "free_response" (se for questão dissertativa/aberta onde o aluno resolve ou escreve a resposta);\n' +
    '- "statement": texto completo do enunciado da questão (preserve fórmulas, equações e notações matemáticas);\n' +
    '- "alternatives": se for multiple_choice, array com [{"letter": "A", "text": "..."}, {"letter": "B", "text": "..."}]. Se for free_response, deixe array vazio [];\n' +
    '- "gabarito": se a imagem indicar a resposta correta ou se for calculável com alta certeza, coloque a letra (ex: "A") ou o resultado final para resposta livre (ex: "4√3"). Caso contrário, null;\n' +
    '- "catalogMatch": nome exato de um item do catálogo correspondente ao tema ou null;\n' +
    '- "catalogLevel": nível do item do catálogo (1, 2 ou 3) ou null.\n\n' +
    `Catálogo disponível (JSON): ${catalogNames}\n\n` +
    'Responda ESTRITAMENTE em formato JSON com o schema: {"questions": [...]}.';

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/png',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  let parsedJson: any = null;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsedJson = JSON.parse(match[0]);
      } catch {}
    }
  }

  const rawList: any[] = Array.isArray(parsedJson?.questions)
    ? parsedJson.questions
    : Array.isArray(parsedJson)
    ? parsedJson
    : [];

  const results: ExtractedImageQuestion[] = [];

  for (const [idx, q] of rawList.entries()) {
    let catalogItemId: string | null = null;
    if (q.catalogMatch && q.catalogLevel) {
      const matchNorm = normalizeEmail(String(q.catalogMatch));
      const found =
        catalog.find((c) => c.level === q.catalogLevel && normalizeEmail(c.name) === matchNorm) ?? null;
      if (found) catalogItemId = found.id;
    }

    const alts = Array.isArray(q.alternatives) ? q.alternatives : [];
    const isMultiple = q.type === 'multiple_choice' || alts.length >= 2;

    results.push({
      number: typeof q.number === 'number' ? q.number : idx + 1,
      statement: String(q.statement || '').trim() || 'Questão extraída da imagem',
      type: isMultiple ? 'multiple_choice' : 'free_response',
      alternatives: isMultiple ? alts : [],
      gabarito: q.gabarito ? String(q.gabarito).trim() : null,
      gabaritoOrigin: q.gabarito ? 'ai' : null,
      catalogItemId,
      classificationSource: catalogItemId ? 'ai' : null,
    });
  }

  return results;
}

function extractJson(raw: string): { level: number | null; match: string | null } | null {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      level: parsed.level ?? null,
      match: parsed.match ?? null,
    };
  } catch {
    return null;
  }
}

function buildCatalogNames(catalog: CatalogNode[]): { id: string; level: number; name: string; parent: string | null }[] {
  return catalog.map((c) => ({
    id: c.id,
    level: c.level,
    name: c.name,
    parent: c.parentId,
  }));
}