import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page, Locator } from "@playwright/test";
import { loadEnv } from "./env";

export const FAMILY_A_EMAIL = "e2e-family-a@test.pl";
export const FAMILY_B_EMAIL = "e2e-family-b@test.pl";
export const ADMIN_EMAIL = "e2e-admin@test.pl";
export const MAP_FAMILY_1_EMAIL = "e2e-map-family-1@test.pl";
export const MAP_FAMILY_2_EMAIL = "e2e-map-family-2@test.pl";
export const TEST_PASSWORD = "Test1234!";

export const E2E_MAP_LOCATION = {
  postalCode: "99-901",
  city: "Ohana E2E Warszawa Mapa",
  voivodeship: "mazowieckie",
  latitude: 52.2297,
  longitude: 21.0122,
} as const;

export const E2E_FAMILY_A_LOCATION = {
  postalCode: "99-902",
  city: "Ohana E2E Warszawa A",
  voivodeship: "mazowieckie",
  latitude: 52.2297,
  longitude: 21.0122,
} as const;

export const YEAR_CURRENT = "2026/2027";
export const YEAR_NEXT = "2027/2028";

// Serwerowy klient z kluczem service_role — WYŁĄCZNIE w testach E2E po
// stronie Node (global setup / asercje). Nigdy w przeglądarce.
export function adminClient(): SupabaseClient {
  const env = loadEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Klient anonimowy — używany do logowania realnego użytkownika po stronie
// Node, żeby wywołać RPC z jego sesją (testy izolacji RLS).
export function anonClient(): SupabaseClient {
  const env = loadEnv();
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getUserId(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  throw new Error(`Test user not found: ${email}`);
}

export async function login(
  page: Page,
  email: string,
  password: string,
  expectedUrl = "**/dashboard",
): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Hasło").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.waitForURL(expectedUrl);
}

/**
 * Wybiera opcję w Select (label + trigger button + listbox).
 * `scope` pozwala ograniczyć do sekcji (np. dziecko w formularzu).
 */
export async function pickOption(
  page: Page,
  listboxLabel: string,
  optionLabel: string,
  scope?: Locator,
): Promise<void> {
  const root = scope ?? page.locator("body");
  await root.getByLabel(listboxLabel).click();
  await root
    .locator(`ul[aria-label="${listboxLabel}"]`)
    .getByRole("option", { name: optionLabel, exact: true })
    .click();
}

/**
 * Pobiera realny kod OTP (6 cyfr) z treści maila wysłanego przez GoTrue
 * do `to` przez Resend. Ankietuje Resend API, bo email przychodzi
 * asynchronicznie (zazwyczaj <1 s po signUp). Kod OTP jest WYŁĄCZNIE
 * w treści wiadomości ({{ .Token }} z template'u) — nie ma go w bazie.
 */
export async function getOtpCode(env: { resendApiKey: string }, to: string): Promise<string> {
  if (!env.resendApiKey) {
    throw new Error("Brak RESEND_API_KEY w .env.local — wymagany do pobrania kodu OTP");
  }

  const deadline = Date.now() + 20_000;
  let lastError = "";
  while (Date.now() < deadline) {
    const list = await fetch("https://api.resend.com/emails?limit=20", {
      headers: { Authorization: `Bearer ${env.resendApiKey}` },
    });
    if (!list.ok) {
      lastError = `Resend list: ${list.status}`;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const { data } = (await list.json()) as {
      data: Array<{ id: string; to: string[] }>;
    };
    const mail = data.find((m) => m.to.includes(to));
    if (!mail) {
      lastError = `Brak maila do ${to}`;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    const detail = await fetch(`https://api.resend.com/emails/${mail.id}`, {
      headers: { Authorization: `Bearer ${env.resendApiKey}` },
    });
    if (!detail.ok) {
      lastError = `Resend get ${mail.id}: ${detail.status}`;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const email = (await detail.json()) as { html: string };
    const code = email.html?.match(/\b(\d{6})\b/);
    if (code) return code[1];
    lastError = `Brak 6-cyfrowego kodu w treści maila do ${to}`;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout pobierania kodu OTP (${lastError})`);
}
