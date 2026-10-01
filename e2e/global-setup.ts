import { cleanupE2EData } from "./cleanup";
import { assertE2EMutationsAllowed, loadEnv } from "./env";
import {
  ADMIN_EMAIL,
  adminClient,
  E2E_FAMILY_A_LOCATION,
  E2E_MAP_LOCATION,
  FAMILY_A_EMAIL,
  FAMILY_B_EMAIL,
  MAP_FAMILY_1_EMAIL,
  MAP_FAMILY_2_EMAIL,
} from "./helpers";

export default async function globalSetup(): Promise<void> {
  const env = loadEnv();
  assertE2EMutationsAllowed(env);
  const admin = adminClient();
  await cleanupE2EData(admin);

  try {
    // 2. Utworzenie kont rodzin, seedów mapy i admina.
    const mk = async (email: string, makeAdmin: boolean) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: "Test1234!",
        email_confirm: true,
        app_metadata: makeAdmin ? { role: "admin" } : undefined,
      });
      if (error) throw error;
      return data.user.id;
    };

  const aId = await mk(FAMILY_A_EMAIL, false);
  const bId = await mk(FAMILY_B_EMAIL, false);
  const mapFamily1Id = await mk(MAP_FAMILY_1_EMAIL, false);
  const mapFamily2Id = await mk(MAP_FAMILY_2_EMAIL, false);
  await mk(ADMIN_EMAIL, true);

  await seedFamily(admin, {
    userId: aId,
    profile: {
      profile_name: "Rodzina E2E A",
      city: E2E_FAMILY_A_LOCATION.city,
      postal_code: E2E_FAMILY_A_LOCATION.postalCode,
      voivodeship: E2E_FAMILY_A_LOCATION.voivodeship,
      num_children: 1,
      children_ages: [5],
      interests: ["pływanie"],
      contact_phone: "600100200",
      contact_email: "e2e-family-a@test.pl",
    },
    child: {
      first_name: "Jan",
      last_name: "Kowalski",
      birth_date: "2018-01-10",
      birth_place: "Warszawa",
      pesel: "18101012345",
    },
    snapshot: {
      street: "ul. Główna",
      house_number: "10",
      city: "Warszawa",
      postal_code: "00-001",
      voivodeship: "mazowieckie",
      school_class: "Klasa 1",
    },
    parent: {
      parent_first_name: "Jan",
      parent_last_name: "Kowalski",
      parent_phone: "600100200",
      parent_email: "e2e-family-a@test.pl",
    },
  });

  // Dedykowane, publiczne rodziny mapy współdzielą cache lokalizacji. Seed
  // service_role eliminuje Nominatim i publiczną sieć z testów interakcji mapy.
  const { error: locationError } = await admin.from("map_locations").upsert(
    [E2E_MAP_LOCATION, E2E_FAMILY_A_LOCATION].map((location) => ({
      postal_code: location.postalCode,
      city: location.city,
      voivodeship: location.voivodeship,
      latitude: location.latitude,
      longitude: location.longitude,
      geo_status: "exact",
      retry_after: null,
    })),
  );
  if (locationError) throw locationError;

  for (const [id, name, email] of [
    [mapFamily1Id, "Rodzina E2E Mapa 1", MAP_FAMILY_1_EMAIL],
    [mapFamily2Id, "Rodzina E2E Mapa 2", MAP_FAMILY_2_EMAIL],
  ] as const) {
    const { error: mapProfileError } = await admin
      .from("profiles")
      .update({
        profile_name: name,
        city: E2E_MAP_LOCATION.city,
        postal_code: E2E_MAP_LOCATION.postalCode,
        voivodeship: E2E_MAP_LOCATION.voivodeship,
        contact_email: email,
        interests: ["test mapy"],
        map_visible: true,
      })
      .eq("id", id);
    if (mapProfileError) throw mapProfileError;
  }

  await seedFamily(admin, {
    userId: bId,
    profile: {
      profile_name: "Rodzina E2E B",
      city: "Kraków",
      postal_code: "30-001",
      voivodeship: "małopolskie",
      num_children: 1,
      children_ages: [6],
      interests: ["muzyka"],
      contact_phone: "600200300",
      contact_email: "e2e-family-b@test.pl",
    },
    child: {
      first_name: "Anna",
      last_name: "Nowak",
      birth_date: "2019-01-10",
      birth_place: "Kraków",
      pesel: "19101012345",
    },
    snapshot: {
      street: "ul. Króla",
      house_number: "4",
      city: "Kraków",
      postal_code: "30-001",
      voivodeship: "małopolskie",
      school_class: "Zerówka",
    },
    parent: {
      parent_first_name: "Jan",
      parent_last_name: "Nowak",
      parent_phone: "600200300",
      parent_email: "e2e-family-b@test.pl",
    },
  });

  // 3. Walidacja seedu.
  const aCheck = await admin
    .from("enrollments")
    .select("id")
    .eq("profile_id", aId)
    .eq("school_year", "2026/2027")
    .single();
  if (aCheck.error) throw aCheck.error;

    console.log(`[global-setup] Seeded A=${aId}, B=${bId}`);
  } catch (error) {
    await cleanupE2EData(admin);
    throw error;
  }
}

interface SeedFamilyInput {
  userId: string;
  profile: Record<string, unknown>;
  child: {
    first_name: string;
    last_name: string;
    birth_date: string;
    birth_place: string;
    pesel: string;
  };
  snapshot: {
    street: string;
    house_number: string;
    city: string;
    postal_code: string;
    voivodeship: string;
    school_class: string;
  };
  parent: {
    parent_first_name: string;
    parent_last_name: string;
    parent_phone: string;
    parent_email: string;
  };
}

async function seedFamily(
  admin: ReturnType<typeof adminClient>,
  input: SeedFamilyInput,
): Promise<void> {
  const { userId, profile, child, snapshot, parent } = input;

  // Trigger handle_new_user tworzy profil; wypełniamy go pełnymi danymi.
  const { error: profileError } = await admin
    .from("profiles")
    .update(profile)
    .eq("id", userId);
  if (profileError) throw profileError;

  const { data: childRow, error: childError } = await admin
    .from("children")
    .insert({
      profile_id: userId,
      first_name: child.first_name,
      last_name: child.last_name,
      birth_date: child.birth_date,
      birth_place: child.birth_place,
      pesel: child.pesel,
    })
    .select("id, first_name, last_name, birth_date, birth_place, pesel")
    .single();
  if (childError) throw childError;

  const { data: enrollment, error: enrollError } = await admin
    .from("enrollments")
    .insert({
      profile_id: userId,
      school_year: "2026/2027",
      status: "pending",
      parent_first_name: parent.parent_first_name,
      parent_last_name: parent.parent_last_name,
      parent_phone: parent.parent_phone,
      parent_phone_country: "+48",
      parent_email: parent.parent_email,
    })
    .select("id")
    .single();
  if (enrollError) throw enrollError;

  const { error: snapError } = await admin.from("enrollment_children").insert({
    enrollment_id: enrollment.id,
    child_id: childRow.id,
    first_name: childRow.first_name,
    last_name: childRow.last_name,
    birth_date: childRow.birth_date,
    birth_place: childRow.birth_place,
    pesel: childRow.pesel,
    street: snapshot.street,
    house_number: snapshot.house_number,
    city: snapshot.city,
    postal_code: snapshot.postal_code,
    voivodeship: snapshot.voivodeship,
    school_class: snapshot.school_class,
  });
  if (snapError) throw snapError;
}
