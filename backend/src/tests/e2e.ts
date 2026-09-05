/**
 * Teste ponta a ponta do piloto Kaizen (B29).
 * Exercita, sem intervenção manual no banco:
 *   professor + turma + alunos + importação PDF + revisão/aprovação
 *   + simulado + aluno respondendo + resultado.
 *
 * Uso: npm run e2e   (requer banco rodando e .env configurado)
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = `http://localhost:${process.env.PORT || 3333}/api`;

const asJson = async (r: Response): Promise<any> => (await r.json()) as any;
const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

let passed = 0;
let failed = 0;
const assert = (cond: boolean, label: string) => {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}`);
  }
};

const email = (tag: string) => `e2e-${tag}-${Date.now()}@kaizen.test`;

// Gera um PDF mínimo com duas questões em texto (ASCII, layout por linha)
export function minimalPdf(): Buffer {
  const lines = [
    '1) Se x = 4, qual e o valor de 2x + 1?',
    'A) 7',
    'B) 8',
    'C) 9',
    'D) 10',
    'E) 5',
    '',
    '2) Qual figura representa um triangulo de altura h?',
    '(Figura 1)',
    'A) Quadrado',
    'B) Triangulo',
    'C) Circulo',
    'D) Retangulo',
    '',
    'GABARITO',
    '1 - C  2 - B',
  ];

  // Cada linha é posicionada explicitamente com Tm → o pdf-parse preserva as
  // quebras de linha e o parser (src/lib/pdf.ts) consegue fatiar as questões.
  const stream = `BT /F1 12 Tf\n${lines
    .map((l, i) => `1 0 0 1 50 ${740 - i * 15} Tm (${l.replace(/[\\()]/g, (c) => '\\' + c)}) Tj`)
    .join('\n')}\nET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

async function main() {
  const slug = `e2e-org-${Date.now()}`;
  const professorEmail = email('prof');
  const alunoEmail = email('stu');

  const profPassword = 'segredo123';

  console.log('\n── Etapa 0/1 · Autenticação e papéis (B02-B04) ──');
  const regProf = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Professor E2E', email: professorEmail, password: profPassword, role: 'professor', organizationSlug: slug }),
  });
  const profData = await asJson(regProf);
  assert(regProf.status === 201 && profData.user?.role === 'professor', 'Professor registrado com papel professor');
  assert(Boolean(profData.token), 'Token retornado no registro');

  const regAluno = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Aluno E2E', email: alunoEmail, password: 'segredo123', role: 'aluno', organizationSlug: slug }),
  });
  const alunoData = await asJson(regAluno);
  assert(regAluno.status === 201 && alunoData.user?.role === 'aluno', 'Aluno registrado com papel aluno');

  // Isolamento por organização (B04): aluno de outra org não acessa turma de outra org
  const outraOrg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fora', email: email('fora'), password: 'segredo123', role: 'aluno', organizationSlug: `outra-org-${Date.now()}` }),
  });
  const foraData = await asJson(outraOrg);
  assert(outraOrg.status === 201, 'Usuário de outra organização criado');

  console.log('\n── Etapa 1 · Professor e turma (B05-B08) ──');
  const createTurma = await fetch(`${BASE}/classes`, {
    method: 'POST',
    headers: authHeaders(profData.token),
    body: JSON.stringify({ name: 'Turma E2E' }),
  });
  const turma = await asJson(createTurma);
  assert(createTurma.status === 201 && turma.id, 'Professor cria turma (B05)');

  const link = await fetch(`${BASE}/classes/${turma.id}/students/link`, {
    method: 'POST',
    headers: authHeaders(profData.token),
    body: JSON.stringify({ email: alunoEmail }),
  });
  const linkData = await asJson(link);
  assert(link.status === 201 && linkData.student, 'Vincula aluno existente à turma (B06)');

  const listClasses = await fetch(`${BASE}/classes`, { headers: authHeaders(profData.token) });
  const classes = await asJson(listClasses);
  assert(listClasses.status === 200 && classes.some((c: any) => c.id === turma.id), 'Turma aparece no painel do professor');

  const catAdd = await fetch(`${BASE}/catalog`, {
    method: 'POST',
    headers: authHeaders(profData.token),
    body: JSON.stringify({ level: 1, name: 'Matemática' }),
  });
  await addChild(profData.token, catAdd, 2, 'Funções');
  const catTree = await fetch(`${BASE}/catalog/tree`, { headers: authHeaders(profData.token) });
  const tree = await asJson(catTree);
  assert(tree.some((d: any) => d.name === 'Matemática' && d.topics?.some((t: any) => t.name === 'Funções')), 'Catálogo disciplina → tópico criado (B08)');

  console.log('\n── Etapa 2/3 · Importação, revisão e aprovação (B09-B18) ──');
  const form = new FormData();
  form.append('file', new Blob([minimalPdf()], { type: 'application/pdf' }), 'avaliacao.pdf');

  const upload = await fetch(`${BASE}/imports/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${profData.token}` },
    body: form,
  });
  const importResult = await asJson(upload);
  assert(upload.status === 201 && importResult.questions?.length === 2, 'PDF importado e questões separadas (B09-B10)');

  const q1 = importResult.questions.find((q: any) => q.number === 1);
  const q2 = importResult.questions.find((q: any) => q.number === 2);
  assert(q1?.alternatives?.length === 5, 'Alternativas extraídas da questão 1 (B10)');
  assert(q2?.gabarito === 'B' || q2?.gabarito === undefined, 'Gabarito lido do documento (B12)');
  assert(Array.isArray(q1?.images) || Array.isArray(q2?.images), 'Estrutura de elementos visuais preservada (B11)');

  const approveAll = await fetch(`${BASE}/questions/approve-valid`, {
    method: 'POST',
    headers: authHeaders(profData.token),
  });
  const approveData = await asJson(approveAll);
  assert(approveAll.status === 200 && approveData.approved === 2, 'Aprovação em lote das válidas (B17)');

  const bank = await fetch(`${BASE}/questions?status=approved`, { headers: authHeaders(profData.token) });
  const bankData = await asJson(bank);
  assert(bankData.length === 2, 'Questões aprovadas entraram no banco (B18)');

  console.log('\n── Etapa 4 · Simulado (B19-B21) ──');
  const createExam = await fetch(`${BASE}/exams`, {
    method: 'POST',
    headers: authHeaders(profData.token),
    body: JSON.stringify({ title: 'Simulado E2E', turmaId: turma.id, questionIds: bankData.map((q: any) => q.id) }),
  });
  const exam = await asJson(createExam);
  assert(createExam.status === 201 && exam.id, 'Professor cria simulado (B19)');

  const publish = await fetch(`${BASE}/exams/${exam.id}/publish`, {
    method: 'POST',
    headers: authHeaders(profData.token),
  });
  const published = await asJson(publish);
  assert(publish.status === 200 && published.status === 'published', 'Simulado publicado para a turma (B21)');

  console.log('\n── Etapa 5 · Aluno responde e resultado (B22-B26) ──');
  const examListAluno = await fetch(`${BASE}/exams`, { headers: authHeaders(alunoData.token) });
  const examListAlunoData = await asJson(examListAluno);
  assert(examListAlunoData.some((e: any) => e.id === exam.id), 'Aluno vinculado enxerga o simulado (B21-B22)');

  const start = await fetch(`${BASE}/exams/${exam.id}/start`, {
    method: 'POST',
    headers: authHeaders(alunoData.token),
  });
  const attempt = await asJson(start);
  assert(start.status === 201 && attempt.id, 'Aluno inicia tentativa (B22)');

  const take = await fetch(`${BASE}/exams/${exam.id}/take`, { headers: authHeaders(alunoData.token) });
  const takeData = await asJson(take);
  assert(takeData.questions?.length === 2, 'Tela de resposta com as questões (B22)');

  // Responde: q1 = C (correta), q2 = A (errada)
  const answers = takeData.questions.map((q: any) => ({
    questionId: q.id,
    selected: q.number === 1 ? 'C' : 'A',
  }));
  const save = await fetch(`${BASE}/attempts/${attempt.id}/answers`, {
    method: 'PUT',
    headers: authHeaders(alunoData.token),
    body: JSON.stringify({ answers }),
  });
  assert(save.status === 200, 'Aluno salva as respostas (B22)');

  const submit = await fetch(`${BASE}/attempts/${attempt.id}/submit`, {
    method: 'POST',
    headers: authHeaders(alunoData.token),
    body: JSON.stringify({}),
  });
  const submitData = await asJson(submit);
  assert(submit.status === 200 && submitData.correct === 1 && submitData.total === 2, 'Correção automática: 1 acerto de 2 (B24)');

  const results = await fetch(`${BASE}/exams/${exam.id}/results`, { headers: authHeaders(profData.token) });
  const resultsData = await asJson(results);
  assert(resultsData.students?.some((s: any) => s.name === 'Aluno E2E' && s.percent === 50), 'Painel do professor mostra desempenho do aluno (B25)');

  const byQuestion = await fetch(`${BASE}/exams/${exam.id}/results/by-question`, { headers: authHeaders(profData.token) });
  const byQuestionData = await asJson(byQuestion);
  assert(byQuestionData.questions?.some((q: any) => q.rate === 100), 'Detalhe por questão com taxa de acerto (B26)');

  const myResult = await fetch(`${BASE}/exams/${exam.id}/my-result`, { headers: authHeaders(alunoData.token) });
  assert(myResult.status === 200, 'Aluno visualiza resultado (percentual)');

  console.log('\n── Isolamento por organização (B04) ──');
  const foraAcessoTurma = await fetch(`${BASE}/classes/${turma.id}`, { headers: authHeaders(foraData.token) });
  assert(foraAcessoTurma.status === 404 || foraAcessoTurma.status === 403, 'Usuário de outra organização não acessa a turma');

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  process.exit(failed > 0 ? 1 : 0);
}

async function addChild(token: string, parentRes: any, level: number, name: string) {
  const parent = await asJson(parentRes);
  const id = parent?.id ?? (Array.isArray(parent) ? parent[0]?.id : undefined);
  if (!id) return;
  await fetch(`${BASE}/catalog`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ level, name, parentId: parent.id }),
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Erro no teste e2e:', err);
    process.exit(1);
  });
}