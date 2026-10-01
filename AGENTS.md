# Ohana — Agent Guide

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript 5
- **pnpm** (lockfile present, `pnpm-workspace.yaml` exists but no workspaces defined)

## Commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Start (prod) | `pnpm start` |

No test runner, formatter, or typecheck script is configured. The only lint tool is ESLint via `pnpm lint`.

## Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Locale

App is in **Polish** (`lang="pl"`). User-facing text, validation messages, and reference data (voivodeships, school classes, PESEL validation) are Polish-domain. `src/lib/validation.ts` contains Polish validators and reference data.

## Mapy — MapLibre + OpenFreeMap + Nominatim

Interaktywna mapa `/mapa` używa **MapLibre GL JS** (`maplibre-gl`) do renderowania z **OpenFreeMap** (publiczna instancja, styl `https://tiles.openfreemap.org/styles/positron` — jasny, neutralny styl drogowy; NIE używać `liberty`, który pokazuje tylko relief `ne2_shaded`) — **bez API key i bez rejestracji**. Geokodowanie `postal_code + city + voivodeship` → jedna współrzędna bazowa wykonuje **wyłącznie serwer** przez **publiczny Nominatim** (`https://nominatim.openstreetmap.org`). Cache w `map_locations` (tabela, zapisywana wyłącznie serwerem klientem uprzywilejowanym).

**Brak wymaganych API keys.** Opcjonalne zmienne (dla własnej instancji / wymiany dostawcy bez zmiany kodu):

| Zmienna | Cel | Domyślnie |
|---|---|---|
| `NOMINATIM_BASE_URL` | server-side geocoding (własna instancja) | `https://nominatim.openstreetmap.org` |
| `OHANA_USER_AGENT` | User-Agent identyfikujący Ohanę | `Ohana/1.0 (ohana.edu.pl; kontakt)` |

Zasady (zgodnie z OSMF Nominatim Usage Policy i OpenFreeMap):
- **OpenFreeMap**: wolna publiczna instancja, bez limitów views/requests, bez kluczy i ciasteczek; dane OSM. Atrybucja w MapLibre dodawana automatycznie („© OpenStreetMap contributors"); przy innym kliencie dodać „OpenFreeMap © OpenMapTiles Data from OpenStreetMap".
- **Worker MapLibre (v6.4.1)**: Next.js nie bundle'uje workera do chunków, więc `defaultWorkerUrl()` wskazuje nieistniejący plik i źródła wektorowe nigdy nie ładują tile'i. Fix: `public/maplibre-gl-worker.mjs` + `public/maplibre-gl-shared.mjs` (skopiowane z `node_modules/.../maplibre-gl/dist/`) + `maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs")` w `FamilyMap.tsx`. Przy zimnym starcie worker (moduł + import shared) może nie zdążyć założyć nasłuchu, zanim mapa wyśle `loadTile` — stąd `warmUpWorker()` w `FamilyMap.tsx`, który pinguje worker przed utworzeniem mapy (przeglądarka kolejkuje postMessage do zakończenia oceny modułu).
- **Nominatim — twardy limit: maks. 1 request/s per aplikacja** (suma wszystkich użytkowników), własny **User-Agent** identyfikujący aplikację, **cache wyników po naszej stronie**. Geokodowanie tylko przy zapisie/toggle `map_visible` (user-triggered) + jednorazowy idempotentny backfill z throttlingiem — **nigdy przy otwarciu `/mapa`**, **żadnego autocomplete/search** na publicznym Nominatim. Nie wysyłamy ponownie zapytania dla lokalizacji istniejącej w cache.
- **Atrybucja wymagana**: „© OpenStreetMap contributors" na mapie (MapLibre robi to automatycznie); atrybucja bazy wyników geokodowania w dokumentacji (patrz `0007_map_locations.sql`). Cache przechowuje wyłącznie współrzędne/status, nigdy surowe odpowiedzi API.
- Geokoder jest ukryty za **adapterem/interfejsem** (`src/lib/maps/geocoder.ts`), żeby dostawcę (Nominatim → MapTiler/Google/Apple) wymienić bez przebudowy aplikacji — to też wymóg polityki Nominatim (switch bez aktualizacji software).
- Geokodowanie wykonuje **wyłącznie serwer** (route handler + backfill). Klient nigdy nie wysyła lat/lng — wspólny cache nie może być zatruty z poziomu aplikacji.

## Sekrety Supabase (uprzywilejowany klient)

- `E2E_SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) — **wyłącznie do testów E2E** (`e2e/`), nigdy w runtime aplikacji.
- Jeśli produkcja potrzebuje uprzywilejowanego klienta serwerowego, użyj **nowego server-only secretu** (`sb_secret_...` z dashboardu Supabase, sekcja API keys) pod osobną nazwą env (np. `SUPABASE_SERVICE_ROLE_KEY`), **nie** przenoś legacy JWT do runtime.

## What's Missing

- No test runner, formatter, or typecheck script (lint only, see Commands)

- No CI/CD configuration

## ESLint

Flat config in `eslint.config.mjs` using `eslint-config-next` (core-web-vitals + TypeScript rules). Ignores `.next/`, `out/`, `build/`, `next-env.d.ts`.
