# Kaizen Laboratórios Educacionais

Plataforma que transforma PDFs de questões em simulados online: **a IA prepara as questões, o professor confere e aprova, e o aluno responde com correção automática**.

## Fluxo principal

```
Importar PDF → IA extrai questões (B09-B13) → Fila de revisão (B14)
→ Professor edita/classifica/aprova (B15-B18) → Banco de questões (B18)
→ Criar simulado (B19) → Pré-visualizar (B20) → Publicar (B21)
→ Aluno responde online (B22-B23) → Correção automática (B24)
→ Professor acompanha resultados (B25-B26)
```

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js + Express + Prisma + Supabase (Postgres/PostgREST) |
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind CSS |
| IA (opcional) | Groq (classificação automática de questões) |

## Estrutura

```
kaizen/
├── backend/          API Express (porta 3333)
│   ├── prisma/       Schema do Prisma
│   ├── schema.sql    Tabelas (executar no SQL Editor do Supabase)
│   ├── seed.sql      Dados de demonstração
│   └── src/
│       ├── controllers/  Lógica de cada módulo
│       ├── routes/       Rotas da API
│       ├── lib/          Supabase, PDF, IA, auditoria
│       ├── middlewares/  Auth e papéis
│       └── tests/e2e.ts  Fluxo completo ponta a ponta
├── frontend/         SPA React (porta 5173)
└── *.bat             Scripts de execução (Windows)
```

## Denvolvimento rápido

1. Siga o passo a passo de **supabase/README.md** e crie o `.env` (backend e frontend).
2. Execute `INICIAR.bat` (sobe backend + frontend) ou, manualmente:
   - Backend: `npm run dev` em `backend/`
   - Frontend: `npm run dev` em `frontend/`
3. Acesse http://localhost:5173

> Documentação completa: [INSTALACAO.md](INSTALACAO.md) · [ARQUITETURA.md](ARQUITETURA.md) · [SUPABASE.md](SUPABASE.md)

## Contas de demonstração (seed)

| Papel | E-mail | Senha |
| --- | --- | --- |
| Professor | professor@kaizen.com | 123456 |
| Aluno | aluno1@kaizen.com | 123456 |
| Aluno | aluno2@kaizen.com | 123456 |
| Admin | admin@kaizen.com | 123456 |

## Teste ponta a end (B29)

Com o backend rodando e o banco configurado:

```bash
cd backend
npm run e2e
```

O teste cobre o fluxo completo (B02-B26) e o isolamento entre organizações (B04).

## Limitações do MVP (pós-piloto)

- **Extração de visuais (B11)**: imagens, gráficos, mapas e diagramas do PDF são preservados como recortes das páginas (`pdf.js` + `@napi-rs/canvas`), enviados ao bucket `question-visuals` do Supabase e exibidos ao professor e ao aluno. PDFs com fontes não embutidas podem gerar recorte sem texto — o professor revisa e corrige o gabarito/visual na tela de revisão.
- **Classificação por IA (B13)**: opcional via `GROQ_API_KEY`; sem a chave o professor classifica manualmente.
- **Senha temporária de alunos (CSV/link)**: definida na criação (formato `kaizen!xxxxxx`) e exibida no retorno da API — o envio por e-mail é melhoria futura.