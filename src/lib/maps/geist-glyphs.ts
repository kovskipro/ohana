import { PbfWriter } from "pbf";

export const GEIST_GLYPH_PROTOCOL = "ohana-glyphs";
export const GEIST_GLYPHS_URL = `${GEIST_GLYPH_PROTOCOL}://{fontstack}/{range}.pbf`;

export const GEIST_FONT_STACKS = {
  regular: "Ohana Geist Regular",
  medium: "Ohana Geist Medium",
  semibold: "Ohana Geist SemiBold",
  bold: "Ohana Geist Bold",
} as const;

const GLYPH_BORDER = 3;
const GLYPHS_PER_RANGE = 256;
const MAX_UNICODE_CODE_POINT = 0x10ffff;

export interface GeistFontDefinition {
  fontStack: (typeof GEIST_FONT_STACKS)[keyof typeof GEIST_FONT_STACKS];
  weight: 400 | 500 | 600 | 700;
  style: "normal";
}

export interface GlyphRangeRequest {
  start: number;
  end: number;
  font: GeistFontDefinition;
}

export interface SdfGlyph {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  glyphWidth: number;
  glyphHeight: number;
  glyphLeft: number;
  glyphTop: number;
  glyphAdvance: number;
}

interface EncodedGlyph {
  id: number;
  bitmap: Uint8Array;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
}

interface EncodedFontStack {
  name: string;
  range: string;
  glyphs: EncodedGlyph[];
}

const FONT_DEFINITIONS: ReadonlyMap<string, GeistFontDefinition> = new Map([
  [
    GEIST_FONT_STACKS.regular,
    { fontStack: GEIST_FONT_STACKS.regular, weight: 400, style: "normal" },
  ],
  [
    GEIST_FONT_STACKS.medium,
    { fontStack: GEIST_FONT_STACKS.medium, weight: 500, style: "normal" },
  ],
  [
    GEIST_FONT_STACKS.semibold,
    { fontStack: GEIST_FONT_STACKS.semibold, weight: 600, style: "normal" },
  ],
  [
    GEIST_FONT_STACKS.bold,
    { fontStack: GEIST_FONT_STACKS.bold, weight: 700, style: "normal" },
  ],
]);

export function resolveGeistFontStack(fontStack: string): GeistFontDefinition {
  const font = FONT_DEFINITIONS.get(fontStack);
  if (!font) {
    throw new Error(`Nieobsługiwany fontstack lokalnych glyphów: ${fontStack}.`);
  }
  return font;
}

export function parseGlyphRequestUrl(url: string): GlyphRangeRequest {
  const prefix = `${GEIST_GLYPH_PROTOCOL}://`;
  if (!url.startsWith(prefix)) {
    throw new Error("Niepoprawny protokół lokalnych glyphów.");
  }

  const path = url.slice(prefix.length).split(/[?#]/, 1)[0];
  const separator = path.lastIndexOf("/");
  if (separator <= 0) {
    throw new Error("Niepoprawny URL lokalnych glyphów.");
  }

  let fontStack: string;
  try {
    fontStack = decodeURIComponent(path.slice(0, separator));
  } catch {
    throw new Error("Niepoprawnie zakodowany fontstack lokalnych glyphów.");
  }
  const font = resolveGeistFontStack(fontStack);
  const rangeMatch = /^(\d+)-(\d+)\.pbf$/.exec(path.slice(separator + 1));
  if (!rangeMatch) {
    throw new Error("Niepoprawny zakres lokalnych glyphów.");
  }

  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start % GLYPHS_PER_RANGE !== 0 ||
    end !== start + GLYPHS_PER_RANGE - 1 ||
    end > MAX_UNICODE_CODE_POINT
  ) {
    throw new Error("Niepoprawny zakres 256 lokalnych glyphów.");
  }

  return { start, end, font };
}

function finiteInteger(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Niepoprawna metryka glyphu: ${field}.`);
  }
  return Math.round(value);
}

function encodeGlyph(id: number, glyph: SdfGlyph): EncodedGlyph {
  const width = finiteInteger(glyph.width, "width") - GLYPH_BORDER * 2;
  const height = finiteInteger(glyph.height, "height") - GLYPH_BORDER * 2;
  if (width < 0 || height < 0) {
    throw new Error("Bitmapa glyphu nie zawiera wymaganego obramowania SDF.");
  }

  const bitmap = Uint8Array.from(glyph.data);
  if (bitmap.byteLength !== (width + 6) * (height + 6)) {
    throw new Error("Rozmiar bitmapy glyphu jest niezgodny z metrykami.");
  }

  return {
    id,
    bitmap,
    width,
    height,
    left: finiteInteger(glyph.glyphLeft, "left"),
    top: finiteInteger(glyph.glyphTop, "top"),
    advance: Math.max(0, finiteInteger(glyph.glyphAdvance, "advance")),
  };
}

function writeGlyph(glyph: EncodedGlyph, pbf: PbfWriter): void {
  pbf.writeVarintField(1, glyph.id);
  pbf.writeBytesField(2, glyph.bitmap);
  pbf.writeVarintField(3, glyph.width);
  pbf.writeVarintField(4, glyph.height);
  pbf.writeSVarintField(5, glyph.left);
  pbf.writeSVarintField(6, glyph.top);
  pbf.writeVarintField(7, glyph.advance);
}

function writeFontStack(fontStack: EncodedFontStack, pbf: PbfWriter): void {
  pbf.writeStringField(1, fontStack.name);
  pbf.writeStringField(2, fontStack.range);
  for (const glyph of fontStack.glyphs) {
    pbf.writeMessage(3, writeGlyph, glyph);
  }
}

function writeGlyphs(fontStack: EncodedFontStack, pbf: PbfWriter): void {
  pbf.writeMessage(1, writeFontStack, fontStack);
}

export function generateGlyphRangePbf(
  request: GlyphRangeRequest,
  drawGlyph: (codePoint: number) => SdfGlyph,
): ArrayBuffer {
  const glyphs: EncodedGlyph[] = [];
  for (let codePoint = request.start; codePoint <= request.end; codePoint += 1) {
    glyphs.push(encodeGlyph(codePoint, drawGlyph(codePoint)));
  }

  const pbf = new PbfWriter();
  writeGlyphs(
    {
      name: request.font.fontStack,
      range: `${request.start}-${request.end}`,
      glyphs,
    },
    pbf,
  );
  return Uint8Array.from(pbf.finish()).buffer;
}
