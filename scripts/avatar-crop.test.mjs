import assert from "node:assert/strict";
import {
  clampCropOffset,
  getContainedImageRect,
  getCropDiameter,
  getCropExportLayout,
  getCropSelectionRect,
} from "../src/lib/avatar-crop.ts";

function run(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}:`, error.message);
    process.exitCode = 1;
  }
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: oczekiwano ${expected}, otrzymano ${actual}`,
  );
}

function assertRect(actual, expected, label) {
  assertClose(actual.x, expected.x, `${label}.x`);
  assertClose(actual.y, expected.y, `${label}.y`);
  assertClose(actual.width, expected.width, `${label}.width`);
  assertClose(actual.height, expected.height, `${label}.height`);
}

run("obraz landscape jest nieruchomy, wycentrowany i mieści się w workspace", () => {
  assertRect(
    getContainedImageRect(1600, 900, 400),
    { x: 0, y: 87.5, width: 400, height: 225 },
    "landscape",
  );
});

run("obraz portrait jest nieruchomy, wycentrowany i mieści się w workspace", () => {
  assertRect(
    getContainedImageRect(900, 1600, 400),
    { x: 87.5, y: 0, width: 225, height: 400 },
    "portrait",
  );
});

run("zoom 100% daje kółko o średnicy krótszego boku zdjęcia", () => {
  assertClose(getCropDiameter(1600, 900, 400, 1), 225, "landscape");
  assertClose(getCropDiameter(900, 1600, 400, 1), 225, "portrait");
});

run("zoom 300% daje kółko o średnicy równej jednej trzeciej krótszego boku", () => {
  assertClose(getCropDiameter(1600, 900, 400, 3), 75, "landscape");
  assertClose(getCropDiameter(900, 1600, 400, 3), 75, "portrait");
});

run("offset kółka jest ograniczony do faktycznego prostokąta landscape", () => {
  assert.deepEqual(
    clampCropOffset(1600, 900, 400, 1, { x: 999, y: -999 }),
    { x: 87.5, y: 0 },
  );
  assert.deepEqual(
    clampCropOffset(1600, 900, 400, 3, { x: -999, y: 999 }),
    { x: -162.5, y: 75 },
  );
});

run("offset kółka jest ograniczony do faktycznego prostokąta portrait", () => {
  assert.deepEqual(
    clampCropOffset(900, 1600, 400, 1, { x: -999, y: 999 }),
    { x: 0, y: 87.5 },
  );
});

run("zmiana zoomu zachowuje środek kółka albo clampuje go do zdjęcia", () => {
  assert.deepEqual(
    clampCropOffset(1600, 900, 400, 3, { x: 80, y: 60 }),
    { x: 80, y: 60 },
  );
  assert.deepEqual(
    clampCropOffset(1600, 900, 400, 1, { x: 80, y: 60 }),
    { x: 80, y: 0 },
  );
});

run("kółko uwzględnia przesunięcie względem środka zdjęcia", () => {
  assertRect(
    getCropSelectionRect(1600, 900, 400, 2, { x: 50, y: -20 }),
    { x: 193.75, y: 123.75, width: 112.5, height: 112.5 },
    "selection",
  );
});

run("eksport landscape pobiera dokładny kwadrat opisany na kółku", () => {
  const layout = getCropExportLayout(
    1600,
    900,
    400,
    1,
    { x: 0, y: 0 },
    512,
  );

  assert.equal(layout.width, 512);
  assert.equal(layout.height, 512);
  assertRect(layout.source, { x: 350, y: 0, width: 900, height: 900 }, "source");
  assertRect(layout.destination, { x: 0, y: 0, width: 512, height: 512 }, "destination");
});

run("eksport portrait pobiera dokładny kwadrat opisany na kółku", () => {
  const layout = getCropExportLayout(
    900,
    1600,
    400,
    1,
    { x: 0, y: 0 },
    512,
  );

  assertRect(layout.source, { x: 0, y: 350, width: 900, height: 900 }, "source");
});

run("eksport uwzględnia zoom 300%", () => {
  const layout = getCropExportLayout(
    1600,
    900,
    400,
    3,
    { x: 0, y: 0 },
    512,
  );

  assertRect(layout.source, { x: 650, y: 300, width: 300, height: 300 }, "source");
});

run("eksport uwzględnia offset kółka", () => {
  const layout = getCropExportLayout(
    1600,
    900,
    400,
    2,
    { x: 50, y: -20 },
    512,
  );

  assertRect(layout.source, { x: 775, y: 145, width: 450, height: 450 }, "source");
});

console.log(
  process.exitCode
    ? "\nNiektóre testy matematyki kadru nie przeszły."
    : "\nWszystkie testy matematyki kadru przeszły.",
);
