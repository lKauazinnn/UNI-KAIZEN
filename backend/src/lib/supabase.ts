import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Este módulo é carregado por todos os controllers, então uma variável faltando
// derruba o processo inteiro no boot. Numa Serverless Function isso aparece como
// um 500 sem explicação no cold start — daí a mensagem explícita.
const missingEnv = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseServiceKey && 'SUPABASE_SERVICE_KEY',
].filter(Boolean);

if (missingEnv.length > 0) {
  throw new Error(
    '[supabase] variáveis de ambiente obrigatórias ausentes: ' +
      missingEnv.join(', ') +
      '. Defina-as no .env local ou em Settings → Environment Variables do projeto na Vercel.'
  );
}

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? supabaseServiceKey;

if (!process.env.SUPABASE_ANON_KEY) {
  console.warn('[supabase] SUPABASE_ANON_KEY não definida — usando service key como fallback.');
}

const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const createUserScopedSupabaseClient = (accessToken: string) =>
  createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

export default supabase;