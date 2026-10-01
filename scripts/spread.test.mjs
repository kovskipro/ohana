// Lekki test jednostkowy spreadu (bez test runnera — standalone Node 22.7+,
// type-stripping). Uruchomienie: node scripts/spread.test.mjs
import assert from "node:assert/strict";
import {
  getSpreadRadiusMeters,
  spreadPoints,
} from "../src/lib/maps/spread.ts";

function run(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}:`, err.message);
    process.exitCode = 1;
  }
}

const warsawFamily = (profileId, markerSeed = 1) => ({
  profileId,
  latitude: 52.2297,
  longitude: 21.0122,
  city: "Warszawa",
  markerSeed,
});

const byId = (points) =>
  Object.fromEntries(
    points.map((point) => [
      point.profileId,
      [point.displayLatitude, point.displayLongitude],
    ]),
  );

function distanceMeters(point) {
  const latMeters = (point.displayLatitude - point.latitude) * 111_320;
  const lngMeters =
    (point.displayLongitude - point.longitude) *
    111_320 *
    Math.cos((point.latitude * Math.PI) / 180);
  return Math.hypot(latMeters, lngMeters);
}

run("zachowuje bazowe współrzędne i zwraca osobne display coords", () => {
  const input = warsawFamily("family-a", 123);
  const [output] = spreadPoints([input]);

  assert.equal(output.latitude, input.latitude);
  assert.equal(output.longitude, input.longitude);
  assert.equal(typeof output.displayLatitude, "number");
  assert.equal(typeof output.displayLongitude, "number");
  assert.notDeepEqual(
    [output.displayLatitude, output.displayLongitude],
    [input.latitude, input.longitude],
  );
});

run("ten sam input daje identyczny punkt po odświeżeniu", () => {
  const input = [
    warsawFamily("family-a", 1),
    warsawFamily("family-b", 2),
    warsawFamily("family-c", 3),
  ];
  assert.deepEqual(spreadPoints(input), spreadPoints(input));
});

run("permutacja wejścia nie zmienia pozycji rodzin", () => {
  const input = [
    warsawFamily("family-a", 1),
    warsawFamily("family-b", 2),
    warsawFamily("family-c", 3),
  ];

  assert.deepEqual(
    byId(spreadPoints(input)),
    byId(spreadPoints([input[2], input[0], input[1]])),
  );
});

run("dodanie rodziny nie przesuwa istniejących", () => {
  const existing = [warsawFamily("family-a", 1), warsawFamily("family-b", 2)];
  const before = byId(spreadPoints(existing));
  const after = byId(
    spreadPoints([...existing, warsawFamily("new-family", 999)]),
  );

  assert.deepEqual(after["family-a"], before["family-a"]);
  assert.deepEqual(after["family-b"], before["family-b"]);
});

run("kolizję marker_seed rozstrzyga stabilne profile_id", () => {
  const points = spreadPoints([
    warsawFamily("family-a", 42),
    warsawFamily("family-b", 42),
  ]);

  assert.notDeepEqual(
    [points[0].displayLatitude, points[0].displayLongitude],
    [points[1].displayLatitude, points[1].displayLongitude],
  );
});

run("nie korzysta z Math.random", () => {
  const originalRandom = Math.random;
  Math.random = () => {
    throw new Error("Math.random nie może być używany przez spread");
  };
  try {
    spreadPoints([warsawFamily("family-a", 7)]);
  } finally {
    Math.random = originalRandom;
  }
});

run("normalizuje nazwy miast i dobiera wymagane promienie", () => {
  assert.equal(getSpreadRadiusMeters(" Warszawa "), 6_000);
  assert.equal(getSpreadRadiusMeters("KRAKÓW"), 3_000);
  assert.equal(getSpreadRadiusMeters("Lodz"), 3_000);
  assert.equal(getSpreadRadiusMeters("Białystok"), 3_000);
  assert.equal(getSpreadRadiusMeters("Pruszków"), 900);
  assert.equal(getSpreadRadiusMeters(null), 900);
});

run("punkty mieszczą się w dysku właściwym dla miasta i poza deadzone", () => {
  const cases = [
    warsawFamily("warsaw", 10),
    {
      ...warsawFamily("krakow", 20),
      city: "Kraków",
      latitude: 50.0647,
      longitude: 19.945,
    },
    {
      ...warsawFamily("small", 30),
      city: "Pruszków",
      latitude: 52.1705,
      longitude: 20.8119,
    },
  ];

  for (const point of spreadPoints(cases)) {
    const distance = distanceMeters(point);
    const radius = getSpreadRadiusMeters(point.city);
    assert.ok(distance <= radius + 0.01, `${point.city}: ${distance} > ${radius}`);
    assert.ok(distance >= radius * 0.1, `${point.city}: ${distance} w deadzone`);
    assert.ok(point.displayLatitude >= -90 && point.displayLatitude <= 90);
    assert.ok(point.displayLongitude >= -180 && point.displayLongitude <= 180);
  }
});

console.log(
  process.exitCode
    ? "\nNiektóre testy nie przeszły."
    : "\nWszystkie testy spreadu przeszły.",
);
