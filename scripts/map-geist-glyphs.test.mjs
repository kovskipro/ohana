import assert from "node:assert/strict";
import { PbfReader } from "pbf";
import {
  GEIST_FONT_STACKS,
  generateGlyphRangePbf,
  parseGlyphRequestUrl,
  resolveGeistFontStack,
} from "../src/lib/maps/geist-glyphs.ts";

assert.deepEqual(
  resolveGeistFontStack(GEIST_FONT_STACKS.regular),
  { fontStack: "Ohana Geist Regular", weight: 400, style: "normal" },
  "regularny fontstack mapuje się na Geist 400",
);
assert.deepEqual(
  resolveGeistFontStack(GEIST_FONT_STACKS.medium),
  { fontStack: "Ohana Geist Medium", weight: 500, style: "normal" },
  "medium fontstack mapuje się na Geist 500 bez kursywy",
);
assert.deepEqual(
  resolveGeistFontStack(GEIST_FONT_STACKS.bold),
  { fontStack: "Ohana Geist Bold", weight: 700, style: "normal" },
  "bold fontstack mapuje się na Geist 700",
);

const request = parseGlyphRequestUrl(
  "ohana-glyphs://Ohana%20Geist%20Bold/256-511.pbf",
);
assert.deepEqual(
  request,
  {
    start: 256,
    end: 511,
    font: { fontStack: "Ohana Geist Bold", weight: 700, style: "normal" },
  },
  "URL protokołu zachowuje wyrównany zakres 256 glifów i wagę",
);
assert.throws(
  () => parseGlyphRequestUrl("ohana-glyphs://Ohana%20Geist%20Regular/1-256.pbf"),
  /zakres/i,
  "niewyrównany zakres jest odrzucany",
);
assert.throws(
  () => parseGlyphRequestUrl("ohana-glyphs://Arial/0-255.pbf"),
  /fontstack/i,
  "protokół nie może po cichu generować Arialu",
);

const drawnCodePoints = [];
const encoded = generateGlyphRangePbf(request, (codePoint) => {
  drawnCodePoints.push(codePoint);
  return {
    data: new Uint8Array(49).fill(codePoint % 255),
    width: 7,
    height: 7,
    glyphWidth: 1,
    glyphHeight: 1,
    glyphLeft: -1,
    glyphTop: 2,
    glyphAdvance: 3,
  };
});

assert.equal(encoded.byteLength > 0, true, "generator zwraca niepusty PBF");
assert.equal(drawnCodePoints.length, 256, "generator tworzy dokładnie 256 glifów");
assert.equal(drawnCodePoints[0], 256, "generator zaczyna od początku zakresu");
assert.equal(drawnCodePoints.at(-1), 511, "generator kończy na końcu zakresu");

const decoded = [];
const metadata = {};
new PbfReader(encoded).readFields((tag, result, pbf) => {
  if (tag !== 1) return;
  pbf.readMessage((fontTag, fontResult, fontPbf) => {
    if (fontTag === 1) metadata.name = fontPbf.readString();
    if (fontTag === 2) metadata.range = fontPbf.readString();
    if (fontTag !== 3) return;
    fontResult.push(
      fontPbf.readMessage((glyphTag, glyph, glyphPbf) => {
        if (glyphTag === 1) glyph.id = glyphPbf.readVarint();
        if (glyphTag === 2) glyph.bitmap = glyphPbf.readBytes();
        if (glyphTag === 3) glyph.width = glyphPbf.readVarint();
        if (glyphTag === 4) glyph.height = glyphPbf.readVarint();
        if (glyphTag === 5) glyph.left = glyphPbf.readSVarint();
        if (glyphTag === 6) glyph.top = glyphPbf.readSVarint();
        if (glyphTag === 7) glyph.advance = glyphPbf.readVarint();
      }, {}),
    );
  }, result);
}, decoded);

assert.deepEqual(metadata, {
  name: "Ohana Geist Bold",
  range: "256-511",
});
assert.equal(decoded.length, 256, "PBF zawiera pełny zakres glifów");
assert.deepEqual(
  decoded[0],
  {
    id: 256,
    bitmap: new Uint8Array(49).fill(1),
    width: 1,
    height: 1,
    left: -1,
    top: 2,
    advance: 3,
  },
  "PBF ma metryki i bitmapę zgodne z formatem MapLibre",
);

console.log("Wszystkie testy lokalnych glifów Geist przeszły.");
