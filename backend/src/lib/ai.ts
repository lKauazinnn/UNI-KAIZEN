import Groq from 'groq-sdk';
import { normalizeEmail } from './roles';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? 'missing' });

export const hasAiConfigured = () => Boolean(process.env.GROQ_API_KEY);

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

  try {
    const tree = buildCatalogNames(catalog);
    const names = JSON.stringify(tree);

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
    if (!json) return { catalogItemId: null, source: 'ai' };

    const { level, match } = json;
    if (!level || !match) return { catalogItemId: null, source: 'ai' };

    const matchNorm = normalizeEmail(String(match));
    const found =
      catalog.find((c) => c.level === level && normalizeEmail(c.name) === matchNorm) ?? null;

    return {
      catalogItemId: found?.id ?? null,
      source: 'ai',
      suggestedName: found?.name,
    };
  } catch (error) {
    console.error('[ai] falha ao classificar questão:', error);
    return { catalogItemId: null, source: 'ai' };
  }
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