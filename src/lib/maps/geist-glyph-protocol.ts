import TinySDF from "@mapbox/tiny-sdf";
import type { AddProtocolAction } from "maplibre-gl";
import {
  GEIST_FONT_STACKS,
  GEIST_GLYPH_PROTOCOL,
  generateGlyphRangePbf,
  parseGlyphRequestUrl,
  type GeistFontDefinition,
} from "./geist-glyphs";

const FONT_VARIABLE = "--font-geist-sans";
const FONT_SIZE = 24;
const GLYPH_CACHE_LIMIT = 12;
const FONT_LOAD_SAMPLE = "Zażółć gęślą jaźń";
const REQUIRED_WEIGHTS = [400, 500, 600, 700] as const;

interface MapLibreProtocolApi {
  addProtocol: (protocol: string, handler: AddProtocolAction) => void;
}

let fontReadyPromise: Promise<string> | undefined;
const registeredMapLibreApis = new WeakSet<object>();
const glyphRangeCache = new Map<string, Promise<ArrayBuffer>>();
const sdfGenerators = new Map<string, TinySDF>();

function isLoadedGeistFace(face: FontFace): boolean {
  return face.status === "loaded" && /geist/i.test(face.family);
}

async function loadGeistFont(): Promise<string> {
  if (typeof document === "undefined" || !document.fonts?.load) {
    throw new Error("Lokalne glify Geist wymagają przeglądarkowego FontFaceSet.");
  }

  const fontFamily = getComputedStyle(document.documentElement)
    .getPropertyValue(FONT_VARIABLE)
    .trim();
  if (!fontFamily || !/geist/i.test(fontFamily)) {
    throw new Error(`Brak rzeczywistej rodziny Geist w ${FONT_VARIABLE}.`);
  }

  await document.fonts.ready;
  const loadedFaces = await Promise.all(
    REQUIRED_WEIGHTS.map((weight) =>
      document.fonts.load(
        `normal ${weight} ${FONT_SIZE}px ${fontFamily}`,
        FONT_LOAD_SAMPLE,
      ),
    ),
  );
  if (loadedFaces.some((faces) => !faces.some(isLoadedGeistFace))) {
    throw new Error("Nie udało się załadować wszystkich wymaganych wag Geist.");
  }
  return fontFamily;
}

export function prepareGeistGlyphFont(): Promise<string> {
  fontReadyPromise ??= loadGeistFont();
  return fontReadyPromise;
}

function getSdfGenerator(
  fontFamily: string,
  font: GeistFontDefinition,
): TinySDF {
  const key = `${fontFamily}|${font.fontStack}`;
  let generator = sdfGenerators.get(key);
  if (!generator) {
    generator = new TinySDF({
      fontSize: FONT_SIZE,
      buffer: 3,
      radius: 8,
      cutoff: 0.25,
      fontFamily,
      fontWeight: String(font.weight),
      fontStyle: font.style,
      lang: "pl",
    });
    sdfGenerators.set(key, generator);
  }
  return generator;
}

function abortError(): DOMException {
  return new DOMException("Generowanie glyphów anulowane.", "AbortError");
}

function createGlyphProtocolHandler(fontFamily: string): AddProtocolAction {
  return async (requestParameters, abortController) => {
    if (abortController.signal.aborted) throw abortError();
    const request = parseGlyphRequestUrl(requestParameters.url);
    const cacheKey = `${request.font.fontStack}:${request.start}`;
    let glyphRange = glyphRangeCache.get(cacheKey);

    if (glyphRange) {
      glyphRangeCache.delete(cacheKey);
      glyphRangeCache.set(cacheKey, glyphRange);
    } else {
      glyphRange = Promise.resolve().then(() => {
        const generator = getSdfGenerator(fontFamily, request.font);
        return generateGlyphRangePbf(request, (codePoint) =>
          generator.draw(String.fromCodePoint(codePoint)),
        );
      });
      glyphRangeCache.set(cacheKey, glyphRange);
      while (glyphRangeCache.size > GLYPH_CACHE_LIMIT) {
        const oldestKey = glyphRangeCache.keys().next().value;
        if (oldestKey === undefined) break;
        glyphRangeCache.delete(oldestKey);
      }
      void glyphRange.catch(() => {
        if (glyphRangeCache.get(cacheKey) === glyphRange) {
          glyphRangeCache.delete(cacheKey);
        }
      });
    }

    const data = await glyphRange;
    if (abortController.signal.aborted) throw abortError();
    return { data: data.slice(0) };
  };
}

export function registerGeistGlyphProtocol(
  maplibregl: MapLibreProtocolApi,
  fontFamily: string,
): void {
  if (registeredMapLibreApis.has(maplibregl)) return;
  maplibregl.addProtocol(
    GEIST_GLYPH_PROTOCOL,
    createGlyphProtocolHandler(fontFamily),
  );
  registeredMapLibreApis.add(maplibregl);
}

export const GEIST_GLYPH_FONT_STACKS = GEIST_FONT_STACKS;
