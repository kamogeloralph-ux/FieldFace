import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __FIELDFACE_SUPABASE_URL__?: string;
    __FIELDFACE_SUPABASE_ANON_KEY__?: string;
  }
}

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || window.__FIELDFACE_SUPABASE_URL__;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || window.__FIELDFACE_SUPABASE_ANON_KEY__;

// Browser-only client using the public anon key. The public app can render
// without these values; only management and owner login require them.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const supabaseConfigured = Boolean(supabase);
