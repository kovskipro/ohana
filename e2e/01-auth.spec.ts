import { test, expect } from "@playwright/test";
import { FAMILY_A_EMAIL, login, TEST_PASSWORD } from "./helpers";

test("gość widzi wspólną nawigację bez menu konta", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zarejestruj się" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Otwórz menu konta/ })).toHaveCount(0);
});

test("niezalogowany użytkownik jest przekierowany z /dashboard na /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.waitForURL((url) => url.pathname === "/login");
  await expect(
    page.getByRole("heading", { name: "Zaloguj się" }),
  ).toBeVisible();
});

test("logowanie z błędnym hasłem pokazuje błąd", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(FAMILY_A_EMAIL);
  await page.getByPlaceholder("Hasło").fill("zle-haslo");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(
    page.getByText("Nieprawidłowy email lub hasło."),
  ).toBeVisible();
});

test("błędny kod PKCE przekierowuje na /login z komunikatem", async ({
  page,
}) => {
  await page.goto("/dashboard?code=invalid-code");
  await page.waitForURL((url) => url.pathname === "/login");
  await expect(
    page.getByText("Potwierdzenie nie powiodło się. Spróbuj ponownie."),
  ).toBeVisible();
});

test("logowanie rodziny A prowadzi do panelu rodziny", async ({ page }) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await expect(page.getByText("Panel rodziny")).toBeVisible();
  await expect(page.getByText("Rodzina E2E A")).toBeVisible();

  await expect(page.getByRole("link", { name: "Zaloguj się" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Zarejestruj się" })).toHaveCount(0);

  await page
    .getByRole("button", { name: "Otwórz menu konta: Rodzina E2E A" })
    .click();
  const menu = page.getByRole("dialog", { name: "Menu konta" });
  await expect(menu.getByText("Rodzina E2E A", { exact: true })).toBeVisible();
  await expect(menu.getByText(FAMILY_A_EMAIL, { exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Profil" })).toHaveAttribute(
    "href",
    "/profil",
  );
  await expect(menu.getByRole("link", { name: "Panel" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await expect(menu.getByText("Motyw", { exact: true })).toBeVisible();
});

test("wylogowanie wraca na stronę główną i przełącza navbar na gościa", async ({
  page,
}) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await page
    .getByRole("button", { name: "Otwórz menu konta: Rodzina E2E A" })
    .click();
  await page
    .getByRole("dialog", { name: "Menu konta" })
    .getByRole("button", { name: "Wyloguj się" })
    .click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zarejestruj się" })).toBeVisible();
});

test("navbar nie powoduje poziomego overflow na ekranie 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");

  const header = page.locator("[data-site-header]");
  await expect(header).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  expect((await header.boundingBox())?.height).toBe(104);
});
