// Adapter/interfejs geokodera.
//
// Provider (Nominatim → MapTiler/Google/Apple) jest wymienny bez przebudowy
// aplikacji — wymóg OSMF Nominatim Usage Policy (switch bez aktualizacji
// software). Implementacje dodajemy w tym pliku za tym samym interfejsem.
//
// Moduł jest celowo wolny od zależności Next.js/`@/` — współdzielony przez
// route handler (Next) i skrypt backfillu (Node, type-stripping).

export type GeoStatus = "exact" | "approximate" | "failed";

export interface LocationKey {
  postal_code: string;
  city: string;
  voivodeship: string;
}

export interface GeoResult {
  latitude: number | null;
  longitude: number | null;
  status: GeoStatus;
}

export interface Geocoder {
  geocode(location: LocationKey): Promise<GeoResult>;
}

/** Limity Polski (z marginesem) — odrzucamy wyniki spoza kraju. */
export function isInPolandBounds(lat: number, lon: number): boolean {
  return lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24.2;
}

/** Rzucany, gdy provider zwrócił rate-limit (429/403) — to nie "failed". */
export class GeocoderRateLimitedError extends Error {
  constructor() {
    super("NOMINATIM_RATE_LIMITED");
    this.name = "GeocoderRateLimitedError";
  }
}

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_USER_AGENT = "Ohana/1.0 (ohana.edu.pl; kontakt)";

/**
 * Nominatim (publiczny OSMF) — server-side forward geocoding.
 *
 * Zgodność z OSMF Nominatim Usage Policy:
 *  * max 1 request/s per aplikacja — throttle modułowy (w obrębie procesu);
 *    dodatkowo osłona przez trwały cache w `map_locations` (nigdy nie pytamy
 *    dwa razy o tę samą lokalizację) i geokodowanie wyłącznie user-triggered;
 *  * własny User-Agent identyfikujący Ohanę (domyślnie `Ohana/1.0 (...)`),
 *    nadpisywalny zmienną OHANA_USER_AGENT;
 *  * brak autocomplete/search — tylko pełna lokalizacja, jedna odpowiedź;
 *  * `countrycodes=pl` + walidacja PL bbox — wynik poza Polską ignorowany;
 *  * bazę można podmienić zmienną NOMINATIM_BASE_URL (własna instancja).
 */
export class NominatimGeocoder implements Geocoder {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(opts?: { baseUrl?: string; userAgent?: string }) {
    this.baseUrl = (
      opts?.baseUrl ??
      process.env.NOMINATIM_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.userAgent =
      opts?.userAgent ?? process.env.OHANA_USER_AGENT ?? DEFAULT_USER_AGENT;
  }

  async geocode(location: LocationKey): Promise<GeoResult> {
    const exact = await this.search(
      `${location.postal_code}, ${location.city}`,
    );
    if (exact) {
      return { ...exact, status: "exact" };
    }

    const approximate = await this.search(
      `${location.city}, ${location.voivodeship}`,
    );
    if (approximate) {
      return { ...approximate, status: "approximate" };
    }

    return { latitude: null, longitude: null, status: "failed" };
  }

  private async search(
    query: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    await this.throttle();

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      countrycodes: "pl",
      limit: "1",
      "accept-language": "pl",
    });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Sieć/bez odpowiedzi — traktujemy jak brak wyniku (klient dostanie
      // 'failed' + retry_after; backfill spróbuje później).
      return null;
    }

    if (res.status === 429 || res.status === 403) {
      throw new GeocoderRateLimitedError();
    }
    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const lat = Number(data[0]?.lat);
    const lon = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    if (!isInPolandBounds(lat, lon)) {
      return null;
    }
    return { latitude: lat, longitude: lon };
  }

  /** Twardy limit 1 req/s (średnio) — szereguje zapytania w obrębie procesu. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = this.lastRequestAt + 1000 - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastRequestAt = Date.now();
  }
}

export function getGeocoder(): Geocoder {
  return new NominatimGeocoder();
}