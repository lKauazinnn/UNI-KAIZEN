# Instalação

## Pré-requisitos

- Node.js 18+ (testado com Node 24)
- Uma conta [Supabase](https://supabase.com) (plano grátis)
- (Opcional) Chave da API Groq para a classificação automática de questões

## 1. Criar o projeto no Supabase

1. No painel do Supabase, crie um novo projeto.
2. Anote de **Settings → API**: `Project URL`, `anon key` e `service_role key`.
3. Abra o **SQL Editor** e execute `backend/schema.sql`.
4. (Opcional, dados de demonstração) Execute `backend/seed.sql`.
   > O seed limpa as tabelas antes (`TRUNCATE ... CASCADE`) — use apenas em ambiente de dev.
5. Na tabela `import_jobs`, habilite RLS e crie uma política de leitura para usuários autenticados (o backend usa `service_role`, que ignora RLS). Para o frontend: `users`, `turmas`, `exams` e demais tabelas podem seguir o mesmo padrão dos projetos de referência (ADTAG-ACADEMY / cajupar-uni).

### Recuperação de senha (opcional)

No painel do Supabase → **Authentication → Providers → Email**, deixe habilitado e, em **URL Configuration**, defina `Site URL` como `http://localhost:5173` e o `Redirect URLs` para `http://localhost:5173/reset-password`. Sem isso, a recuperação de senha não envia e-mail.

## 2. Configurar o backend

```bash
cd backend
npm install
copy .env.example .env
```

Edite o `.env`:

| Variável | Obrigatório | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Não* | Conexão do Prisma (`db.<ref>.supabase.co:5432/postgres`) — usada por `prisma` generate/migrate |
| `SUPABASE_URL` | Sim | Project URL do Supabase |
| `SUPABASE_SERVICE_KEY` | Sim | `service_role` key (nunca exponha no frontend) |
| `SUPABASE_ANON_KEY` | Sim | `anon` key |
| `JWT_SECRET` | Sim | Segredo longo para o token da aplicação |
| `JWT_EXPIRES_IN` | Não | Padrão `7d` |
| `FRONTEND_URL` | Não | Padrão `http://localhost:5173` |
| `GROQ_API_KEY` | Não | Habilita classificação automática (B13) |
| `OWNER_EMAIL` | Não | Email tratado como admin/root |

\* Necessária apenas para comandos do Prisma (`prisma generate` já roda no `postinstall`).

Validação rápida:

```bash
npx prisma generate
npx tsc --noEmit
npm run dev        # API em http://localhost:3333
```

## 3. Configurar o frontend

```bash
cd frontend
npm install
copy .env.example .env
```

Edite o `.env`:

| Variável | Obrigatório | Descrição |
| --- | --- | --- |
| `VITE_API_URL` | Não | Vazio = usa `/api` (padrão dev via proxy) ou `/_/backend/api` (produção Vercel) |
| `VITE_SUPABASE_URL` | Não | Usado apenas para recuperação de senha/links do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Não | Idem |

```bash
npm run dev        # SPA em http://localhost:5173 (proxy /api → :3333)
npm run build      # produção (dist/)
```

## 4. Rodar o teste ponta a ponta (B29)

Com o backend rodando (`npm run dev`) e o banco configurado:

```bash
cd backend
npm run e2e
```

O teste usa o UUID **`e2e-`** no slug de organizações e telefones, criando dados isolados que não interferem no ambiente real.

## Deploy (Vercel)

O backend inclui `backend/vercel.json` apontando o runtime Node 20 e o caminho `/_/backend/api`. Na Vercel:

1. Defina as mesmas variáveis de ambiente do `backend/.env` no projeto.
2. Adicione `backend` como um segundo projeto/função (a API fica acessível em `/_/backend/api`).
3. No frontend (produção), o `baseURL` usa automaticamente `/_/backend/api`.