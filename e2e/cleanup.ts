import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  ADMIN_EMAIL,
  E2E_FAMILY_A_LOCATION,
  E2E_MAP_LOCATION,
  FAMILY_A_EMAIL,
  FAMILY_B_EMAIL,
  MAP_FAMILY_1_EMAIL,
  MAP_FAMILY_2_EMAIL,
} from "./helpers";

const FIXED_E2E_EMAILS = new Set([
  FAMILY_A_EMAIL,
  FAMILY_B_EMAIL,
  ADMIN_EMAIL,
  MAP_FAMILY_1_EMAIL,
  MAP_FAMILY_2_EMAIL,
]);
const DYNAMIC_E2E_EMAIL = /^e2e-(?:reg|race)-\d+@test\.pl$/;

function isOwnedE2EUser(user: User): boolean {
  const email = user.email ?? "";
  return FIXED_E2E_EMAILS.has(email) || DYNAMIC_E2E_EMAIL.test(email);
}

async function listOwnedE2EUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  let page = 1;

  // Najpierw zbieramy pełną, stabilną listę. Nie usuwamy podczas paginacji,
  // bo przesuwanie stron mogłoby pominąć konta.
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    users.push(...data.users.filter(isOwnedE2EUser));
    if (data.users.length < 200) return users;
    page += 1;
  }
}

export async function cleanupE2EData(admin: SupabaseClient): Promise<void> {
  const users = await listOwnedE2EUsers(admin);

  for (const user of users) {
    // Natychmiast zdejmujemy publiczną widoczność przed usunięciem konta.
    const { error: profileError } = await admin
      .from("profiles")
      .update({ map_visible: false })
      .eq("id", user.id);
    if (profileError) throw profileError;

    const { error: enrollmentError } = await admin
      .from("enrollments")
      .update({ decided_by: null })
      .eq("decided_by", user.id);
    if (enrollmentError) throw enrollmentError;

    const { error: deleteUserError } =
      await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;
  }

  for (const location of [E2E_MAP_LOCATION, E2E_FAMILY_A_LOCATION]) {
    const { error } = await admin
      .from("map_locations")
      .delete()
      .eq("postal_code", location.postalCode)
      .eq("city", location.city)
      .eq("voivodeship", location.voivodeship);
    if (error) throw error;
  }
}
