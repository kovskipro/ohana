import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  GeocoderRateLimitedError,
  getGeocoder,
} from "@/lib/maps/geocoder";

export const runtime = "nodejs";

/** Cooldown per user (pamięć procesu) — osłona przed spamem API. */
const USER_COOLDOWN_MS = 60_000;
const userCooldowns = new Map<string, number>();

/** Po jakim czasie ponawiamy nieudane geokodowanie (backfill skacze do tego). */
const RETRY_FAILED_MS = 24 * 60 * 60 * 1000;
const RETRY_RATE_LIMITED_MS = 60 * 60 * 1000;

interface CacheEntry {
  latitude: number | null;
  longitude: number | null;
  geo_status: string;
  retry_after: string | null;
}

/**
 * POST /api/map-locations
 *
 * Geokodowanie lokalizacji WŁASNEGO profilu (user-triggered — zapis profilu /
 * włączenie map_visible). Nigdy przy renderowaniu /mapa.
 *
 * 1. Cache-hit w map_locations (exact/approximate) → zwraca bez zapytania.
 * 2. Cache failed z retry_after w przyszłości → zwraca failed bez zapytania.
 * 3. Miss / retry przeterminowany → Nominatim (1 req/s) → upsert przez service_role.
 *
 * Klient nigdy nie przekazuje lat/lng — wspólny cache nie może być zatruty.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("postal_code, city, voivodeship")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  const location = {
    postal_code: profile.postal_code,
    city: profile.city,
    voivodeship: profile.voivodeship,
  };

  if (!location.postal_code || !location.city || !location.voivodeship) {
    return NextResponse.json({ error: "INCOMPLETE_LOCATION" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: cached } = await admin
    .from("map_locations")
    .select("latitude, longitude, geo_status, retry_after")
    .eq("postal_code", location.postal_code)
    .eq("city", location.city)
    .eq("voivodeship", location.voivodeship)
    .maybeSingle<CacheEntry>();

  if (cached) {
    // Lokalizacja już w cache — nie wysyłamy ponownie zapytania do Nominatim.
    if (cached.geo_status === "exact" || cached.geo_status === "approximate") {
      return NextResponse.json({
        latitude: cached.latitude,
        longitude: cached.longitude,
        status: cached.geo_status,
        cached: true,
      });
    }

    // failed z nieprzeterminowanym retry — jeszcze nie pora ponowić.
    if (
      cached.geo_status === "failed" &&
      cached.retry_after &&
      new Date(cached.retry_after).getTime() > Date.now()
    ) {
      return NextResponse.json({
        latitude: null,
        longitude: null,
        status: "failed",
        cached: true,
      });
    }
  }

  // Cooldown per user — kolejne próby w obrębie 60 s zwracają poprzedni stan.
  const lastAttempt = userCooldowns.get(user.id) ?? 0;
  if (Date.now() - lastAttempt < USER_COOLDOWN_MS) {
    return NextResponse.json({
      latitude: cached?.latitude ?? null,
      longitude: cached?.longitude ?? null,
      status: cached?.geo_status ?? "pending",
      throttled: true,
    });
  }

  const geocoder = getGeocoder();
  let result;
  try {
    result = await geocoder.geocode(location);
  } catch (error) {
    if (error instanceof GeocoderRateLimitedError) {
      userCooldowns.set(user.id, Date.now());
      await upsertCache(admin, location, "failed", null, null, new Date(Date.now() + RETRY_RATE_LIMITED_MS));
      return NextResponse.json({
        latitude: null,
        longitude: null,
        status: "failed",
        rate_limited: true,
      });
    }
    throw error;
  }

  userCooldowns.set(user.id, Date.now());

  const retryAfter =
    result.status === "failed"
      ? new Date(Date.now() + RETRY_FAILED_MS)
      : null;

  await upsertCache(
    admin,
    location,
    result.status,
    result.latitude,
    result.longitude,
    retryAfter,
  );

  return NextResponse.json({
    latitude: result.latitude,
    longitude: result.longitude,
    status: result.status,
  });
}

async function upsertCache(
  admin: ReturnType<typeof createServiceRoleClient>,
  location: { postal_code: string; city: string; voivodeship: string },
  status: "exact" | "approximate" | "failed",
  latitude: number | null,
  longitude: number | null,
  retry_after: Date | null,
) {
  await admin.from("map_locations").upsert(
    {
      postal_code: location.postal_code,
      city: location.city,
      voivodeship: location.voivodeship,
      latitude,
      longitude,
      geo_status: status,
      retry_after: retry_after?.toISOString() ?? null,
    },
    { onConflict: "postal_code,city,voivodeship" },
  );
}