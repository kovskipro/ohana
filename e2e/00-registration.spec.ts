import { test, expect } from "@playwright/test";
import { adminClient, pickOption, getOtpCode } from "./helpers";
import { loadEnv } from "./env";

// Tymczasowo zablokowany test pełnej rejestracji: wymaga wysyłki maila
// potwierdzającego przez GoTrue, a projekt nie ma skonfigurowanego Custom
// SMTP. Supabase odrzuca signUp kodem 429 "email rate limit exceeded"
// (auth rate_limit_email_sent — bucket projektowy). Po skonfigurowaniu
// Resend jako SMTP i podniesieniu limitu zmień REGISTRATION_SMTP_READY na
// true — test wróci do zestawu bez żadnych zmian w logice.
const REGISTRATION_SMTP_READY = true;

// Rejestracja tworzy tylko konto + profil (dane profilu/mapy) + zgody.
// Zapis dziecka na rok szkolny to osobny proces — /enroll.
test("nowa rodzina rejestruje się, potwierdza email kodem OTP i finalizuje profil", async ({
  page,
}) => {
  test.skip(
    !REGISTRATION_SMTP_READY,
    "Zablokowany tymczasowo: brak Custom SMTP (Resend) — Supabase rate limit 'email rate limit exceeded'",
  );
  const env = loadEnv();
  const email = `e2e-reg-${Date.now()}@test.pl`;
  const password = "Test1234!";

  await page.goto("/register");

  // --- Krok 1: dane rodziny (profil) ---
  await page.getByLabel("Nazwa profilu (np. Kossakowscy)").fill("Rodzina E2E Reg");
  await page
    .getByPlaceholder(/Enter aby dodać/)
    .fill("wędrówki górskie");
  await page.getByPlaceholder(/Enter aby dodać/).press("Enter");

  await page.getByPlaceholder("123456789").fill("600100200");
  await page.getByLabel("Miejscowość").fill("Warszawa");
  await page.getByLabel("Kod pocztowy").fill("00-001");
  await pickOption(page, "Województwo", "mazowieckie");

  await page.getByRole("button", { name: "Dalej" }).click();

  // --- Krok 2: konto i zgody ---
  const form = page.locator("form");
  const loginSection = form.locator("section").nth(0);
  const consentSection = form.locator("section").nth(1);

  await loginSection.getByLabel("Email", { exact: true }).fill(email);
  await loginSection.getByLabel("Hasło", { exact: true }).fill(password);
  await loginSection
    .getByLabel("Powtórz hasło", { exact: true })
    .fill(password);

  await consentSection.locator('input[type="checkbox"]').nth(0).check();
  await consentSection.locator('input[type="checkbox"]').nth(1).check();

  await page.getByRole("button", { name: "Zarejestruj się" }).click();

  // --- Krok 3: potwierdzenie emaila realnym kodem OTP ---
  await expect(page.getByText("Potwierdź email")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Kod jest tylko w treści maila wysłanego przez GoTrue → pobieramy go
  // z Resend API (test przechodzi przez realny flow, nie admin-confirm).
  const code = await getOtpCode(env, email);

  // Nowy OTP input: 6 osobnych boxów ([][][]-[][][]) — każda cyfra
  // do osobnego pola. Wpisywanie cyfry przeskakuje do następnego boxa,
  // wklejenie pełnego kodu rozdziela cyfry automatycznie.
  for (let i = 0; i < code.length; i += 1) {
    await page.getByLabel(`Kod potwierdzający, znak ${i + 1} z 6`).fill(code[i]);
  }
  await page.getByRole("button", { name: "Potwierdź kod" }).click();

  // verifyOtp zwraca sesję — użytkownik od razu trafia na dashboard
  // bez dodatkowego logowania. Profile complet_registration finalizowany
  // tuż po weryfikacji.
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Panel rodziny")).toBeVisible();
  await expect(page.getByText("Rodzina E2E Reg")).toBeVisible();
  await expect(page.getByText("Warszawa")).toBeVisible();

  // Profil utworzony, ale bez zapisu — /enroll to osobny proces.
  await expect(page.getByText(/Brak zapisów/)).toBeVisible();

  // Sesja jest aktywna (nie ma przekierowania na /login) — po weryfikacji
  // OTP użytkownik jest zalogowany.
  await expect(page).not.toHaveURL("**/login");

  // Staging został zużyty — nie ma go już w localStorage.
  const staged = await page.evaluate(() =>
    localStorage.getItem("ohana_pending_registration"),
  );
  expect(staged).toBeNull();

  // Profil faktycznie zapisany w bazie dla zalogowanego użytkownika.
  const admin = adminClient();
  const userId = await (async (targetEmail: string) => {
    let p = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page: p,
        perPage: 200,
      });
      if (error) throw error;
      const found = data.users.find((u) => u.email === targetEmail);
      if (found) return found.id;
      if (data.users.length < 200) break;
      p += 1;
    }
    return null;
  })(email);
  expect(userId).not.toBeNull();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("profile_name")
    .eq("id", userId)
    .maybeSingle();
  expect(profileError).toBeNull();
  expect(profile?.profile_name).toBe("Rodzina E2E Reg");
});

// Regresja: race condition na podwójny submit rejestracji. Przed fixem dwa
// równoległe signUp dla tego samego emaila kończyły się 500 "Database error
// saving new user" (GoTrue maskuje unique violation), a UI pokazywało naraz
// sukces i błąd. Test odpala dwa SYNCHRONICZNE zdarzenia submit (najgorszy
// przypadek — drugie wpada przed re-renderem z disabled) i wymaga, by do
// /auth/v1/signup trafił DOKŁADNIE jeden request.
test("podwójny submit rejestracji odpala dokładnie jeden signUp i nie pokazuje błędu", async ({
  page,
}) => {
  test.skip(
    !REGISTRATION_SMTP_READY,
    "Zablokowany tymczasowo: brak Custom SMTP (Resend) — Supabase rate limit 'email rate limit exceeded'",
  );
  const email = `e2e-race-${Date.now()}@test.pl`;
  const password = "Test1234!";

  let signupRequests = 0;
  page.on("request", (req) => {
    if (req.url().includes("/auth/v1/signup")) signupRequests += 1;
  });

  await page.goto("/register");

  // --- Krok 1: dane rodziny (profil) ---
  await page.getByLabel("Nazwa profilu (np. Kossakowscy)").fill("Rodzina E2E Race");
  await page.getByPlaceholder(/Enter aby dodać/).fill("wędrówki górskie");
  await page.getByPlaceholder(/Enter aby dodać/).press("Enter");
  await page.getByPlaceholder("123456789").fill("600100200");
  await page.getByLabel("Miejscowość").fill("Warszawa");
  await page.getByLabel("Kod pocztowy").fill("00-001");
  await pickOption(page, "Województwo", "mazowieckie");
  await page.getByRole("button", { name: "Dalej" }).click();

  // --- Krok 2: konto i zgody ---
  const form = page.locator("form");
  const loginSection = form.locator("section").nth(0);
  const consentSection = form.locator("section").nth(1);

  await loginSection.getByLabel("Email", { exact: true }).fill(email);
  await loginSection.getByLabel("Hasło", { exact: true }).fill(password);
  await loginSection.getByLabel("Powtórz hasło", { exact: true }).fill(password);
  await consentSection.locator('input[type="checkbox"]').nth(0).check();
  await consentSection.locator('input[type="checkbox"]').nth(1).check();

  // Dwa submit events w tej samej mikrotasku — drugi wpada ZANIM React
  // zdąży ustawić disabled/ref. Bez atomowego guarda oba doszłyby do signUp.
  await form.evaluate((f) => {
    const opts = { bubbles: true, cancelable: true };
    f.dispatchEvent(new Event("submit", opts));
    f.dispatchEvent(new Event("submit", opts));
  });

  // Przycisk blokuje się w trakcie requestu (guard zrefa ustawiony sync).
  const submitBtn = page.getByRole("button", { name: "Rejestrowanie..." });
  await expect(submitBtn).toBeVisible();
  await expect(submitBtn).toBeDisabled();

  // Trzeci submit w trakcie requestu też musi być ignorowany.
  await form.evaluate((f) => {
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  await expect(page.getByText("Potwierdź email")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Dokładnie jeden signUp dotarł do GoTrue.
  expect(signupRequests).toBe(1);

  // UI nie może pokazywać błędu — koniec stanu to wyłącznie weryfikacja.
  await expect(page.getByText(/Database error/)).not.toBeVisible();

  // W auth.users powstał dokładnie jeden użytkownik dla tego emaila.
  const admin = adminClient();
  const created = await (async (targetEmail: string) => {
    let p = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
      if (error) throw error;
      const found = data.users.find((u) => u.email === targetEmail);
      if (found) return found;
      if (data.users.length < 200) break;
      p += 1;
    }
    return null;
  })(email);
  expect(created).not.toBeNull();
  expect(created!.email).toBe(email);
});
