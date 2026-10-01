# Ohana — Kooperatywa Edukacyjna

Strona internetowa Kooperatywy Edukacyjnej — miejsce spotkań i wymiany doświadczeń
dla rodzin i nauczycieli szukających alternatywnego podejścia do edukacji.
Platforma oferuje rejestrację rodzin, formularze rekrutacyjne, interaktywną mapę
rozdzielającą rodziny po sąsiedztwie oraz panelek administracyjny.

Aplikacja jest w języku polskim, skierowana do polskich rodzin i nauczycieli.

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | **Next.js 16** (App Router) |
| Biblioteka UI | **React 19** + **TypeScript 5** |
| Baza danych / Auth | **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) |
| Mapy | **MapLibre GL JS** + **OpenFreeMap** (tiles) + **Nominatim** (geokodowanie serwerowe) |
| Monitoring / Sentry | `@sentry/nextjs` |
| E-maile | **Resend** |
| Testy E2E | **Playwright** |
| Testy jednostkowe | skrypty Node (`.test.mjs` w `scripts/`) |
| Pakiet manager | **pnpm** (jedyny obsługiwany) |
## Instalacja

```bash
pnpm install
```

## Zmienne środowiskowe

 Konfiguracja w `.env.local`. **Nigdy nie commituj tego pliku ani nie publikuj
jego wartości.** Wszystkie klucze service role, tokeny JWT i klucze API należy
trzymać prywatnymi (patrz sekcja [Bezpieczeństwo](#bezpieczeństwo)).

| Zmienna | Publiczna / Prywatna | Opis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publiczna (URL) | URL projektu Supabase, używany po stronie klienta i serwera. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publiczna (publishable) | Klucz anonimowy (publishable) — dostępny w przeglądarce. |
| `NEXT_PUBLIC_SENTRY_DSN` | Publiczna (DSN) | DSN projektu Sentry — umożliwia raportowanie błędów po stronie klienta. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Prywatna / server-only** | Nowoczesny server-only secret z dashboardu Supabase (sekcja API keys, klucz typu service role). Używany wyłącznie po stronie serwera (cache geokodowania, backfill). **Nigdy** nie trafia do przeglądarki ani runtimeu klienckiego. |
| `RESEND_API_KEY` | **Prywatna** | Klucz API Resend — używany do wysyłki e-maili i odczytu kodów OTP w testach E2E. |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | **Prywatna / test-only** | Starszy token JWT — **wyłącznie** do testów E2E (`e2e/`), nigdy w runtime aplikacji. |

### Zmienne opcjonalne

| Zmienna | Publiczna / Prywatna | Domyślnie | Opis |
|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | **Prywatna** | — | Token auth dla `sentry-cli` przy buildzie — potrzebny do uploadu sourcemapów. |
| `NOMINATIM_BASE_URL` | Publiczna | `https://nominatim.openstreetmap.org` | Adres własnej instancji Nominatim (wymiana dostawcy bez zmiany kodu). |
| `OHANA_USER_AGENT` | Publiczna | `Ohana/1.0 (ohana.edu.pl; kontakt)` | User-Agent identyfikujący aplikację w żądaniach geookodowych. |
| `PLAYWRIGHT_BASE_URL` | Publiczna | `http://localhost:3000` | Adres URL aplikacji dla testów E2E. |
| `E2E_ALLOW_REMOTE_SUPABASE` | Publiczna | `false` | Ustaw `true`, by testy E2E mogły wykonywać mutacje na zdalnym (niecalnym) Supabase. |

### Bezpieczeństwo

- `SUPABASE_SERVICE_ROLE_KEY` to **nowoczesny, server-only secret** (klucz typu
  service role z dashboardu Supabase, sekcja API keys) — używany tylko w
  `src/lib/supabase/service-role.ts` (serwerowy klient uprzywilejowany do zapisu
  wspólnego cache geokodowania `map_locations`).
- `E2E_SUPABASE_SERVICE_ROLE_KEY` (starszy token JWT) służy **wyłącznie** testom E2E w
  `e2e/` i **nigdy** nie jest czytany w kodzie aplikacji.
- Wartości anon-key i DSN są poprzedzone `NEXT_PUBLIC_` i mogą być eksponowane
  w przeglądarce — nie zawierają one uprawnień administracyjnych.

## Uruchamianie

Po zainstalowaniu zależności:

```bash
pnpm dev
```

Aplikacja uruchomi się pod adresem [`http://localhost:3000`](http://localhost:3000).

## Skrypty

| Skrypt | Co robi |
|---|---|
| `pnpm dev` | Uruchamia serwer deweloperski Next.js. |
| `pnpm build` | Buduje aplikację produkcyjną (z uploadem sourcemapów do Sentry). |
| `pnpm start` | Uruchamia produkcyjny serwer Next.js z buildu. |
| `pnpm lint` | Uruchamia ESLint (flat config, `eslint-config-next`). |
| `pnpm typecheck` | Statyczna weryfikacja typów TypeScript (`tsc --noEmit`). |
| `pnpm test:unit` | Uruchamia testy jednostkowe — wszystkie `*.test.mjs` w `scripts/`. |
| `pnpm test:e2e` | Uruchamia testy E2E w Playwright (`e2e/`). |

## Baza danych / migracje

Projekt używa **Supabase** (Postgres). Migracje znajdują się w
`supabase/migrations/` i są numerowane sekwencyjnie (`0001_` … `0009_`),
obejmując m.in. początkowy schemat, RPC dla dzieci, prawa service role oraz tabelę
`map_locations`. Testy RLS znajdują się w `supabase/tests/rls_security_tests.sql`.

### Wypychanie migracji

Upewnij się, że masz [Supabase CLI](https://supabase.com/docs/tools/cli) zainstalowany
i zalogowany (`supabase login`).

**Zdalny projekt (produkcja / staging):**

```bash
supabase db push
```

Wypycha nowe migracje z `supabase/migrations/` na wybrany projekt Supabase
(zidentyfikowany w `supabase/config.toml` albo poprzez flagę `--project-id`).

**Lokalny stack (rekomendowane dla devs):**

```bash
supabase start       # uruchom lokalny Postgres + Auth + Realtime
supabase db reset    # zastosuj wszystkie migracje od zera
```

Do testów jednostkowych/geokodowych lokalny stack pozwala uruchomić backfill mapy
bez ryzyka dla danych produkcyjnych:

```bash
node --env-file=.env.local scripts/backfill-map-locations.mjs --dry-run
```

## Testy

### Testy jednostkowe

```bash
pnpm test:unit
```

Testy to skrypty Node (`.test.mjs` w `scripts/`) uruchamiane przez wbudowany
runner (zob. skrypt `test:unit` w `package.json`). Cień testy jednostkowe
zawierają asercje na logice domenowej: rozprzestrzenianie markerów mapowych,
lokalizację glifów, style mapy, awatary i przycinanie zdjęć.

### Testy E2E

```bash
pnpm test:e2e
```

Playwright uruchamia scenariusze w `e2e/` (auth, profil, enrollment, mapa,
administracja, izolacja). Konfiguracja w `playwright.config.ts`:

- `globalSetup` tworzy konta testowe i nasionki (rodziny, admina) przy użyciu
  uprzywilejowanego klienta (`E2E_SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY`
  do odczytu kodów OTP z maili).
- Domyślnie pracują na `localhost:3000` (`PLAYWRIGHT_BASE_URL`).
- Mutacje na **zdalnym** Supabase są zablokowane, chyba że ustawiono
  `E2E_ALLOW_REMOTE_SUPABASE=true`.

> Testy E2E wymagają `.env.local` z `NEXT_PUBLIC_SUPABASE_URL`,
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY` oraz
> `RESEND_API_KEY`.

### Testy RLS (SQL)

Bezpieczeństwo RLS w bazie można zweryfikować ręcznie na lokalnym stacku:

```bash
supabase start
psql "$(supabase db remote commit --yes 2>/dev/null || echo 'postgres://postgres:postgres@localhost:5432/postgres')" \
  -f supabase/tests/rls_security_tests.sql
```

> Przykładowa komenda zakłada lokalny stack; dla zdalnego projektu użyj
> `supabase db connection-string`.

## Deployment

### Vercel (zalecane)

Ohana jest Next.js app, który builduje się jako aplikacja stojąca samodzielnie
lub jako funkcje serwerowe. Na platformie Vercel:

1. Podłącz repozytorium.
2. Ustaw wszystkie zmienne środowiskowe produkcyjne w ustawieniach projektu
   (Environment Variables). Do produkcji należy dodać:
   - `NEXT_PUBLIC_SUPABASE_URL` — publiczna
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publiczna
   - `NEXT_PUBLIC_SENTRY_DSN` — publiczna
   - `SUPABASE_SERVICE_ROLE_KEY` — **prywatna** (server-only)
   - `RESEND_API_KEY` — **prywatna**
   - `SENTRY_AUTH_TOKEN` — **prywatna** (do uploadu sourcemapów w trakcie builda)
   - `NOMINATIM_BASE_URL`, `OHANA_USER_AGENT` (opcjonalnie)
3. Build command: `pnpm build`, output directory: `.next`.

### Deployment ręczny (standalone / VPS)

```bash
pnpm build
node --input-type=module <(pnpm next start -h >/dev/null 2>&1 && echo 'next start' | pnpm next start)
```

Standardowo: po `pnpm build` uruchom `pnpm start`. Do produkcji wymagane są
wszystkie zmienne z sekcji [Bezpieczeństwo](#bezpieczeństwo) oraz
`SENTRY_AUTH_TOKEN` dla sourcemapów. Aplikacja nie wymaga dodatkowych portów
aniami — mapy pobierają tile'y bezpośrednio z OpenFreeMap w przeglądarce.

#### Sentry — sourcemapy

Upload sourcemapów wymaga `SENTRY_AUTH_TOKEN` z uprawnieniem do zapisu
sourcemapów (scope: `sourcemaps`). Bez niego `next build` pominie upload, ale
aplikacja nadal działa (Sentry po stronie klienta używa `NEXT_PUBLIC_SENTRY_DSN`).

## Mapy — architektura

Interaktywna mapa `/mapa` opiera się na:

- **MapLibre GL JS** (`maplibre-gl` v6.4.1) renderującym tile'y z
  **OpenFreeMap** — publiczna instancja, styl `positron` (jasny styl drogowy).
  **Brak API key ani rejestracji.** Atrybucja „© OpenStreetMap contributors”
  dodawana automatycznie przez MapLiberę.
- **Geokodowanie** (adres → współrzędne) wykonuje **wyłącznie serwer** przez
  **publiczny Nominatim** (`https://nominatim.openstreetmap.org`). Klient nigdy
  nie wysyła lat/lng ani nie geoukoduje — chroni to wspólny cache.
- **Cache lokalizacji** w tabeli `map_locations`. Nie wysyłamy ponownnie
  zapytania dla istniejącej w cache lokalizacji. Zapis do cache odbywa się
  uprzywilejowanym klientem serwerowym (`SUPABASE_SERVICE_ROLE_KEY`).

Zasady (zgodne z Nominatim Usage Policy i OpenFreeMap):

- **1 żądanie/s na aplikację** — throttle w `NominatimGeocoder` + trwały cache.
- Geokodowanie **wyłącznie na akcję użytkownika** (zapis / toggle `map_visible`).
  **Jednorazowy, idempotentny backfill** z throttlingiem — **nigdy nie przy
  otwarciu `/mapa`** i **brak autocomplete/search** na publicznym Nominatim.
- Własny `User-Agent` identyfikujący Ohanę (nadpisywalny: `OHANA_USER_AGENT`).
- Geokoder jest ukryty za **interfejsem** (`src/lib/maps/geocoder.ts`), aby
  dostawcę (Nominatim → MapTiler/Google/Apple) wymienić bez przebudowy aplikacji.

### Worker MapLibre

Next.js nie bundle'uje workera do chunków, więc `defaultWorkerUrl()` wskazujełby
nieistniejący plik i tile'y wektorowe się nie ładowały. Fix:

- `public/maplibre-gl-worker.mjs` i `public/maplibre-gl-shared.mjs` (skopiowane
  z `node_modules/maplibre-gl/dist/`).
- `maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs")` ustawiane w `FamilyMap.tsx`.
- `warmUpWorker()` w `FamilyMap.tsx` pinguje workera przed utworzeniem mapy, bo
  przy zimnym starcie moduł + import shared mogą nie zdążyć założyć nasłuchu
  przed `loadTile` (przeglądarka kolejkuje `postMessage` do zakończenia oceny
  modułu).

## Linki dla deweloperów

- [`AGENTS.md`](./AGENTS.md) — pełny przewodnik agenta: stos,
  aliasy ścieżek (`@/*`), locale (PL), architektura map, sekrety Supabase.
- [`src/lib/supabase/`](./src/lib/supabase) — klienci Supabase (anon, server,
  service-role).
- [`src/lib/maps/geocoder.ts`](./src/lib/maps/gecoder.ts) — adapter geokodera.
- [`scripts/backfill-map-locations.mjs`](../scripts/backfill-map-locations.mjs) —
  skrypt backfillu mapy.
- [`supabase/migrations/`](./supabase/migrations) — migracje bazy danych.
- [`e2e/`](./e2e) — testy E2E i ich konfiguracja.

---

> Aplikacja jest prywatnym projektem edukacyjnym. Wszystkie dane osobowe
> przetwarzane są zgodnie z polskim prawem ochrony danych osobowych (RODO).
