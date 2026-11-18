import { createClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = () => Boolean(url() && pub());
export const serverConfigured = () => Boolean(url() && process.env.SUPABASE_SECRET_KEY);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Read-only public client (publishable key). Row level security decides what it can see. */
export function anonClient() {
  return createClient(url(), pub(), opts);
}

/** Server-only client with the secret key. Bypasses row level security: never import this from a client component. */
export function adminClient() {
  if (!serverConfigured()) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url(), process.env.SUPABASE_SECRET_KEY, opts);
}
