import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Browser-only client using the public anon key. Used exclusively for the
// admin sign-in form — every other read/write goes through our own tRPC API.
export const supabase = createClient(url, anonKey);
