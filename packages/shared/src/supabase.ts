import { createClient } from '@supabase/supabase-js';

export function criarSupabase(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
export type Supabase = ReturnType<typeof criarSupabase>;
