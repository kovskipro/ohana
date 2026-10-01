import { test, expect } from "@playwright/test";
import {
  adminClient,
  FAMILY_A_EMAIL,
  getUserId,
  login,
  pickOption,
  TEST_PASSWORD,
  YEAR_CURRENT,
  YEAR_NEXT,
} from "./helpers";

const card = (page: import("@playwright/test").Page, text: string) =>
  page.locator("div.rounded-\\[14px\\]", { hasText: text });

test("nowy zapis prefills istniejące dziecko i obsługuje dodanie nowego (2 dzieci w zapisie)", async ({
  page,
}) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await page.goto("/enroll");

  // Prefill z poprzedniego zapisu (2026/2027 → rok 2027/2028).
  await expect(
    page.getByText("Formularz został wypełniony danymi z Twojego poprzedniego zapisu."),
  ).toBeVisible();
  await expect(page.getByLabel("Imię rodzica")).toHaveValue("Jan");
  await expect(page.getByLabel("Rok szkolny")).toContainText(YEAR_NEXT);

  // Karta 1 = istniejące dziecko Jan z prefillem klasy i adresu.
  const janCard = card(page, "Jan Kowalski");
  await expect(janCard).toBeVisible();
  await expect(janCard.getByText("nowe", { exact: true })).toHaveCount(0);
  await expect(
    janCard.getByText("PESEL 18101012345", { exact: false }),
  ).toBeVisible();
  await expect(
    janCard.getByRole("button", { name: "Klasa", exact: true }),
  ).toContainText("Klasa 1");
  await expect(janCard.getByLabel("Ulica")).toHaveValue("ul. Główna");
  await expect(janCard.getByLabel("Numer domu")).toHaveValue("10");

  // Dodanie nowego dziecka — nowa pusta karta (badge "nowe", brak Jan w niej).
  await page.getByRole("button", { name: "+ Dodaj kolejne dziecko" }).click();
  const majaCard = card(page, "Dziecko 2");
  await expect(majaCard).toBeVisible();
  await expect(majaCard.getByText("nowe", { exact: true })).toBeVisible();

  // Nowe dziecko tożsamość jest edytowalna.
  await majaCard.getByLabel("Imię").fill("Maja");
  await majaCard.getByLabel("Nazwisko").fill("Kowalski");
  await majaCard.getByLabel("Data urodzenia").fill("2016-05-05");
  await majaCard.getByLabel("Miejsce urodzenia").fill("Warszawa");
  await majaCard.getByLabel("PESEL").fill("16100512345");

  // Zgłoszenie Mai — klasa i adres.
  await pickOption(page, "Klasa", "Klasa 1", majaCard);
  await majaCard.getByLabel("Ulica").fill("ul. Ogrodowa");
  await majaCard.getByLabel("Numer domu").fill("2");
  await majaCard.getByLabel("Miejscowość").fill("Warszawa");
  await majaCard.getByLabel("Kod pocztowy").fill("00-001");
  await pickOption(page, "Województwo", "mazowieckie", majaCard);

  await page.getByRole("button", { name: "Wyślij zapis" }).click();

  // Na panelu: nowy rok szkolny zamiast duplikowania poprzedniego.
  await page.waitForURL("**/dashboard");
  await expect(page.getByText(`Rok szkolny ${YEAR_NEXT}`)).toBeVisible();
  await expect(page.getByText(`Rok szkolny ${YEAR_CURRENT}`)).toBeVisible();
  await expect(page.getByText("Oczekuje na decyzję").first()).toBeVisible();

  // Weryfikacja w DB: zapis na 2027/2028 ma co najmniej 2 dzieci.
  const admin = adminClient();
  const aId = await getUserId(admin, FAMILY_A_EMAIL);
  const { data, error } = await admin
    .from("enrollments")
    .select(
      "id, enrollment_children(first_name, last_name, school_class)",
    )
    .eq("profile_id", aId)
    .eq("school_year", YEAR_NEXT)
    .single();
  expect(error).toBeNull();
  expect(data?.enrollment_children ?? []).toHaveLength(2);

  const names = (data?.enrollment_children ?? [])
    .map((c) => `${c.first_name} ${c.last_name}`)
    .sort();
  expect(names).toEqual(["Jan Kowalski", "Maja Kowalski"]);
});