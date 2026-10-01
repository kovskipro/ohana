import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Testy E2E (Playwright) — poza zakresem lintu aplikacji.
    "e2e/**",
    "playwright.config.ts",
    "playwright-report/**",
    "test-results/**",
    // Katalog .agents/ (Playwright runtime harness, .cjs) — poza zakresem lintu.
    ".agents/**",
    // Vendored z node_modules/maplibre-gl/dist/ — poza zakresem lintu.
    "public/maplibre-gl-shared.mjs",
    "public/maplibre-gl-worker.mjs",
  ]),
  // Ręcznie pisane komponenty UI (src/components/ui) celowo używają
  // wzorca "latest ref" (ref.current = callback podczas renderu), aby
  // nie odświeżać Framer Motion hooków przy każdej zmianie propsów.
  // Te dwie reguły react-hooks są wyłączone tylko dla tego katalogu;
  // pozostałe reguły ESLint pozostają aktywne.
  {
    files: ["src/components/ui/**/*"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
