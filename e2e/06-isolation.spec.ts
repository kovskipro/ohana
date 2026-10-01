import { test, expect } from "@playwright/test";
import {
  adminClient,
  anonClient,
  FAMILY_A_EMAIL,
  FAMILY_B_EMAIL,
  getUserId,
  login,
  TEST_PASSWORD,
  YEAR_CURRENT,
} from "./helpers";

test("rodzina A nie ma dostępu do panelu administratora", async ({ page }) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await page.goto("/admin");
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Panel rodziny")).toBeVisible();
});

test("RLS: zwykły użytkownik nie zmieni statusu ani nie zobaczy danych rodziny B", async () => {
  const admin = adminClient();
  const aId = await getUserId(admin, FAMILY_A_EMAIL);
  const bId = await getUserId(admin, FAMILY_B_EMAIL);

  const { data: aEnroll } = await admin
    .from("enrollments")
    .select("id")
    .eq("profile_id", aId)
    .eq("school_year", YEAR_CURRENT)
    .single();
  expect(aEnroll).not.toBeNull();

  const { data: bEnroll } = await admin
    .from("enrollments")
    .select("id")
    .eq("profile_id", bId)
    .eq("school_year", YEAR_CURRENT)
    .single();
  expect(bEnroll).not.toBeNull();

  // Realna sesja użytkownika A (anon key + hasło), bez klucza service_role.
  const anon = anonClient();
  const { data: signIn, error: signInError } =
    await anon.auth.signInWithPassword({
      email: FAMILY_A_EMAIL,
      password: TEST_PASSWORD,
    });
  expect(signInError).toBeNull();
  expect(signIn?.session).toBeTruthy();

  const authed = anonClient();
  await authed.auth.setSession(signIn!.session!);

  // RPC admina odrzucane nawet dla własnego enrollmentu.
  const own = await authed.rpc("admin_set_enrollment_status", {
    target_enrollment: aEnroll!.id,
    new_status: "accepted",
  });
  expect(own.error).not.toBeNull();

  // RPC admina odrzucane dla cudzego enrollmentu.
  const foreign = await authed.rpc("admin_set_enrollment_status", {
    target_enrollment: bEnroll!.id,
    new_status: "accepted",
  });
  expect(foreign.error).not.toBeNull();

  // Brak widoczności danych rodziny B (RLS).
  const { data: bEnrollments } = await authed
    .from("enrollments")
    .select("id")
    .eq("profile_id", bId);
  expect(bEnrollments ?? []).toHaveLength(0);

  const { data: bChildren } = await authed
    .from("children")
    .select("id")
    .eq("profile_id", bId);
  expect(bChildren ?? []).toHaveLength(0);

  // Mapa — rodzina B nie jest publicznie widoczna.
  const { data: map } = await authed.from("family_map").select("profile_id");
  expect(map ?? []).not.toContainEqual(
    expect.objectContaining({ profile_id: bId }),
  );
});

test("panel rodziny A nie zawiera danych rodziny B", async ({ page }) => {
  await login(page, FAMILY_A_EMAIL, TEST_PASSWORD);
  await expect(page.getByText("Panel rodziny")).toBeVisible();
  await expect(page.getByText("Rodzina E2E B")).toHaveCount(0);
  await expect(page.getByText("Kraków")).toHaveCount(0);
});