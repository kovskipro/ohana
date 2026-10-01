import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, FAMILY_A_EMAIL, FAMILY_B_EMAIL, login, TEST_PASSWORD } from "./helpers";

test("admin po zalogowaniu trafia do /admin", async ({ page }) => {
  await login(page, ADMIN_EMAIL, TEST_PASSWORD, "**/admin");
  await expect(page.getByText("Panel administratora")).toBeVisible();
});

test("admin widzi osobistą nawigację, listę rodzin i szczegóły zgłoszenia", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL, TEST_PASSWORD, "**/admin");

  await expect(page.getByRole("link", { name: "Zgłoszenia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rodziny" })).toBeVisible();
  await page
    .getByRole("button", { name: "Otwórz menu konta: Profil rodziny" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Menu konta" }).getByRole("link", { name: "Panel" }),
  ).toHaveAttribute("href", "/admin");
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Rodziny" }).click();
  await expect(page).toHaveURL(/\/admin\/families$/);
  await expect(page.getByText("Rodzina E2E A")).toBeVisible();
  await expect(page.getByText("Rodzina E2E B")).toBeVisible();

  await page.getByRole("link", { name: "Zgłoszenia" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Panel administratora" }),
  ).toBeVisible();
});

test("admin przyjmuje rodzinę A i odrzuca rodzinę B", async ({ page }) => {
  await login(page, ADMIN_EMAIL, TEST_PASSWORD, "**/admin");

  const cardA = page
    .locator("li", { hasText: "Rodzina E2E A" })
    .filter({ hasText: "Rok szkolny 2026/2027" });
  const cardB = page
    .locator("li", { hasText: "Rodzina E2E B" })
    .filter({ hasText: "Rok szkolny 2026/2027" });

  await expect(cardA.getByText("pending")).toBeVisible();
  await expect(cardB.getByText("pending")).toBeVisible();

  // Decyzje admina.
  await cardA.getByRole("button", { name: "Zaakceptuj" }).click();
  await expect(cardA.getByText("accepted")).toBeVisible();

  await cardB.getByRole("button", { name: "Odrzuć" }).click();
  await expect(cardB.getByText("rejected")).toBeVisible();

  // Szczegóły zgłoszenia rodziny A pokazują zaakceptowany status i dane dziecka.
  await cardA.getByRole("link", { name: "Szczegóły" }).click();
  await expect(page).toHaveURL(/\/admin\/enrollments\//);
  await expect(page.getByRole("listitem").getByText("Jan Kowalski")).toBeVisible();
  await expect(page.getByText("accepted")).toBeVisible();

  // Wylogowanie admina przez nawigację.
  await page
    .getByRole("button", { name: "Otwórz menu konta: Profil rodziny" })
    .click();
  await page
    .getByRole("dialog", { name: "Menu konta" })
    .getByRole("button", { name: "Wyloguj się" })
    .click();
  await page.waitForURL("**/");

  // Rodzina A widzi decyzję pozytywną.
  await page.context().clearCookies();
  await page.goto("/login");
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await expect(page.getByText("Zaakceptowany")).toBeVisible();

  // Rodzina B widzi decyzję negatywną.
  await page.context().clearCookies();
  await page.goto("/login");
  await login(page, FAMILY_B_EMAIL, TEST_PASSWORD);
  await expect(page.getByText("Odrzucony")).toBeVisible();
});
