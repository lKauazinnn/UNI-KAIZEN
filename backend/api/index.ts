// Entrypoint da Vercel (Serverless Function).
//
// O `vercel.json` reescreve TODAS as rotas para cá. A Vercel entrega ao handler
// a URL original da requisição (ex.: `/api/auth/login`), então o Express faz o
// roteamento normalmente — sem precisar remontar prefixos.
//
// Importante: o app não chama `listen()` quando roda na Vercel (ver src/server.ts).
import app from '../src/server';

export default app;
