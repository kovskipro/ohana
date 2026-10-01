import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  Point,
} from "geojson";

export interface SpiderfyEntry {
  profileId: string;
  markerSeed: number;
  markerIconId: string;
}

export interface PixelCoordinate {
  x: number;
  y: number;
}

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
}

export function buildSpiderfyGeoJSON(
  entries: readonly SpiderfyEntry[],
  originPoint: PixelCoordinate,
  unproject: (point: [number, number]) => GeographicCoordinate,
): FeatureCollection<Point | LineString, GeoJsonProperties> {
  const unique = new Map<string, SpiderfyEntry>();
  for (const entry of entries) {
    if (!unique.has(entry.profileId)) unique.set(entry.profileId, entry);
  }

  const sorted = [...unique.values()].sort(
    (left, right) =>
      left.markerSeed - right.markerSeed ||
      left.profileId.localeCompare(right.profileId),
  );
  const origin = unproject([originPoint.x, originPoint.y]);
  const features: Array<
    Feature<Point | LineString, GeoJsonProperties>
  > = [];

  sorted.forEach((entry, index) => {
    const ring = Math.floor(index / 8);
    const position = index % 8;
    const countInRing = Math.min(8, sorted.length - ring * 8);
    const angle = -Math.PI / 2 + (position / countInRing) * Math.PI * 2;
    const radius = 52 + ring * 42;
    const endpoint = unproject([
      originPoint.x + Math.cos(angle) * radius,
      originPoint.y + Math.sin(angle) * radius,
    ]);

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [origin.longitude, origin.latitude],
          [endpoint.longitude, endpoint.latitude],
        ],
      },
      properties: { kind: "line" },
    });
    features.push({
      type: "Feature",
      id: entry.profileId,
      geometry: {
        type: "Point",
        coordinates: [endpoint.longitude, endpoint.latitude],
      },
      properties: {
        kind: "point",
        profile_id: entry.profileId,
        marker_seed: entry.markerSeed,
        marker_icon_id: entry.markerIconId,
      },
    });
  });

  return { type: "FeatureCollection", features };
}
