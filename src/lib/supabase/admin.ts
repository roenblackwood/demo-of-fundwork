import "server-only";

import { createClient } from "@supabase/supabase-js";

/** Service role. Used only after a chain or signature check. Never sent to the browser. */
export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
