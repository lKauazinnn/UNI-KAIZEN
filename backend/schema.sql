-- Kaizen Laboratórios Educacionais - Schema
-- Execute este arquivo inteiro no SQL Editor do Supabase (ou use o Prisma migrate).

-- ─── Organizações (tenant) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");

-- ─── Usuários ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'aluno',
    "organizationId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- ─── Turmas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "turmas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- ─── Membros de turma ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "turma_members" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turma_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "turma_members_turmaId_userId_key" ON "turma_members"("turmaId", "userId");

-- ─── Catálogo (disciplina → conteúdo → tópico → subtópico) ────────────────
CREATE TABLE IF NOT EXISTS "catalog_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_items_organizationId_parentId_name_key" ON "catalog_items"("organizationId", "parentId", "name");

-- ─── Jobs de importação ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- ─── Questões ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importJobId" TEXT,
    "createdBy" TEXT NOT NULL,
    "number" INTEGER,
    "statement" TEXT NOT NULL,
    "alternatives" JSONB NOT NULL DEFAULT '[]',
    "images" JSONB NOT NULL DEFAULT '[]',
    "gabarito" TEXT,
    "gabaritoOrigin" TEXT,
    "gabaritoConfidence" DOUBLE PRECISION,
    "catalogItemId" TEXT,
    "classificationSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- ─── Simulados ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exam_questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_questions_examId_order_key" ON "exam_questions"("examId", "order");

-- ─── Tentativas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "attempts" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "attempts_examId_userId_key" ON "attempts"("examId", "userId");

-- ─── Respostas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selected" TEXT,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "answers_attemptId_questionId_key" ON "answers"("attemptId", "questionId");

-- ─── Avisos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notices" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- ─── Auditoria ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ─── Foreign keys ────────────────────────────────────────────────────────
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "turmas" ADD CONSTRAINT "turmas_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_professorId_fkey"
    FOREIGN KEY ("professorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "turma_members" ADD CONSTRAINT "turma_members_turmaId_fkey"
    FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "turma_members" ADD CONSTRAINT "turma_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "questions" ADD CONSTRAINT "questions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_importJobId_fkey"
    FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exams" ADD CONSTRAINT "exams_turmaId_fkey"
    FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attempts" ADD CONSTRAINT "attempts_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "answers" ADD CONSTRAINT "answers_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notices" ADD CONSTRAINT "notices_turmaId_fkey"
    FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notices" ADD CONSTRAINT "notices_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índices de consulta
CREATE INDEX IF NOT EXISTS "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX IF NOT EXISTS "turmas_professorId_idx" ON "turmas"("professorId");
CREATE INDEX IF NOT EXISTS "questions_organizationId_idx" ON "questions"("organizationId");
CREATE INDEX IF NOT EXISTS "questions_status_idx" ON "questions"("status");
CREATE INDEX IF NOT EXISTS "exams_turmaId_idx" ON "exams"("turmaId");
CREATE INDEX IF NOT EXISTS "attempts_examId_idx" ON "attempts"("examId");
CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security (B04 — isolamento por organização)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O backend opera com a chave `service_role`, que por definição IGNORA RLS.
-- Habilitar RLS aqui não substitui os filtros por organizationId na aplicação
-- — serve como rede de segurança para qualquer outro caminho de acesso:
-- a chave anon/publishable usada pelo frontend, o SQL Editor com papel
-- autenticado, integrações futuras e chaves vazadas de menor privilégio.
--
-- Sem nenhuma policy criada, habilitar RLS NEGA todo acesso a quem não é
-- service_role — que é exatamente o padrão seguro que queremos por ora.

ALTER TABLE "organizations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "turmas"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "turma_members"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attempts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notices"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"     ENABLE ROW LEVEL SECURITY;

-- Restrições de integridade da máquina de estados.
-- Antes existiam só em JavaScript: um UPDATE manual podia deixar a tentativa
-- num estado que a aplicação não sabe tratar.
ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_status_check";
ALTER TABLE "questions" ADD CONSTRAINT "questions_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected'));

ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_status_check";
ALTER TABLE "exams" ADD CONSTRAINT "exams_status_check"
    CHECK ("status" IN ('draft', 'published', 'archived'));

ALTER TABLE "attempts" DROP CONSTRAINT IF EXISTS "attempts_status_check";
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_status_check"
    CHECK ("status" IN ('in_progress', 'submitted'));

-- Tentativa entregue tem de ter data de entrega.
ALTER TABLE "attempts" DROP CONSTRAINT IF EXISTS "attempts_submitted_has_date";
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_submitted_has_date"
    CHECK ("status" <> 'submitted' OR "submittedAt" IS NOT NULL);

-- Origem do gabarito: 'heuristic' = deduzido pelo extrator, exige conferência.
ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_gabarito_origin_check";
ALTER TABLE "questions" ADD CONSTRAINT "questions_gabarito_origin_check"
    CHECK ("gabaritoOrigin" IS NULL OR "gabaritoOrigin" IN ('document', 'heuristic', 'ai', 'professor'));

ALTER TABLE "catalog_items" DROP CONSTRAINT IF EXISTS "catalog_items_level_check";
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_level_check"
    CHECK ("level" BETWEEN 1 AND 4);
