const STORAGE_KEY = "ohana_pending_registration";

export interface PendingRegistration {
  profileName: string;
  numChildren: number;
  childrenAges: number[];
  interests: string[];
  contactPhone: string;
  contactPhoneCountry: string;
  contactEmail: string;
  contactFb: string;
  contactInstagram: string;
  city: string;
  postalCode: string;
  voivodeship: string;
  mapVisible: boolean;
}

export function stageRegistration(payload: PendingRegistration): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getStagedRegistration(): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingRegistration) : null;
  } catch {
    return null;
  }
}

export function clearStagedRegistration(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Wykonuje finalizację rejestracji po potwierdzeniu emaila:
 * complete_registration — profil + zgody (właściciel = auth.uid()).
 * Idempotentny: zgody upsertowane po wersji. Dzieci i zapisy (enrollments)
 * tworzone są później, w osobnym procesie /enroll.
 * Zwraca id profilu lub rzuca błąd.
 */
export async function completeRegistration(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>,
  payload: PendingRegistration,
): Promise<string> {
  const { data: reg, error: regError } = await supabase.rpc(
    "complete_registration",
    {
      payload: {
        profile_name: payload.profileName,
        num_children: payload.numChildren,
        children_ages: payload.childrenAges,
        interests: payload.interests,
        contact_phone: payload.contactPhone || null,
        contact_phone_country: payload.contactPhoneCountry,
        contact_email: payload.contactEmail || null,
        contact_fb: payload.contactFb || null,
        contact_instagram: payload.contactInstagram || null,
        city: payload.city,
        postal_code: payload.postalCode,
        voivodeship: payload.voivodeship,
        map_visible: payload.mapVisible,
        children: [],
        consents: {
          privacy_policy: { version: "1.0" },
          data_processing: { version: "1.0" },
        },
      },
    },
  );

  if (regError) throw regError;

  return reg as string;
}