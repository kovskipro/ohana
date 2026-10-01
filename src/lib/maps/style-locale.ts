import type {
  ExpressionSpecification,
  StyleSpecification,
} from "maplibre-gl";

const GEIST_GLYPHS_URL = "ohana-glyphs://{fontstack}/{range}.pbf";
const GEIST_FONT_STACKS = {
  regular: "Ohana Geist Regular",
  medium: "Ohana Geist Medium",
  semibold: "Ohana Geist SemiBold",
  bold: "Ohana Geist Bold",
} as const;

const OSM_NAME_FIELDS = new Set([
  "name",
  "name_en",
  "name:latin",
  "name:nonlatin",
]);
const OSM_NAME_TOKEN = /\{(?:name|name_en|name:latin|name:nonlatin)\}/;
const HIDDEN_PLACE_CLASSES = [
  "suburb",
  "neighbourhood",
  "quarter",
  "hamlet",
  "isolated_dwelling",
  "locality",
];
const ROAD_SHIELD_LAYER_IDS = new Set([
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMapStyleSpecification(
  value: unknown,
): value is StyleSpecification {
  return (
    isRecord(value) &&
    value.version === 8 &&
    isRecord(value.sources) &&
    Array.isArray(value.layers) &&
    value.layers.every(
      (layer) =>
        isRecord(layer) &&
        typeof layer.id === "string" &&
        typeof layer.type === "string",
    )
  );
}

function referencesOsmName(value: unknown): boolean {
  if (typeof value === "string") return OSM_NAME_TOKEN.test(value);
  if (!Array.isArray(value)) return false;

  if (
    (value[0] === "get" || value[0] === "has") &&
    typeof value[1] === "string" &&
    OSM_NAME_FIELDS.has(value[1])
  ) {
    return true;
  }

  return value.some(referencesOsmName);
}

function polishNameExpression(): ExpressionSpecification {
  return [
    "coalesce",
    ["get", "name:pl"],
    ["get", "name"],
    ["get", "name_en"],
    ["get", "name:latin"],
  ];
}

function placeNameExpression(): ExpressionSpecification {
  return [
    "case",
    [
      "match",
      ["get", "class"],
      HIDDEN_PLACE_CLASSES,
      true,
      false,
    ],
    "",
    polishNameExpression(),
  ];
}

function collectFontNames(value: unknown, names: string[]): void {
  if (typeof value === "string") {
    names.push(value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const nested of value) collectFontNames(nested, names);
}

function chooseGeistFontStack(textFont: unknown): string {
  const names: string[] = [];
  collectFontNames(textFont, names);
  const descriptor = names.join(" ").toLowerCase();

  if (/\b(?:extra[ -]?bold|ultra[ -]?bold|black|heavy|bold)\b/.test(descriptor)) {
    return GEIST_FONT_STACKS.bold;
  }
  if (/\b(?:semi[ -]?bold|demi[ -]?bold)\b/.test(descriptor)) {
    return GEIST_FONT_STACKS.semibold;
  }
  if (/\b(?:medium|italic|oblique)\b/.test(descriptor)) {
    return GEIST_FONT_STACKS.medium;
  }
  return GEIST_FONT_STACKS.regular;
}

export function localizeMapStyleLabels(
  style: StyleSpecification,
): StyleSpecification {
  return {
    ...style,
    glyphs: GEIST_GLYPHS_URL,
    layers: style.layers.map((layer) => {
      if (layer.type !== "symbol") return layer;

      if (ROAD_SHIELD_LAYER_IDS.has(layer.id)) {
        return {
          ...layer,
          layout: {
            ...layer.layout,
            visibility: "none",
          },
        };
      }

      const textField = layer.layout?.["text-field"];
      if (textField === undefined) return layer;

      return {
        ...layer,
        layout: {
          ...layer.layout,
          "text-field": referencesOsmName(textField)
            ? layer["source-layer"] === "place"
              ? placeNameExpression()
              : polishNameExpression()
            : textField,
          "text-font": [chooseGeistFontStack(layer.layout?.["text-font"])],
        },
      };
    }),
  };
}
