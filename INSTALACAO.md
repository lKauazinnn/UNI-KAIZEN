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
| `GEMINI_API_KEY` | Não | Habilita classificação automática (B13) e a importação de questões por imagem. Tem prioridade sobre a Groq |
| `GROQ_API_KEY` | Não | Alternativa de IA, só para classificação de texto (B13) |
| `UPLOAD_MAX_MB` | Não | Padrão `4`. Teto do arquivo na importação (limite da Vercel) |
| `ALLOW_VERCEL_PREVIEW_ORIGINS` | Não | `true` libera CORS para qualquer `*.vercel.app` |
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
| `VITE_API_URL` | Em produção, **sim** | Vazio = usa `/api` (dev, via proxy do Vite). Em build de produção precisa da URL pública da API **+ `/api`** |
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

O passo a passo completo — criação dos dois projetos, tabela de variáveis,
verificação por curl, limitações da plataforma e troubleshooting — está em
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

Resumo:

- **Dois projetos** no mesmo repositório, separados por **Root Directory**:
  `backend` (API) e `frontend` (SPA).
- A API roda como Serverless Function: `backend/api/index.ts` exporta o app do
  Express e `backend/vercel.json` reescreve todas as rotas para ela. O
  `listen()` do `src/server.ts` é suprimido quando a variável `VERCEL` existe,
  então o mesmo arquivo continua servindo para rodar como processo normal.
- O frontend precisa de `VITE_API_URL` = URL pública da API **+ `/api`**, e a
  API precisa de `FRONTEND_URL` = URL pública do frontend (é o que libera o CORS).

> **Atenção — importação de PDF em produção.** O processamento é síncrono
> (renderiza as páginas e chama a IA questão a questão dentro do request), e a
> Vercel impõe dois tetos: **~4,5 MB** de corpo de requisição e **60 s** de
> execução no plano Hobby. Provas grandes não passam. Para o piloto, divida o
> PDF; para uso real, mova a API para um host de processo longo (Railway,
> Render, Fly) ou passe a importação para uma fila em background.
