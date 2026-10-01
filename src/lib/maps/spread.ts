// Deterministyczne, celowo przybliżone położenie pinezek wokół współrzędnej
// bazowej z map_locations. Współrzędne bazowe pozostają niezmienione, a mapa
// korzysta wyłącznie z displayLatitude/displayLongitude.

export interface SpreadInput {
  profileId: string;
  latitude: number;
  longitude: number;
  city: string | null;
  markerSeed: number;
}

export interface SpreadOutput {
  displayLatitude: number;
  displayLongitude: number;
}

const METERS_PER_DEGREE = 111_320;
const DEADZONE_RATIO = 0.12;
const WARSAW_RADIUS_METERS = 6_000;
const LARGE_CITY_RADIUS_METERS = 3_000;
const DEFAULT_RADIUS_METERS = 900;

const LARGE_CITIES = new Set([
  "krakow",
  "lodz",
  "wroclaw",
  "poznan",
  "gdansk",
  "szczecin",
  "bydgoszcz",
  "lublin",
  "bialystok",
  "katowice",
]);

function normalizeCity(city: string | null): string {
  return (city ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .trim()
    .toLocaleLowerCase("pl");
}

export function getSpreadRadiusMeters(city: string | null): number {
  const normalized = normalizeCity(city);
  if (normalized === "warszawa") return WARSAW_RADIUS_METERS;
  if (LARGE_CITIES.has(normalized)) return LARGE_CITY_RADIUS_METERS;
  return DEFAULT_RADIUS_METERS;
}

/** FNV-1a z dodatkowym mieszaniem; wynik jest stabilnym uint32. */
function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function unitHash(value: string): number {
  return hash32(value) / 0x1_0000_0000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Każdy punkt zależy wyłącznie od markerSeed oraz profileId danej rodziny.
 * Dzięki temu permutacja, dodanie lub usunięcie innych rodzin nie przesuwa
 * istniejących pinezek. Promień używa sqrt(u), czyli jest równomierny po
 * powierzchni dysku, z niewielką pustą strefą przy współrzędnej bazowej.
 */
export function spreadPoints<T extends SpreadInput>(
  items: readonly T[],
): Array<T & SpreadOutput> {
  return items.map((item) => {
    const identity = `${item.markerSeed}:${item.profileId}`;
    const angle = Math.PI * 2 * unitHash(`${identity}:angle`);
    const radialUnit = unitHash(`${identity}:radius`);
    const radiusLimit = getSpreadRadiusMeters(item.city);
    const radius =
      radiusLimit *
      Math.sqrt(
        DEADZONE_RATIO ** 2 +
          (1 - DEADZONE_RATIO ** 2) * radialUnit,
      );

    const latitudeOffset = (radius * Math.sin(angle)) / METERS_PER_DEGREE;
    const longitudeScale = Math.max(
      Math.abs(Math.cos((item.latitude * Math.PI) / 180)),
      0.000_001,
    );
    const longitudeOffset =
      (radius * Math.cos(angle)) / (METERS_PER_DEGREE * longitudeScale);

    return {
      ...item,
      displayLatitude: clamp(item.latitude + latitudeOffset, -90, 90),
      displayLongitude: clamp(item.longitude + longitudeOffset, -180, 180),
    };
  });
}
