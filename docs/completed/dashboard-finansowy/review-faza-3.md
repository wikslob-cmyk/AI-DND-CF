# Code Review Fazy 3 — Dashboard: widoki i formularz

**Data review:** 2026-04-12
**Branch:** `feature/dashboard-finansowy`
**Commity:** 4b53d0b, dd82576, 7926c50
**Severity gate:** KONTYNUUJ Z ZASTRZEZENIAMI (0x P1, 6x P2, 8x P3)

## Statystyki

- Plikow sprawdzonych: 52
- P1 [blocking]: 0
- P2 [important]: 6
- P3 [nit]: 8
- Typy findingow:
  - KOD: 6 (2x P2, 4x P3)
  - TEST: 5 (3x P2, 2x P3)
  - E2E: 3 (1x P2, 2x P3)
- Backend testy: 91 passed, 5 skipped, 0 failed
- Frontend testy: 14 passed, 0 failed
- Typecheck: czysty (backend + frontend)

## Findings

### P2 [important]

#### 1. [KOD] Brak walidacji `entity` query param na backendzie
**Pliki:** `packages/backend/src/routes/receivables.ts:21`, `payables.ts:22`, `liabilities.ts:27-66`, `forecast.ts` (brak filtra entity), `dashboard-summary.ts:20`, `warehouse.ts:10`
**Opis:** Parametr `entity` z query string jest przekazywany bezposrednio do SQL query bez walidacji. Dowolna wartosc (np. `entity='; DROP TABLE--`) trafi do parametrized query (wiec SQL injection nie grozi), ale nieprawidlowa wartosc (np. `entity=xxx`) zwroci puste dane bez bledu 400. Brakuje walidacji czy `entity` jest jednym z dozwolonych kodow (`all`, `cgesp`, `dngro`, `dndsp`, `tdmsp`, `tdpsp`). Dotyczy WSZYSTKICH 7 route modulow.
**Rekomendacja:** Dodaj walidacje entity na poczatku kazdego handlera — zwroc 400 jesli wartosc nie jest z dozwolonej listy.

#### 2. [KOD] Masywna duplikacja SQL w receivables.ts (192 linii)
**Plik:** `packages/backend/src/routes/receivables.ts:19-110`
**Opis:** Funkcja `queryInvoices` zawiera 6 prawie identycznych blokow SQL (3 periody x 2 entity warianty). Kazdy blok rozni sie 1-2 warunkami WHERE. To 90+ linii zduplikowanego kodu ktory jest trudny do utrzymania — zmiana w jednym JOINie wymaga edycji 6 miejsc. Ten sam wzorzec duplikacji dotyczy `dashboard-summary.ts` (245 linii z powtarzajacymi sie blokami SQL).
**Rekomendacja:** Wyodrebnij budowanie warunkow do helpera lub uzyj dynamicznego budowania WHERE clause zachowujac parametrized queries.

#### 3. [TEST] Brak testow frontend dla nowych komponentow Fazy 3
**Pliki:** Brak testow dla: `login-page.tsx`, `entity-tabs.tsx`, `summary-page.tsx`, `summary-cards.tsx`, `receivables-page.tsx`, `invoice-table.tsx`, `payables-page.tsx`, `liabilities-page.tsx`, `liability-list.tsx`, `liability-timeline.tsx`, `forecast-page.tsx`, `warehouse-page.tsx`, `monthly-input-form.tsx`, `monthly-input-page.tsx`, `dashboard-layout.tsx`
**Opis:** 15 nowych komponentow frontend bez jakichkolwiek testow (app.test.tsx testuje tylko LoginPage render). Plan techniczny definiowal scenariusze E2E ale nie unit testy komponentow — mimo to brak pokrycia jest istotny, poniewaz te komponenty zawieraja logike (formatowanie, warunki renderowania, React Query hooks).
**Rekomendacja:** Dodaj minimum smoke testy (renders without error, shows expected labels) dla kluczowych komponentow: SummaryCards, InvoiceTable, EntityTabs, MonthlyInputForm.

#### 4. [TEST] Brak testu error handling w route handlerach
**Pliki:** `packages/backend/src/routes/__tests__/*.test.ts`
**Opis:** Testy pokrywaja happy path (poprawne dane) i jeden edge case (brak danych). Brak testow dla: brak autoryzacji (tylko payables.test.ts to testuje), bledne parametry query (np. `period=invalid`), blad bazy danych (mockSql throws).
**Rekomendacja:** Dodaj test "returns 401 without auth" do kazdego route test suite + test bladu DB.

#### 5. [TEST] forecast.ts nie filtruje po entity — brak filtra per podmiot
**Plik:** `packages/backend/src/routes/forecast.ts:36-62`
**Opis:** Endpoint `/api/forecast` nie akceptuje parametru `entity`. Pobiera WSZYSTKIE naleznosci ze wszystkich podmiotow. Plan wymaga widoku prognozy per podmiot (EntityTabs sa w frontend), ale backend nie obsluguje filtrowania. Frontend wysyla `/api/forecast?days=30` bez entity — co jest poprawne dla widoku grupy, ale nie da sie filtrowac per podmiot.
**Rekomendacja:** Dodaj parametr `entity` do forecast route (analogicznie do receivables).

#### 6. [E2E] Root vitest.config nie rozdziela backend/frontend test runners
**Plik:** Brak root-level vitest workspace config
**Opis:** Uruchomienie `pnpm test` lub `npx vitest` z roota projektu laczy backend i frontend testy w jednym runnerze BEZ jsdom environment — co powoduje 11 failujacych testow frontend (ReferenceError: document is not defined). Testy przechodza poprawnie gdy uruchomione z packages/backend i packages/frontend oddzielnie, ale brak workspace config oznacza ze CI/CD moze false-positive failowac.
**Rekomendacja:** Dodaj `vitest.workspace.ts` w root lub skonfiguruj root scripts z `--filter` flagami.

### P3 [nit]

#### 1. [KOD] dashboard-summary.ts — 8 sekwencyjnych zapytan SQL
**Plik:** `packages/backend/src/routes/dashboard-summary.ts:31-224`
**Opis:** Endpoint summary wykonuje 8 osobnych zapytan SQL sekwencyjnie (receivables, payables, schedule, rolling, balance, warehouse, import, overdue). Kazde czeka na poprzednie. Mozna zrownoleglnic z Promise.all — zyskujac ~4-6x latency reduction.

#### 2. [KOD] Hardcoded years w MonthlyInputForm
**Plik:** `packages/frontend/src/features/monthly-input/monthly-input-form.tsx:186`
**Opis:** `[2024, 2025, 2026, 2027]` — lista lat jest hardcoded. W 2028 formularz nie pozwoli wybrac biezacego roku.
**Rekomendacja:** Generuj dynamicznie np. `[currentYear-2, currentYear-1, currentYear, currentYear+1]`.

#### 3. [KOD] Duplikacja logiki przeliczania walut
**Pliki:** `receivables.ts:125-128`, `forecast.ts:95-98`
**Opis:** Identyczna logika `row.currency === "PLN" ? Number(row.remaining_amount) : Number(row.remaining_amount) * ratePln` powtarza sie w kilku plikach.
**Rekomendacja:** Wyciagnij do `toAmountPln(currency, amount, ratePln)` helper.

#### 4. [KOD] LoginPage nie sprawdza czy user jest juz zalogowany
**Plik:** `packages/frontend/src/features/auth/login-page.tsx`
**Opis:** Brak sprawdzenia `/api/auth/me` przy ladowaniu — zalogowany user moze zobaczyc login page zamiast redirect do dashboard.

#### 5. [E2E] 0/13 weryfikacji E2E wykonanych
**Pliki:** `dashboard-finansowy-zadania.md` — 13 niezaznaczonych checkboxow "Weryfikacja:"
**Opis:** Zadne weryfikacje E2E nie zostaly wykonane. Wymagaja dzialajacego frontendu + backendu + bazy z danymi.

#### 6. [E2E] EntityTabs nie propaguje entity do wszystkich widokow
**Plik:** `packages/frontend/src/features/dashboard/summary-page.tsx`, `receivables-page.tsx`, etc.
**Opis:** Kazda strona samodzielnie zarzadza stanem `entity` przez lokalny useState. Zmiana zakladki na jednej stronie nie przenosi sie na inna strone (routing). To UX nit — nie bug.

#### 7. [TEST] Brak testu dla GET /api/monthly-input z NaN year/month
**Plik:** `packages/backend/src/routes/__tests__/monthly-input.test.ts`
**Opis:** Kod obsluguje NaN (linia 69-77), ale brak testu weryfikujacego ten branch.

#### 8. [TEST] Brak testu walidacji PUT body schema
**Plik:** `packages/backend/src/routes/__tests__/monthly-input.test.ts`
**Opis:** PUT /api/monthly-input ma JSON Schema validation (PUT_SCHEMA), ale brak testu na niepoprawne body (np. brak required field, string zamiast number).

## Odchylenia od planu technicznego

### Brak filtra entity w forecast
Plan (Unit 11) nie specyfikowal parametru entity dla forecast, ale EntityTabs sa uzywane w UI co sugeruje ze filtrowanie per podmiot jest oczekiwane. Minimalne odchylenie.

### Struktura plikow zgodna z planem
Wszystkie pliki zdefiniowane w Implementation Units 8-12 zostaly stworzone. Dodatkowe pliki: `lib/utils.ts`, 6x `components/ui/*.tsx` (shadcn/ui) — uzasadnione.

### Testy — scenariusze jednostkowe zrealizowane
Wszystkie scenariusze testowe z planu (Unit tests) zrealizowane. E2E scenariusze odlozone (wymagaja infrastruktury).

## Podsumowanie agentow

### Agent 1 (Security)
- Brak SQL injection — parametrized queries wszedzie
- Brak walidacji entity query param (P2) — moze zwracac puste dane dla nieprawidlowego podmiotu
- Auth middleware na kazdym route — OK
- CORS restrykcyjne (z Fazy 1 fix) — OK
- Brak rate limiting na data endpoints — akceptowalne (chronione JWT)

### Agent 2 (Performance)
- 8 sekwencyjnych SQL w dashboard-summary (P3)
- Brak N+1 queries — OK
- Lazy loading na wszystkich route'ach — OK
- React Query caching — OK
- Brak paginacji na duzych zbiorach (invoice, warehouse) — akceptowalne dla obecnej skali

### Agent 3 (Architecture)
- Duplikacja SQL w receivables (P2)
- Pliki w limicie 300 linii (max: liabilities.ts 258) — OK
- Importy poprawnie grouped — OK
- Brak circular dependencies — OK
- Standardowy response format `{ data }` — OK
- Brak `any` types — OK
- Brak `console.log` — OK

### Agent 4 (Test Coverage)
- Backend: 20 nowych testow, scenariusze z planu pokryte — OK
- Frontend: 0 nowych testow dla 15 komponentow (P2)
- Brak error path testow (P2)
- Brak testu NaN validation i schema validation (P3)

### Agent 5 (E2E)
- 0/13 weryfikacji wykonanych (wymaga infrastruktury)
- Root vitest nie rozdziela runnerow (P2)
- Entity state nie jest wspoldzielony miedzy stronami (P3 UX nit)
