import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface E2EEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  resendApiKey: string;
  allowRemoteSupabase: boolean;
}

/**
 * Minimalny parser `.env.local` (bez dotenv). Playwright nie ładuje plików
 * .env automatycznie, a proces buildowania Next.js nie jest dostępny w
 * global setup. Klucz service_role używany JEDYNIE w testach E2E po stronie
 * Node — nigdy w kodzie aplikacji ani w przeglądarce.
 */
export function loadEnv(): E2EEnv {
  const root = resolve(__dirname, "..");
  const raw = readFileSync(resolve(root, ".env.local"), "utf-8");
  const vars: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  const env: E2EEnv = {
    supabaseUrl: vars.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: vars.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: vars.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
    resendApiKey: vars.RESEND_API_KEY ?? "",
    allowRemoteSupabase:
      (process.env.E2E_ALLOW_REMOTE_SUPABASE ??
        vars.E2E_ALLOW_REMOTE_SUPABASE ??
        "") === "true",
  };

  if (!env.supabaseUrl || !env.anonKey || !env.serviceRoleKey) {
    throw new Error(
      "Brak wymaganych zmiennych w .env.local: NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return env;
}

export function assertE2EMutationsAllowed(env: E2EEnv): void {
  const hostname = new URL(env.supabaseUrl).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && !env.allowRemoteSupabase) {
    throw new Error(
      "Odmowa mutacji zdalnego Supabase. Ustaw jawnie " +
        "E2E_ALLOW_REMOTE_SUPABASE=true wyłącznie dla dedykowanego środowiska E2E.",
    );
  }
}
