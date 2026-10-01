import { test, expect } from "@playwright/test";
import {
  adminClient,
  E2E_MAP_LOCATION,
  FAMILY_A_EMAIL,
  login,
  MAP_FAMILY_1_EMAIL,
  MAP_FAMILY_2_EMAIL,
  TEST_PASSWORD,
} from "./helpers";

const EMPTY_MAP_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#edf1f4" },
    },
  ],
};

test.beforeEach(async ({ page }) => {
  // Źródło rodzin pozostaje prawdziwym GeoJSON-em z aplikacji, ale bazowy styl
  // nie zależy w E2E od publicznej instancji OpenFreeMap ani tile'i OSM.
  await page.route("**/styles/positron", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(EMPTY_MAP_STYLE),
    });
  });
});

async function waitForMap(page: import("@playwright/test").Page) {
  const map = page.locator("[data-map-status]");
  await expect(map).toHaveAttribute("data-map-status", "ready");
  await expect(map).toHaveAttribute("data-markers-visible", "true");
  return map;
}

async function numericAttribute(
  locator: import("@playwright/test").Locator,
  name: string,
) {
  return Number((await locator.getAttribute(name)) ?? "0");
}

async function mapCamera(
  map: import("@playwright/test").Locator,
) {
  const center = (await map.getAttribute("data-map-center"))
    ?.split(",")
    .map(Number);
  expect(center).toHaveLength(2);
  return {
    center: center as [number, number],
    zoom: await numericAttribute(map, "data-map-zoom"),
    bearing: await numericAttribute(map, "data-map-bearing"),
    pitch: await numericAttribute(map, "data-map-pitch"),
  };
}

async function assertMapDimensions(
  map: import("@playwright/test").Locator,
  expectedHeight: number,
  viewport: "desktop" | "mobile",
) {
  const containerBox = await map.locator("[data-map-container]").boundingBox();
  const canvasBox = await map.locator(".maplibregl-canvas").boundingBox();
  expect(containerBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(containerBox!.width).toBeGreaterThan(300);
  expect(containerBox!.height).toBe(expectedHeight);
  expect(canvasBox!.width).toBe(containerBox!.width);
  expect(canvasBox!.height).toBe(containerBox!.height);
  console.log(
    `[map-e2e] ${viewport} container=${containerBox!.width}x${containerBox!.height} canvas=${canvasBox!.width}x${canvasBox!.height}`,
  );
}

test("gość na mapie widzi akcje auth i motyw zamiast menu konta", async ({
  page,
}) => {
  await page.goto("/mapa");

  await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zarejestruj się" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Otwórz menu konta/ })).toHaveCount(0);
});

test("rodzina nie widnieje na mapie, dopóki nie włączy widoczności", async ({
  page,
}) => {
  await page.goto("/mapa");
  await expect(page.getByText("Rodzina E2E A")).toHaveCount(0);
});

test("włączenie mapy publikuje rodzinę, wyłączenie ją chowa", async ({
  page,
}) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await page.goto("/profil");

  const switchEl = page.getByRole("switch", {
    name: "Widoczność na mapie rodzin",
  });

  // Włączenie wymaga potwierdzenia własnym, dostępnym dialogiem.
  await switchEl.click();
  const visibilityDialog = page.getByRole("dialog", {
    name: "Włączyć widoczność na mapie?",
  });
  await expect(visibilityDialog).toBeVisible();
  await expect(
    visibilityDialog.getByText(
      /nazwa profilu, miejscowość, województwo, kod pocztowy, liczbę i wiek dzieci/i,
    ),
  ).toBeVisible();
  await visibilityDialog.getByRole("button", { name: "Anuluj" }).click();
  await expect(visibilityDialog).toBeHidden();
  await expect(switchEl).toHaveAttribute("aria-checked", "false");

  // Ponowna próba włączenia znów wymaga świadomego potwierdzenia.
  await switchEl.click();
  await expect(visibilityDialog).toBeVisible();
  await visibilityDialog
    .getByRole("button", { name: "Włącz widoczność" })
    .click();
  await expect(
    page.getByText("Twoja rodzina jest teraz widoczna na mapie rodzin."),
  ).toBeVisible();

  await page.goto("/mapa");
  await expect(page.getByText("Rodzina E2E A")).toBeVisible();
  await expect(page.getByText("Telefon: 600100200")).toBeVisible();

  // Wyłączenie — bez dialogu.
  await page.goto("/profil");
  await switchEl.click();
  await expect(
    page.getByText("Twoja rodzina nie jest już widoczna na mapie."),
  ).toBeVisible();

  await page.goto("/mapa");
  await expect(page.getByText("Rodzina E2E A")).toHaveCount(0);
});

test("cold start kończy się gotową mapą i wyrenderowanym klastrem", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/mapa");
  const map = await waitForMap(page);

  await expect(map).toHaveAttribute("data-markers-visible", "true");
  await expect(map).toHaveAttribute("data-markers-visible-at", /\d/);
  const firstVisibleMarks = await page.evaluate(
    () => performance.getEntriesByName("ohana-map:first-markers-visible").length,
  );
  expect(firstVisibleMarks).toBeGreaterThanOrEqual(1);
  expect(await numericAttribute(map, "data-map-marker-count")).toBeGreaterThanOrEqual(2);
  await expect
    .poll(async () => {
      const fallbackImages = await numericAttribute(
        map,
        "data-map-fallback-images",
      );
      const avatarImages = await numericAttribute(map, "data-map-avatar-images");
      return fallbackImages + avatarImages;
    })
    .toBe(await numericAttribute(map, "data-map-marker-count"));
  await expect
    .poll(() => numericAttribute(map, "data-map-rendered-clusters"))
    .toBeGreaterThanOrEqual(1);
  await expect(map.locator(".maplibregl-canvas")).toBeVisible();
  await assertMapDimensions(map, 520, "desktop");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("klik klastra zwiększa zoom i rozbija go na rodziny", async ({ page }) => {
  await page.goto("/mapa");
  const map = await waitForMap(page);
  const canvas = map.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Warszawa leży ok. 100 px na wschód od startowego środka Polski przy z=5.5.
  await canvas.click({
    position: { x: box!.width / 2 + 100, y: box!.height / 2 - 10 },
  });

  await expect
    .poll(() => numericAttribute(map, "data-map-zoom"))
    .toBeGreaterThan(5.5);
  await expect
    .poll(() => numericAttribute(map, "data-map-rendered-points"))
    .toBeGreaterThanOrEqual(2);
});

test("karta centruje mapę, a marker aktywuje i przewija właściwą kartę", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mapa");
  const map = await waitForMap(page);
  const button = page.getByRole("button", {
    name: "Pokaż na mapie: Rodzina E2E Mapa 1",
  });
  const card = page
    .locator("li[data-family-id]")
    .filter({ hasText: "Rodzina E2E Mapa 1" });
  const familyId = await card.getAttribute("data-family-id");
  expect(familyId).toBeTruthy();

  await button.click();
  await expect(card).toHaveAttribute("data-active", "true");
  const activeButton = card.getByRole("button", {
    name: "Odznacz i pokaż całą Polskę: Rodzina E2E Mapa 1",
  });
  await expect(activeButton).toHaveAttribute("aria-pressed", "true");
  await expect(map).toHaveAttribute("data-map-selected-family", familyId!);
  await expect
    .poll(() => numericAttribute(map, "data-map-zoom"))
    .toBeGreaterThanOrEqual(14);
  await expect(page.getByText("Lokalizacja przybliżona", { exact: true })).toBeVisible();

  // Aktywna karta działa jak toggle i przy reduced motion resetuje kamerę
  // natychmiast, bez pozostawienia popupu ani zaznaczenia.
  await activeButton.click();
  await expect(card).toHaveAttribute("data-active", "false");
  await expect(map).toHaveAttribute("data-map-selected-family", "");
  await expect(page.locator(".ohana-map-popup")).toHaveCount(0);
  await expect
    .poll(async () => Math.abs((await numericAttribute(map, "data-map-zoom")) - 5.5))
    .toBeLessThan(0.05);

  await card
    .getByRole("button", { name: "Pokaż na mapie: Rodzina E2E Mapa 1" })
    .click();
  await expect
    .poll(() => numericAttribute(map, "data-map-zoom"))
    .toBeGreaterThanOrEqual(14);

  const canvas = map.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Najpierw klikamy puste miejsce. Marker testowanej rodziny nie może być już
  // aktywny, więc dalsza asercja zależy od prawdziwego callbacku markera.
  await canvas.click({ position: { x: 20, y: 20 } });
  await expect(map).toHaveAttribute("data-map-selected-family", "");
  await expect(card).toHaveAttribute("data-active", "false");

  await canvas.click({
    position: { x: box!.width / 2, y: box!.height / 2 },
  });

  await expect(map).toHaveAttribute("data-map-selected-family", familyId!);
  await expect(card).toBeInViewport();
  await expect(card).toHaveAttribute("data-active", "true");

  const cameraBeforeMarkerToggle = await mapCamera(map);

  // Ponowne kliknięcie aktywnej zwykłej pinezki odznacza rodzinę bez
  // poruszania kamerą. Reset do Polski pozostaje wyłącznie na aktywnej karcie.
  await canvas.click({
    position: { x: box!.width / 2, y: box!.height / 2 },
  });
  await expect(map).toHaveAttribute("data-map-selected-family", "");
  await expect(card).toHaveAttribute("data-active", "false");
  await expect(page.locator(".ohana-map-popup")).toHaveCount(0);
  const cameraAfterMarkerToggle = await mapCamera(map);
  expect(cameraAfterMarkerToggle.center[0]).toBeCloseTo(
    cameraBeforeMarkerToggle.center[0],
    7,
  );
  expect(cameraAfterMarkerToggle.center[1]).toBeCloseTo(
    cameraBeforeMarkerToggle.center[1],
    7,
  );
  expect(cameraAfterMarkerToggle.zoom).toBeCloseTo(
    cameraBeforeMarkerToggle.zoom,
    7,
  );
  expect(cameraAfterMarkerToggle.bearing).toBeCloseTo(
    cameraBeforeMarkerToggle.bearing,
    7,
  );
  expect(cameraAfterMarkerToggle.pitch).toBeCloseTo(
    cameraBeforeMarkerToggle.pitch,
    7,
  );
});

test("mobile zachowuje dwukierunkową nawigację mapa–lista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mapa");
  const map = await waitForMap(page);
  await assertMapDimensions(map, 420, "mobile");
  const button = page.getByRole("button", {
    name: "Pokaż na mapie: Rodzina E2E Mapa 2",
  });
  const card = page
    .locator("li[data-family-id]")
    .filter({ hasText: "Rodzina E2E Mapa 2" });

  await button.click();
  await expect(map).toBeInViewport();
  await expect(card).toHaveAttribute("data-active", "true");
  await expect
    .poll(() => numericAttribute(map, "data-map-zoom"))
    .toBeGreaterThanOrEqual(14);

  const canvas = map.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const familyId = await card.getAttribute("data-family-id");
  expect(familyId).toBeTruthy();

  await canvas.click({ position: { x: 20, y: 20 } });
  await expect(map).toHaveAttribute("data-map-selected-family", "");
  await expect(card).toHaveAttribute("data-active", "false");

  await canvas.click({
    position: { x: box!.width / 2, y: box!.height / 2 },
  });
  await expect(map).toHaveAttribute("data-map-selected-family", familyId!);
  await expect(card).toHaveAttribute("data-active", "true");
  await expect(card).toBeInViewport();
});

test("mapa bez geolokalizowanych rodzin nie zgłasza widocznych markerów", async ({
  page,
}) => {
  const admin = adminClient();
  const mapEmails = [MAP_FAMILY_1_EMAIL, MAP_FAMILY_2_EMAIL];
  const unavailableLocation = {
    city: "Ohana E2E bez geolokalizacji",
    postal_code: "99-903",
    voivodeship: "mazowieckie",
  };

  const { error: disableLocationError } = await admin
    .from("profiles")
    .update(unavailableLocation)
    .in("contact_email", mapEmails);
  expect(disableLocationError).toBeNull();

  try {
    await page.goto("/mapa");
    const map = page.locator("[data-map-status]");
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(map).toHaveAttribute("data-map-marker-count", "0");
    await expect(map).toHaveAttribute("data-markers-visible", "false");
    await expect(map).toHaveAttribute("data-markers-visible-at", "");
    const firstVisibleMarks = await page.evaluate(
      () =>
        performance.getEntriesByName("ohana-map:first-markers-visible").length,
    );
    expect(firstVisibleMarks).toBe(0);
  } finally {
    const { error: restoreLocationError } = await admin
      .from("profiles")
      .update({
        city: E2E_MAP_LOCATION.city,
        postal_code: E2E_MAP_LOCATION.postalCode,
        voivodeship: E2E_MAP_LOCATION.voivodeship,
      })
      .in("contact_email", mapEmails);
    expect(restoreLocationError).toBeNull();
  }
});
