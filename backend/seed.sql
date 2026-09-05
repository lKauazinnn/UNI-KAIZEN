-- Kaizen Laboratórios Educacionais - Seed
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Cria uma organização de exemplo, admin, professor, alunos, catálogo e uma questão de demonstração.

-- Limpar dados existentes (cuidado - só para ambiente de dev)
TRUNCATE TABLE audit_logs, notices, answers, attempts, exam_questions, exams, questions, import_jobs,
  catalog_items, turma_members, turmas, users, organizations CASCADE;

-- ─── Organização ─────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Kaizen Demo', 'kaizen-demo', NOW(), NOW());

-- ─── Usuários (senha: 123456) ────────────────────────────────────────────
-- Hash bcrypt de "123456"
INSERT INTO users (id, email, name, password, role, "organizationId", "isActive", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000002', 'professor@kaizen.com', 'Professora Ana', '$2a$10$Ujg6XexhjQ.Vu8iTcybKoODy0AcQIYv2PLCFUppWhrgEmdHcSxXji', 'professor', '00000000-0000-0000-0000-000000000001', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'aluno1@kaizen.com', 'Aluno Bruno', '$2a$10$Ujg6XexhjQ.Vu8iTcybKoODy0AcQIYv2PLCFUppWhrgEmdHcSxXji', 'aluno', '00000000-0000-0000-0000-000000000001', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'aluno2@kaizen.com', 'Aluna Carla', '$2a$10$Ujg6XexhjQ.Vu8iTcybKoODy0AcQIYv2PLCFUppWhrgEmdHcSxXji', 'aluno', '00000000-0000-0000-0000-000000000001', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'admin@kaizen.com', 'Admin Kaizen', '$2a$10$Ujg6XexhjQ.Vu8iTcybKoODy0AcQIYv2PLCFUppWhrgEmdHcSxXji', 'admin', '00000000-0000-0000-0000-000000000001', true, NOW(), NOW());

-- ─── Turma ───────────────────────────────────────────────────────────────
INSERT INTO turmas (id, name, "organizationId", "professorId", archived, "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000010', 'Turma 1º Ano - Matemática', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', false, NOW(), NOW());

INSERT INTO turma_members (id, "turmaId", "userId", status, "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 'ativo', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', 'ativo', NOW(), NOW());

-- ─── Catálogo ────────────────────────────────────────────────────────────
INSERT INTO catalog_items (id, "organizationId", level, name, "parentId", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 1, 'Matemática', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 1, 'Física', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 2, 'Funções', '00000000-0000-0000-0000-000000000020', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 2, 'Trigonometria', '00000000-0000-0000-0000-000000000020', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 3, 'Função Afim', '00000000-0000-0000-0000-000000000022', NOW(), NOW());

-- ─── Importação de exemplo + questão aprovada ────────────────────────────
INSERT INTO import_jobs (id, "organizationId", "userId", "fileName", status, "totalQuestions", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'simulado-exemplo.pdf', 'completed', 1, NOW(), NOW());

INSERT INTO questions (id, "organizationId", "importJobId", "createdBy", number, statement, alternatives, images, gabarito, "gabaritoOrigin", "gabaritoConfidence", "catalogItemId", "classificationSource", status, "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000002', 1,
   'Dada a função afim f(x) = 2x + 3, qual é o valor de f(5)?',
   '[{"letter":"A","text":"8"},{"letter":"B","text":"10"},{"letter":"C","text":"13"},{"letter":"D","text":"15"}]'::jsonb,
   '[]'::jsonb,
   'C', 'document', 1.0, '00000000-0000-0000-0000-000000000024', 'professor', 'approved', NOW(), NOW());

-- ─── Verificação ─────────────────────────────────────────────────────────
SELECT 'Organizações' AS entidade, COUNT(*) AS total FROM organizations
UNION ALL SELECT 'Usuários', COUNT(*) FROM users
UNION ALL SELECT 'Turmas', COUNT(*) FROM turmas
UNION ALL SELECT 'Questões', COUNT(*) FROM questions;