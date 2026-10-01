import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helperPath = new URL("../src/lib/maps/family-marker-icon.ts", import.meta.url);
const mapPath = new URL("../src/components/map/FamilyMap.tsx", import.meta.url);
const helperSource = await readFile(helperPath, "utf8");
const mapSource = await readFile(mapPath, "utf8");
const marker = await import(helperPath.href);

const EXACT_PATH =
  "M40.69,67.56c-5.38,0-24.75-16.66-24.75-33.56,0-13.75,11.1-24.94,24.75-24.94s24.75,11.19,24.75,24.94c0,16.91-19.37,33.56-24.75,33.56Z";

assert.equal(marker.FAMILY_MARKER_PATH, EXACT_PATH);
assert.equal(marker.FAMILY_MARKER_VIEWBOX_WIDTH, 81.39);
assert.equal(marker.FAMILY_MARKER_VIEWBOX_HEIGHT, 76.61);
assert.equal(marker.FAMILY_MARKER_BODY_WIDTH, 49.5);
assert.deepEqual(marker.FAMILY_MARKER_CENTER, {
  x: 40.69,
  y: 33.81,
  radius: 20.75,
});
assert.equal(marker.FAMILY_MARKER_RASTER_WIDTH, 112);
assert.equal(marker.FAMILY_MARKER_RASTER_HEIGHT, 106);
assert.equal(marker.FAMILY_MARKER_PIXEL_RATIO, 2);

assert.equal(marker.FAMILY_MARKER_BODY_COLOR, "#FFFFFF");
assert.equal(marker.FAMILY_MARKER_INITIALS_COLOR, "#171A18");
assert.equal(marker.FAMILY_MARKER_INITIALS_BACKGROUND, "#D5D7D4");
assert.match(marker.FAMILY_MARKER_STROKE_COLOR, /rgba\(0,\s*0,\s*0,\s*0\.28\)/);
assert.match(marker.FAMILY_MARKER_AVATAR_RING_COLOR, /rgba\(255,\s*255,\s*255,/);

assert.equal(marker.familyMarkerImageId("profile-123"), "family-marker:profile-123");
assert.equal(
  marker.familyMarkerImageId("profile-123"),
  marker.familyMarkerImageId("profile-123"),
  "ID obrazu jest stabilne",
);
assert.equal(marker.familyMarkerInitials("Anna Maria Kowalska"), "AK");
assert.equal(marker.familyMarkerInitials("  żaneta   ćwik  "), "ŻĆ");
assert.equal(marker.familyMarkerInitials("Łąka"), "ŁĄ");
assert.equal(marker.familyMarkerInitials("A"), "A");
assert.equal(marker.familyMarkerInitials(null), "?");
assert.equal(marker.familyMarkerInitials("   "), "?");

assert.match(helperSource, /new Path2D\(FAMILY_MARKER_PATH\)/);
assert.match(helperSource, /document\.createElement\("canvas"\)/);
assert.match(helperSource, /getImageData\(/);
assert.match(helperSource, /fetch\(url, \{ signal \}\)/);
assert.match(helperSource, /response\.ok/);
assert.match(helperSource, /URL\.createObjectURL/);
assert.match(helperSource, /URL\.revokeObjectURL/);
assert.match(helperSource, /image\.decode\(\)/);
assert.doesNotMatch(helperSource, /createImageBitmap/);
assert.doesNotMatch(helperSource, /react|currentColor|var\(--|dark:/i);
assert.equal(
  (helperSource.match(/FAMILY_MARKER_RASTER_WIDTH/g) ?? []).length > 1,
  true,
  "fallback i avatar korzystają ze wspólnego rastra",
);
assert.equal(
  (helperSource.match(/drawFamilyMarkerBase/g) ?? []).length > 1,
  true,
  "fallback i avatar korzystają z tej samej geometrii korpusu",
);

assert.doesNotMatch(mapSource, /prepareFamilyMarkerIcon/);
assert.match(mapSource, /map\.addImage\(markerIconId, fallbackImage, \{/);
assert.match(mapSource, /pixelRatio: FAMILY_MARKER_PIXEL_RATIO/);
assert.match(mapSource, /\.updateImage\(markerIconId, avatarImage\)/);
assert.match(mapSource, /const AVATAR_HYDRATION_CONCURRENCY = 4/);
assert.match(mapSource, /map\.on\("idle"/);
assert.match(mapSource, /marker_icon_id: familyMarkerImageId\(family\.profileId\)/);
assert.doesNotMatch(
  mapSource.slice(mapSource.indexOf("properties: {", mapSource.indexOf("buildMapDataset")), mapSource.indexOf("return {", mapSource.indexOf("properties: {", mapSource.indexOf("buildMapDataset")))),
  /profile_name|avatar_url/,
  "GeoJSON markera nie ujawnia nazwy ani URL avatara",
);

for (const layerId of ["POINT_CORE_LAYER", "SPIDER_POINT_CORE_LAYER"]) {
  const layerStart = mapSource.indexOf(`id: ${layerId}`);
  assert.notEqual(layerStart, -1, `istnieje warstwa ${layerId}`);
  const layerSource = mapSource.slice(layerStart, layerStart + 650);
  assert.match(layerSource, /type: "symbol"/);
  assert.match(layerSource, /"icon-image": \["get", "marker_icon_id"\]/);
  assert.match(layerSource, /"icon-size": 1/);
  assert.match(layerSource, /"icon-anchor": "bottom"/);
  assert.match(layerSource, /"icon-offset": \[0, 6\]/);
  assert.match(layerSource, /"icon-allow-overlap": true/);
  assert.match(layerSource, /"icon-ignore-placement": true/);
}

assert.match(
  mapSource,
  /layers: \[CLUSTER_LAYER, POINT_CORE_LAYER\]/,
  "first-visible korzysta z widocznej warstwy symboli",
);
assert.doesNotMatch(
  mapSource,
  /map\.on\([^\n]+(?:POINT_CORE_LAYER|SPIDER_POINT_CORE_LAYER)/,
  "warstwy ikony nie dostają listenerów interakcji",
);

console.log("Wszystkie testy ikony markera rodzin przeszły.");
