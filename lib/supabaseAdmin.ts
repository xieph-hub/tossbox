// lib/supabaseAdmin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

// Server-only Supabase client (bypasses RLS). DO NOT import in client components.
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      "X-Client-Info": "tossbox-supabaseAdmin",
    },
  },
});
