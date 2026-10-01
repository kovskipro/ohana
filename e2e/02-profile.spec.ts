import { test, expect } from "@playwright/test";
import { FAMILY_A_EMAIL, login, TEST_PASSWORD } from "./helpers";

test("rodzina A może edytować profil i zobaczyć zmiany na panelu", async ({
  page,
}) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);

  // Zmiana nazwy profilu.
  await page.goto("/profil");
  const nameField = page.getByLabel("Nazwa profilu (np. Kossakowscy)");
  await expect(nameField).toHaveValue("Rodzina E2E A");
  await nameField.fill("Rodzina E2E A zmieniona");
  await expect(nameField).toHaveValue("Rodzina E2E A zmieniona");
  await page.getByRole("button", { name: "Zapisz profil" }).click();
  await expect(page.getByText("Zapisano zmiany.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Rodzina E2E A zmieniona")).toBeVisible();

  // Przywrócenie oryginalnej nazwy, żeby nie psuć innych testów.
  await page.goto("/profil");
  await page
    .getByLabel("Nazwa profilu (np. Kossakowscy)")
    .fill("Rodzina E2E A");
  await page.getByRole("button", { name: "Zapisz profil" }).click();
  await expect(page.getByText("Zapisano zmiany.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Rodzina E2E A")).toBeVisible();
});