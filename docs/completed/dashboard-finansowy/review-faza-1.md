# Code Review - Faza 1: Fundament (RE-REVIEW po cyklu fix)

**Branch:** `feature/dashboard-finansowy`
**Commity:** 32eeb8b, eb7eb65, 44cbabe, 3a33c74 (fix)
**Data review:** 2026-04-12
**Poprzedni review:** 1x P1, 6x P2, 5x P3
**Stack:** React 19 + Vite 5.4 + TailwindCSS v4 | Fastify 5 + TypeScript | PostgreSQL 16 | pnpm monorepo

---

## Severity Gate: KONTYNUUJ Z ZASTRZEZENIAMI

**P1 (blocking): 0 | P2 (important): 1 | P3 (nit): 5 (z czego 5 pre-existing)**

---

## Weryfikacja napraw z cyklu 1

### 1. JWT_SECRET hardcoded fallback (bylo P1-blocking)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/src/server.ts:12-18`
- **Weryfikacja:** `getJwtSecret()` rzuca `Error("JWT_SECRET environment variable is required")` gdy brak zmiennej. Brak fallbacku. Serwer nie wystartuje bez ustawionego sekretu.

### 2. CORS origin: true (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/src/server.ts:41`
- **Weryfikacja:** `origin: process.env.CORS_ORIGIN || "http://localhost:5173"` -- restrykcyjne. `CORS_ORIGIN` dodane do `.env.example`.

### 3. Body validation na login (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/src/auth/login.ts:19-26`
- **Weryfikacja:** JSON Schema z `required: ["password"]`, `minLength: 1`, `additionalProperties: false`. Fastify waliduje automatycznie i zwraca 400 przy niepoprawnym body.

### 4. Rate limiting na login (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/src/auth/login.ts:34-37`, `packages/backend/src/server.ts:36-38`
- **Weryfikacja:** `@fastify/rate-limit` zarejestrowany z `global: false`. Login endpoint ma per-route config `max: 5, timeWindow: "1 minute"`. Pakiet dodany do dependencies.

### 5. pino-pretty w production (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/src/server.ts:21-30`
- **Weryfikacja:** `isProduction` check -- JSON logs w produkcji, pino-pretty tylko w dev.

### 6. pino-pretty w dependencies (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/backend/package.json:26`
- **Weryfikacja:** `"pino-pretty": "^13.0.0"` dodane do devDependencies.

### 7. Frontend testy (bylo P2-important)
- **Status:** NAPRAWIONE POPRAWNIE
- **Plik:** `packages/frontend/src/app.test.tsx`
- **Weryfikacja:** 2 testy renderowania App (title + group name), oba przechodzace. Testing library i jsdom w devDependencies.

---

## Nowe findings po fixie

### N1. Brak testow dla nowych mechanizmow ochronnych
- **Severity:** 🟠 [P2-important]
- **Typ:** TEST
- **Plik:** `packages/backend/src/auth/__tests__/auth.test.ts`
- **Problem:** Fix dodal 3 nowe mechanizmy (body validation, rate limiting, JWT_SECRET throw), ale nie dodal testow weryfikujacych ich dzialanie:
  - Brak testu: `POST /api/auth/login` z pustym body lub brakujacym `password` powinno zwrocic 400
  - Brak testu: `POST /api/auth/login` po 5 probach powinno zwrocic 429 (rate limit)
  - Brak testu: `buildApp()` bez JWT_SECRET rzuca Error
  - Test app w auth.test.ts nie rejestruje `@fastify/rate-limit`
- **Fix:** Dodaj 3 testy: (1) invalid body -> 400, (2) rate limit -> 429 (wymaga rejestracji rate-limit w test app), (3) buildApp() bez JWT_SECRET -> throws.

---

## Pre-existing P3 (nit) -- bez zmian

| # | Plik | Problem |
|---|---|---|
| 1 | `packages/backend/src/auth/login.ts:9-13` | Timing-safe compare leakuje informacje o dlugosci hasla |
| 2 | `packages/backend/src/db/seed-liabilities.ts:209-227` | N+1 inserts w petli zamiast batch |
| 3 | `packages/backend/src/db/seed-entities.ts:20-28` | N+1 inserts w petli zamiast batch |
| 4 | `packages/backend/package.json`, `packages/frontend/package.json` | Lint script to echo, brak konfiguracji lintera |
| 5 | `packages/backend/src/db/connection.ts:7-11` | Module-level side effect przy tworzeniu sql client |

---

## Wyniki testow

### Typecheck
- Backend: CZYSTE (0 bledow)
- Frontend: CZYSTE (0 bledow)

### Testy
- Backend: 18 passed, 5 skipped (DB integration), 0 failed
- Frontend: 2 passed, 0 failed
- **Lacznie: 20 passed, 5 skipped, 0 failed**

### E2E
- 0 passed / 0 failed (7 weryfikacji wymaga infrastruktury -- Docker + running servers)
- Scenariusze 6-7 (auth behavior) pokryte unit testami

---

## Odchylenia od planu

Brak odchylen. Implementacja zgodna z planem technicznym.

---

## Podsumowanie skonsolidowane

| # | Severity | Typ | Zrodlo | Opis |
|---|---|---|---|---|
| N1 | 🟠 P2 | TEST | Nowy (po fix) | Brak testow dla body validation, rate limiting, JWT_SECRET throw |
| 1 | 🟡 P3 | KOD | Pre-existing | Timing-safe compare leakuje dlugosc |
| 2 | 🟡 P3 | KOD | Pre-existing | N+1 inserts w seed-liabilities |
| 3 | 🟡 P3 | KOD | Pre-existing | N+1 inserts w seed-entities |
| 4 | 🟡 P3 | KOD | Pre-existing | Brak linter configuration |
| 5 | 🟡 P3 | KOD | Pre-existing | connection.ts module-level side effect |
