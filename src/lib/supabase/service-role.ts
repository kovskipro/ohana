import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Uprzywilejowany klient serwerowy (omija RLS) — WYŁĄCZNIE po stronie serwera.
 *
 * Używa nowego server-only secretu `SUPABASE_SERVICE_ROLE_KEY` (format
 * `sb_secret_...` z dashboardu Supabase, sekcja API keys). Legacy JWT
 * `E2E_SUPABASE_SERVICE_ROLE_KEY` jest wyłącznie do testów E2E (e2e/) i NIGDY
 * nie trafia do runtime aplikacji — patrz AGENTS.md.
 *
 * Jest używany do zapisu wspólnego cache geokodowania (map_locations),
 * do którego anon/authenticated nie mają żadnego dostępu.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brak SUPABASE_SERVICE_ROLE_KEY — uprzywilejowany klient serwerowy nie jest skonfigurowany",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}