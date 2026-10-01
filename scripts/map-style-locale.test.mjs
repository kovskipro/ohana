import assert from "node:assert/strict";
import { localizeMapStyleLabels } from "../src/lib/maps/style-locale.ts";

const POLISH_NAME_EXPRESSION = [
  "coalesce",
  ["get", "name:pl"],
  ["get", "name"],
  ["get", "name_en"],
  ["get", "name:latin"],
];

const freezeDeep = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freezeDeep(nested);
  }
  return value;
};

const evaluateExpression = (expression, properties) => {
  if (!Array.isArray(expression)) return expression;

  const [operator, ...args] = expression;
  if (operator === "get") return properties[args[0]];
  if (operator === "has") return Object.hasOwn(properties, args[0]);
  if (operator === "coalesce") {
    return args
      .map((argument) => evaluateExpression(argument, properties))
      .find((value) => value !== null && value !== undefined);
  }
  if (operator === "to-string") {
    return String(evaluateExpression(args[0], properties));
  }
  if (operator === "slice") {
    return evaluateExpression(args[0], properties).slice(args[1], args[2]);
  }
  if (operator === "upcase") {
    return evaluateExpression(args[0], properties).toUpperCase();
  }
  if (operator === "downcase") {
    return evaluateExpression(args[0], properties).toLowerCase();
  }
  if (operator === "match") {
    const input = evaluateExpression(args[0], properties);
    for (let index = 1; index < args.length - 1; index += 2) {
      const labels = args[index];
      const matches = Array.isArray(labels)
        ? labels.includes(input)
        : labels === input;
      if (matches) return evaluateExpression(args[index + 1], properties);
    }
    return evaluateExpression(args.at(-1), properties);
  }
  if (operator === "case") {
    for (let index = 0; index < args.length - 1; index += 2) {
      if (evaluateExpression(args[index], properties)) {
        return evaluateExpression(args[index + 1], properties);
      }
    }
    return evaluateExpression(args.at(-1), properties);
  }
  if (operator === "==") {
    return (
      evaluateExpression(args[0], properties) ===
      evaluateExpression(args[1], properties)
    );
  }

  throw new Error(`Nieobsługiwany operator testowy: ${operator}`);
};

const nonUsShieldFilter = [
  "all",
  ["<=", ["get", "ref_length"], 6],
  ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
];

const style = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { openmaptiles: { type: "vector", url: "https://example.test" } },
  layers: [
    {
      id: "custom-place-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "rank"], 1],
      layout: {
        "text-field": [
          "case",
          ["has", "name:nonlatin"],
          ["get", "name:latin"],
          ["coalesce", ["get", "name_en"], ["get", "name"]],
        ],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
    },
    {
      id: "highway-shield-non-us",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 11,
      filter: nonUsShieldFilter,
      layout: {
        "icon-image": ["concat", "road_", ["get", "ref_length"]],
        "symbol-placement": ["step", ["zoom"], "point", 11, "line"],
        "symbol-spacing": 200,
        "text-field": ["to-string", ["get", "ref"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": 10,
      },
    },
    {
      id: "highway-shield-us-interstate",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      filter: ["==", ["get", "network"], "us-interstate"],
      layout: {
        "icon-image": ["concat", ["get", "network"], "_", ["get", "ref_length"]],
        "text-field": ["get", "ref"],
        "text-font": ["Noto Sans Regular"],
      },
    },
    {
      id: "road_shield_us",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 12,
      filter: ["==", ["get", "network"], "us-highway"],
      layout: {
        "icon-image": ["concat", ["get", "network"], "_", ["get", "ref_length"]],
        "symbol-placement": ["step", ["zoom"], "point", 11, "line"],
        "symbol-spacing": 200,
        "text-field": ["get", "ref"],
        "text-font": ["Noto Sans Regular"],
      },
    },
    {
      id: "road-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      filter: ["==", ["get", "class"], "primary"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#abc" },
    },
  ],
};

const original = structuredClone(style);
freezeDeep(style);
const localized = localizeMapStyleLabels(style);

const layerById = (id) => {
  const layer = localized.layers.find((candidate) => candidate.id === id);
  assert.ok(layer, `brak warstwy ${id}`);
  return layer;
};

const placeLayer = layerById("custom-place-label");
assert.deepEqual(
  placeLayer.filter,
  original.layers[0].filter,
  "filtr warstwy place ma pozostać bajt w bajt bez zmian",
);
for (const placeClass of [
  "suburb",
  "neighbourhood",
  "quarter",
  "hamlet",
  "isolated_dwelling",
  "locality",
]) {
  assert.equal(
    evaluateExpression(placeLayer.layout["text-field"], {
      class: placeClass,
      "name:pl": "Ukryta dzielnica",
      name: "Hidden district",
    }),
    "",
    `${placeClass} ma dostać pustą etykietę bez zmiany filtra`,
  );
}
for (const placeClass of ["city", "town", "village"]) {
  assert.equal(
    evaluateExpression(placeLayer.layout["text-field"], {
      class: placeClass,
      "name:pl": "Polska nazwa",
      name: "Local name",
    }),
    "Polska nazwa",
    `${placeClass} ma pozostać widoczne z polską nazwą`,
  );
}
assert.deepEqual(
  placeLayer.layout["text-field"].at(-1),
  POLISH_NAME_EXPRESSION,
  "widoczne miejsca mają zachować polską kolejność nazw",
);
assert.equal(
  localized.glyphs,
  "ohana-glyphs://{fontstack}/{range}.pbf",
  "styl ma pobierać glify z lokalnego protokołu Ohany",
);
assert.deepEqual(placeLayer.layout["text-font"], ["Ohana Geist Regular"]);
assert.equal(placeLayer.layout["text-size"], 12);

for (const [index, shieldId] of [
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
].entries()) {
  const shield = layerById(shieldId);
  const originalShield = original.layers[index + 1];
  assert.equal(
    shield.layout.visibility,
    "none",
    `${shieldId} ma być całkowicie ukryta`,
  );
  assert.deepEqual(
    shield.filter,
    originalShield.filter,
    `${shieldId} zachowuje oryginalny filtr Positron`,
  );
  assert.equal(shield.minzoom, originalShield.minzoom);
  for (const [property, value] of Object.entries(originalShield.layout)) {
    assert.deepEqual(
      shield.layout[property],
      value,
      `${shieldId} zachowuje layout ${property}`,
    );
  }
}

assert.deepEqual(
  layerById("road-name").filter,
  original.layers[4].filter,
  "filtr nazwy ulicy nie może zostać zmieniony",
);
assert.deepEqual(
  layerById("road-name").layout["text-field"],
  POLISH_NAME_EXPRESSION,
  "nazwa ulicy nadal korzysta z polskiej kolejności nazw",
);
assert.deepEqual(layerById("water"), original.layers[5]);
assert.deepEqual(style, original, "helper nie może mutować zamrożonego stylu wejściowego");
assert.notEqual(localized, style);
assert.notEqual(localized.layers, style.layers);

console.log("Wszystkie testy polskich etykiet i ukrytych tarcz stylu mapy przeszły.");
