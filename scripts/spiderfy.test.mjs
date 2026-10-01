import assert from "node:assert/strict";
import { buildSpiderfyGeoJSON } from "../src/lib/maps/spiderfy.ts";

const unproject = ([x, y]) => ({ longitude: x / 10, latitude: y / 10 });

const entries = [
  { profileId: "family-b", markerSeed: 7, markerIconId: "family-marker:family-b" },
  { profileId: "family-a", markerSeed: 7, markerIconId: "family-marker:family-a" },
  { profileId: "family-c", markerSeed: 2, markerIconId: "family-marker:family-c" },
];

const first = buildSpiderfyGeoJSON(entries, { x: 100, y: 80 }, unproject);
const permuted = buildSpiderfyGeoJSON(
  [entries[1], entries[2], entries[0]],
  { x: 100, y: 80 },
  unproject,
);

assert.deepEqual(first, permuted, "układ musi być niezależny od kolejności");
assert.equal(first.features.length, 6, "każdy punkt ma nogę i marker");

const points = first.features.filter(
  (feature) => feature.geometry.type === "Point",
);
assert.deepEqual(
  points.map((feature) => feature.properties?.profile_id),
  ["family-c", "family-a", "family-b"],
  "marker_seed i profile_id deterministycznie rozstrzygają kolejność",
);
assert.deepEqual(
  points.map((feature) => feature.properties?.marker_icon_id),
  [
    "family-marker:family-c",
    "family-marker:family-a",
    "family-marker:family-b",
  ],
  "każdy spider point zachowuje własny obraz markera",
);
for (const point of points) {
  assert.deepEqual(
    Object.keys(point.properties ?? {}).sort(),
    ["kind", "marker_icon_id", "marker_seed", "profile_id"],
    "spider point nie ujawnia nazwy ani URL avatara",
  );
}
assert.equal(
  new Set(
    points.map((feature) => JSON.stringify(feature.geometry.coordinates)),
  ).size,
  3,
  "spider points muszą mieć różne pozycje klikalne",
);

const firstPoint = points[0];
assert.equal(firstPoint.geometry.type, "Point");
assert.equal(
  Math.hypot(
    firstPoint.geometry.coordinates[0] * 10 - 100,
    firstPoint.geometry.coordinates[1] * 10 - 80,
  ),
  52,
  "pierwszy ring zostawia miejsce na pinezki 34 px",
);

const manyEntries = Array.from({ length: 9 }, (_, index) => ({
  profileId: `family-${index}`,
  markerSeed: index,
  markerIconId: `family-marker:family-${index}`,
}));
const manyPoints = buildSpiderfyGeoJSON(
  manyEntries,
  { x: 100, y: 80 },
  unproject,
).features.filter((feature) => feature.geometry.type === "Point");
const ninthPoint = manyPoints[8];
assert.equal(ninthPoint.geometry.type, "Point");
assert.equal(
  Math.hypot(
    ninthPoint.geometry.coordinates[0] * 10 - 100,
    ninthPoint.geometry.coordinates[1] * 10 - 80,
  ),
  94,
  "kolejny ring zwiększa promień o 42 px",
);

const deduplicated = buildSpiderfyGeoJSON(
  [...entries, entries[0]],
  { x: 100, y: 80 },
  unproject,
);
assert.equal(deduplicated.features.length, 6, "duplikat ID nie tworzy markera");

console.log("Wszystkie testy geometrii spiderfy przeszły.");
