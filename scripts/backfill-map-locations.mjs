#!/usr/bin/env node
/**
 * backfill-map-locations.mjs
 *
 * Jednorazowy, single-threaded, idempotentny backfill geokodowania dla
 * rodzin z map_visible = true, których lokalizacji jeszcze nie ma w cache
 * `map_locations` (lub które są w stanie `failed` z przeterminowanym retry).
 *
 * Zgodność z OSMF Nominatim Usage Policy:
 *  * pojedynczy wątek, jedna maszyna;
 *  * throttle 1 req/s (wbudowany w geocoder);
 *  * pomija lokalizacje już obecne w cache — nie wysyła powtórnie zapytania;
 *  * własny User-Agent (OHANA_USER_AGENT / domyślny Ohana/1.0);
 *  * NIE jest uruchamiany cyklicznie (jednorazowy zadanie operacyjne).
 *
 * Wymagane env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (sb_secret_... — uprzywilejowany klient)
 *   [NOMINATIM_BASE_URL]        (opcjonalnie własna instancja)
 *   [OHANA_USER_AGENT]          (opcjonalnie)
 *
 * Użycie:
 *   node --env-file=.env.local scripts/backfill-map-locations.mjs [--dry-run]
 *
 * `--dry-run` tylko raportuje, co by zrobił, bez zapisu do DB i bez zapytań
 * do Nominatim.
 */
import { createClient } from "@supabase/supabase-js";
import { NominatimGeocoder, GeocoderRateLimitedError } from "../src/lib/maps/geocoder.ts";

const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) w env.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const geocoder = new NominatimGeocoder();

async function main() {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("postal_code, city, voivodeship")
    .eq("map_visible", true);

  if (error) {
    console.error("Błąd odczytu profili:", error.message);
    process.exit(1);
  }

  const unique = new Map();
  for (const p of profiles ?? []) {
    if (!p.postal_code || !p.city || !p.voivodeship) continue;
    const key = `${p.postal_code}|${p.city}|${p.voivodeship}`;
    if (!unique.has(key)) unique.set(key, p);
  }

  const locations = [...unique.values()];
  console.log(`Lokalizacji do rozpatrzenia (unikalnych): ${locations.length}`);

  if (dryRun) {
    console.log("Dry-run: nie pytam Nominatim i nie zapisuję do DB.");
    for (const l of locations) {
      console.log(`  - ${l.postal_code}, ${l.city}, ${l.voivodeship}`);
    }
    return;
  }

  let geocoded = 0;
  let fromCache = 0;
  let failed = 0;

  for (const loc of locations) {
    const { data: cached } = await admin
      .from("map_locations")
      .select("geo_status, retry_after")
      .eq("postal_code", loc.postal_code)
      .eq("city", loc.city)
      .eq("voivodeship", loc.voivodeship)
      .maybeSingle();

    if (cached) {
      const retryDue =
        cached.geo_status === "failed" &&
        (!cached.retry_after || new Date(cached.retry_after).getTime() <= Date.now());

      if (cached.geo_status !== "failed" || !retryDue) {
        fromCache += 1;
        console.log(
          `  = pomijam (cache ${cached.geo_status}): ${loc.postal_code}, ${loc.city}, ${loc.voivodeship}`,
        );
        continue;
      }
    }

    try {
      const result = await geocoder.geocode(loc);
      const retryAfter =
        result.status === "failed"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;

      await admin.from("map_locations").upsert(
        {
          postal_code: loc.postal_code,
          city: loc.city,
          voivodeship: loc.voivodeship,
          latitude: result.latitude,
          longitude: result.longitude,
          geo_status: result.status,
          retry_after: retryAfter,
        },
        { onConflict: "postal_code,city,voivodeship" },
      );

      if (result.status === "failed") {
        failed += 1;
        console.log(
          `  X failed: ${loc.postal_code}, ${loc.city}, ${loc.voivodeship} (retry za 24 h)`,
        );
      } else {
        geocoded += 1;
        console.log(
          `  + ${result.status}: ${loc.postal_code}, ${loc.city}, ${loc.voivodeship} → ${result.latitude}, ${result.longitude}`,
        );
      }
    } catch (err) {
      if (err instanceof GeocoderRateLimitedError) {
        console.error(
          `  ! Nominatim rate-limit przy ${loc.postal_code}, ${loc.city}, ${loc.voivodeship} — przerywam, wznów później (cache failed zachowany).`,
        );
        break;
      }
      console.error(
        `  ! błąd ${loc.postal_code}, ${loc.city}, ${loc.voivodeship}:`,
        err,
      );
    }
  }

  console.log(
    `\nGotowe. nowe: ${geocoded}, z cache: ${fromCache}, failed: ${failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});