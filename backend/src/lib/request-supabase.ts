import { AuthRequest } from '../middlewares/auth.middleware';
import supabase, { createUserScopedSupabaseClient } from './supabase';

export const getRequestSupabaseClient = (req: AuthRequest) => {
  if (!req.accessToken) {
    console.warn('[request-supabase] accessToken ausente, usando service role client');
    return supabase;
  }
  return createUserScopedSupabaseClient(req.accessToken);
};