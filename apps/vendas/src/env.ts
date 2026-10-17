import { criarSupabase } from '@ac/shared';
export const sb = criarSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
