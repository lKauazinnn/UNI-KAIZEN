-- Solicitações do aluno (aba "Solicitações gerais").
--
-- Cobre os dois fluxos que o aluno precisa iniciar sozinho:
--   'vinculo'   → pedir entrada numa turma (o professor aprova ou recusa);
--   'mensagem'  → falar com o professor sem depender de já estar na turma.
--
-- Migração aditiva: não altera nem remove nada existente.
CREATE TABLE IF NOT EXISTS "solicitacoes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turmaId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "response" TEXT,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- As FKs também são o que permite o PostgREST embutir turma e aluno na listagem.
ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_organizationId_fkey";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_userId_fkey";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_turmaId_fkey";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_turmaId_fkey"
    FOREIGN KEY ("turmaId") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_handledBy_fkey";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_handledBy_fkey"
    FOREIGN KEY ("handledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_type_check";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_type_check"
    CHECK ("type" IN ('vinculo', 'mensagem'));

ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_status_check";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_status_check"
    CHECK ("status" IN ('pendente', 'aprovada', 'recusada', 'respondida'));

-- Pedido de vínculo precisa dizer de qual turma; mensagem geral pode não ter turma.
ALTER TABLE "solicitacoes" DROP CONSTRAINT IF EXISTS "solicitacoes_vinculo_tem_turma";
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_vinculo_tem_turma"
    CHECK ("type" <> 'vinculo' OR "turmaId" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "solicitacoes_org_status_idx" ON "solicitacoes"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "solicitacoes_user_idx" ON "solicitacoes"("userId");

-- Um aluno não pode empilhar vários pedidos de vínculo abertos para a mesma turma.
CREATE UNIQUE INDEX IF NOT EXISTS "solicitacoes_vinculo_pendente_key"
    ON "solicitacoes"("turmaId", "userId")
    WHERE "type" = 'vinculo' AND "status" = 'pendente';
