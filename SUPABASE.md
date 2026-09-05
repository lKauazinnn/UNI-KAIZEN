# Supabase — configuração

> **Status atual (set/2026):** o projeto `plataforma-kaizen` (ref `nbkzzxlxiqgbynjrobit`,
> região `us-east-2`) já está configurado:
>
> - `backend/.env` preenchido com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
>   `SUPABASE_ANON_KEY`, `JWT_SECRET` e `DATABASE_URL` (pooler).
> - `schema.sql` + `seed.sql` **já aplicados** no banco (organização demo, 4 usuários,
>   turma e 1 questão — senha `123456`).
> - Confirmar em `backend/.env`: o valor de `DATABASE_URL` usa a senha fornecida
>   (string base64). Se o Prisma não conectar, troque pela senha real do dashboard.

## 1. Schema

Execute `backend/schema.sql` no **SQL Editor** do seu projeto Supabase (cria tabelas, índices):
`organizations`, `users`, `turmas`, `turma_members`, `catalog_items`, `import_jobs`,
`questions`, `exams`, `exam_questions`, `attempts`, `answers`, `notices`, `audit_logs`.

O schema também pode ser aplicado via Prisma:

```bash
cd backend
npx prisma db push
```

> O backend usa o Prisma apenas para tipagem/validação do schema (`prisma generate`).
> Em runtime, todas as operações usam o cliente JavaScript do Supabase.

## 2. Seed (opcional)

Execute `backend/seed.sql` no SQL Editor para dados de demonstração:

- Organização `kaizen-demo`
- Admin, professor e 2 alunos — **senha `123456`** para todos
- Catálogo de exemplo (disciplinas e tópicos)
- Turma com vínculo dos alunos
- Uma questão aprovada de demonstração

> O arquivo inicia com `TRUNCATE ... CASCADE`, então **limpa tudo** antes de inserir.
> Use apenas em ambiente de desenvolvimento.

## 3. Autenticação (recuperação de senha)

O `forgot-password`/`reset-password` usam o Supabase Auth:

1. **Authentication → Providers → Email**: mantenha "Enable Email signup" e Email confirmations.
2. **Authentication → URL Configuration**:
   - `Site URL`: `http://localhost:5173`
   - `Redirect URLs`: adicione `http://localhost:5173/reset-password`
3. Em desenvolvimento, o backend devolve também um link de recuperação de emergência
   (`debugResetUrl`) que aparece direto na resposta do `forgot-password`.

O token do link (`access_token`) garante ao backend identificar o usuário via
`supabase.auth.getUser(accessToken)` para atualizar a senha local (bcrypt) e no Auth.

## 4. RLS / políticas (recomendado)

O backend opera com `service_role` (ou cliente scoped via `SUPABASE_ANON_KEY`). Para
produção, recomenda-se habilitar RLS em todas as tabelas e conceder acesso apenas às
funções auxiliares usadas pelo frontend (ex.: `users` para exibir nome). Siga o mesmo
padrão dos projetos de referência (ADTAG-ACADEMY / cajupar-uni), onde o backend usa
`service_role` para as operações e políticas de leitura para usuários autenticados.

## 5. Chaves em `.env`

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.REF.supabase.co:5432/postgres"
SUPABASE_URL="https://REF.supabase.co"
SUPABASE_SERVICE_KEY="service_role"
SUPABASE_ANON_KEY="anon"
```

O backend usa `SUPABASE_SERVICE_KEY` como `service_role`; define `SUPABASE_ANON_KEY`
para ativar o modo "usuário scoped" (RLS com o token JWT do usuário).