# Dashboard finansowy — Zadania

Branch: `feature/dashboard-finansowy`
Ostatnia aktualizacja: 2026-04-12 (Faza 5 ukończona)

---

## Faza 1: Fundament

### Unit 1: Scaffolding monorepo + konfiguracja [L]

**Implementacja:**
- [x] Stwórz `pnpm-workspace.yaml` z `packages/*`
- [x] Stwórz root `package.json` z workspace config
- [x] Stwórz `tsconfig.base.json` (strict mode, path aliases)
- [x] Stwórz `.nvmrc` (Node 22 LTS)
- [x] Stwórz `.gitignore` (node_modules, dist, .env, *.log)
- [x] Stwórz `.env.example` (DATABASE_URL, DASHBOARD_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY, NBP_API_URL)
- [x] Stwórz `packages/shared/package.json` + `tsconfig.json`
- [x] Stwórz `packages/shared/src/index.ts` (EntityCode, InvoiceType, enums)
- [x] Stwórz `packages/backend/package.json` (fastify, @fastify/cors, @fastify/cookie, @fastify/multipart, postgres)
- [x] Stwórz `packages/backend/tsconfig.json`
- [x] Stwórz `packages/backend/src/server.ts` (Fastify bootstrap, health endpoint)
- [x] Stwórz `packages/frontend/package.json` (react 19, vite, tailwindcss v4, @tanstack/react-query)
- [x] Stwórz `packages/frontend/tsconfig.json`
- [x] Stwórz `packages/frontend/vite.config.ts` (proxy /api → localhost:3001)
- [x] Stwórz `packages/frontend/index.html`
- [x] Stwórz `packages/frontend/src/main.tsx`
- [x] Stwórz `packages/frontend/src/app.tsx`
- [x] Stwórz `docker-compose.yml` (PostgreSQL 16 na porcie 5432, volume)
- [x] Uruchom `pnpm install` + zweryfikuj brak błędów

**Testy:**
- [x] Test: `pnpm install` wykonuje się bez błędów
- [x] Test: `pnpm --filter backend dev` startuje Fastify na porcie 3001
- [x] Test: `pnpm --filter frontend dev` startuje Vite na porcie 5173 z proxy
- [x] Test: TypeScript kompiluje się bez błędów we wszystkich packages

**Weryfikacja:**
- [ ] Weryfikacja: Oba serwery dev startują poprawnie
- [ ] Weryfikacja: Frontend proxy przekierowuje `/api/*` do backendu
- [ ] Weryfikacja: PostgreSQL dostępny z docker-compose

---

### Unit 2: Schema bazy danych + migracje [M]

**Implementacja:**
- [x] Stwórz `packages/backend/src/db/connection.ts` (postgres client z DATABASE_URL)
- [x] Stwórz `packages/backend/src/db/migrations/001-initial-schema.sql` (entity, import_log, invoice, exchange_rate, liability, liability_schedule, warehouse_item, monthly_input + indeksy)
- [x] Stwórz `packages/backend/src/db/migrate.ts` (runner: tabela _migrations, idempotentne wykonanie)
- [x] Stwórz `packages/backend/src/db/seed-entities.ts` (5 podmiotów: cgesp, dngro, dndsp, tdmsp, tdpsp)
- [x] Stwórz `packages/backend/src/db/seed-liabilities.ts` (15 pozycji master + ING limit/faktoring + pozycje informacyjne)
- [x] Stwórz `packages/backend/src/db/__tests__/migrations.test.ts`

**Testy:**
- [x] Test: Migracja tworzy wszystkie tabele i indeksy
- [x] Test: Seed wstawia 5 encji i 15 pozycji liability
- [x] Test: Powtórne uruchomienie migracji jest idempotentne
- [x] Test: UNIQUE constraint na monthly_input(entity_code, year, month) działa

**Weryfikacja:**
- [ ] Weryfikacja: Wszystkie tabele istnieją z poprawnymi typami kolumn
- [ ] Weryfikacja: Seed data obecna w entity i liability

---

### Unit 3: Autoryzacja (shared password + JWT) [S]

**Implementacja:**
- [x] Stwórz `packages/backend/src/auth/constants.ts` (cookie config, JWT expiry 30d)
- [x] Stwórz `packages/backend/src/auth/login.ts` (POST /api/auth/login — timing-safe compare, JWT → HttpOnly cookie)
- [x] Stwórz `packages/backend/src/auth/middleware.ts` (onRequest hook — verify JWT, 401)
- [x] Zarejestruj @fastify/jwt i @fastify/cookie w server.ts
- [x] Stwórz `packages/backend/src/auth/__tests__/auth.test.ts`

**Testy:**
- [x] Test: Poprawne hasło → 200 + cookie z JWT
- [x] Test: Błędne hasło → 401
- [x] Test: Request bez cookie → 401 na chronionym endpoint
- [x] Test: Request z ważnym JWT → 200
- [x] Test: Request z expired JWT → 401
- [ ] Test: [E2E] Formularz logowania → wpisanie hasła → redirect do dashboardu

**Weryfikacja:**
- [ ] Weryfikacja: Chronione endpointy zwracają 401 bez JWT i 200 z JWT
- [ ] Weryfikacja: Cookie jest HttpOnly i Secure

---

## Do poprawy po review fazy 1

- [x] 🔴 [blocking] **packages/backend/src/server.ts:10** — JWT_SECRET ma hardcoded fallback "dev-secret-change-in-production". Usun fallback, rzuc blad gdy brak env var.
- [x] 🟠 [important] **packages/backend/src/server.ts:23** — CORS `origin: true` akceptuje kazdy origin. Ogranicz do `process.env.CORS_ORIGIN || "http://localhost:5173"`.
- [x] 🟠 [important] **packages/backend/src/auth/login.ts:21-25** — Brak walidacji body na endpoint login. Dodaj JSON Schema lub Zod validation.
- [x] 🟠 [important] **packages/backend/src/auth/login.ts** — Brak rate limiting na endpoint login. Dodaj `@fastify/rate-limit`.
- [x] 🟠 [important] **packages/backend/src/server.ts:14-18** — pino-pretty zawsze wlaczone (tez w produkcji). Wlacz tylko dla `NODE_ENV !== 'production'`.
- [x] 🟠 [important] **packages/backend/package.json** — pino-pretty nie jest w dependencies. Dodaj do devDependencies.
- [x] 🟠 [important] **packages/frontend/** — Brak jakichkolwiek testow frontend. Dodaj minimalny test renderowania App.
- [x] 🟠 [important] **packages/backend/src/auth/__tests__/auth.test.ts** — Brak testow dla body validation (400), rate limiting (429), JWT_SECRET throw. Fix dodal mechanizmy ale nie testy.
- [ ] 🟡 [nit] **packages/backend/src/auth/login.ts:11-12** — Timing-safe compare leakuje informacje o dlugosci hasla.
- [ ] 🟡 [nit] **packages/backend/src/db/seed-liabilities.ts:209-227** — N+1 inserts w petli zamiast batch.
- [ ] 🟡 [nit] **packages/backend/src/db/seed-entities.ts:20-28** — N+1 inserts w petli zamiast batch.
- [ ] 🟡 [nit] **packages/backend/package.json, packages/frontend/package.json** — Lint script to echo, brak konfiguracji lintera.
- [ ] 🟡 [nit] **packages/backend/src/db/connection.ts:7-11** — Module-level side effect przy tworzeniu sql client.

---

## Faza 2: Pipeline ingestion

### Unit 4: Parser plików Saldeo (Excel) [L]

**Implementacja:**
- [x] Stwórz `packages/backend/src/parsers/types.ts` (ParsedInvoice interface, ValidationError)
- [x] Stwórz `packages/backend/src/parsers/nip-normalizer.ts` (usuwanie spacji, myślników, "PL", walidacja 10 cyfr)
- [x] Stwórz `packages/backend/src/parsers/saldeo-parser.ts`:
  - Walidacja nagłówków wiersz 3, wymagane kolumny
  - Filtr regex `^[A-Z]+_FS_$` (należności) i `^[A-Z]+_FZ_$` (zobowiązania)
  - Kwota z `Pozostało do zapłaty`, nie `Wartość brutto`
  - Entity code z nazwy pliku
- [x] Stwórz `packages/backend/src/parsers/__tests__/saldeo-parser.test.ts`
- [x] Stwórz `packages/backend/src/parsers/__tests__/nip-normalizer.test.ts`

**Testy:**
- [x] Test: Parsowanie `lista-dokumentow-cgesp.xlsx` → poprawna lista należności i zobowiązań
- [x] Test: Filtr `_FS_` nie łapie `_FS_PF_` ani `_FS_KOR_`
- [x] Test: Filtr `_FZ_` łapie tylko exact `_FZ_`
- [x] Test: Plik z brakującą kolumną → ValidationError z nazwą brakującej kolumny
- [x] Test: NIP z myślnikami "123-456-78-90" → "1234567890"
- [x] Test: NIP z prefixem "PL" → usunięty
- [x] Test: Faktura z `Zapłacono = TAK` → wykluczona
- [x] Test: Faktura z `Remaining = 0` i `Zapłacono = NIE` → dołączona (edge case)

**Weryfikacja:**
- [ ] Weryfikacja: Parser poprawnie przetwarza wszystkie 5 plików z `zasoby/`
- [ ] Weryfikacja: Walidacja struktury odrzuca uszkodzony plik

---

### Unit 5: Parser harmonogramów (Excel + PDF) [XL]

**Implementacja:**
- [x] Stwórz `packages/backend/src/parsers/schedule-types.ts` (ParsedScheduleEntry, ScheduleParseError)
- [x] Stwórz `packages/backend/src/parsers/schedule-parser-excel.ts`:
  - Parser per format/plik harmonogramu Excel
  - Mapowanie: tabela_rat_wynagrodzenia, tabela_rat_364944, harmonogram_splat_EFL_*, harmonogram_santander_*, Harmonogram_platnosci-dndgr-mercedes, TDM-leas
- [x] Stwórz `packages/backend/src/parsers/schedule-parser-pdf.ts`:
  - Parser czytelnych PDF: Harmonogram.pdf (Alior), Harmonogram spłat_nr umowy 01450_PI_24.pdf (PKO), DNDspzoo-leasing.pdf
  - LFR.pdf → ScheduleParseError("Skan PDF, wymaga ręcznego wpisu")
- [x] Stwórz `packages/backend/src/parsers/__tests__/schedule-parser.test.ts`

**Notatka:** Zacznij od jednego pliku Excel (tabela_rat_364944.xlsx) jako wzorca, potem rozszerz.

**Testy:**
- [x] Test: Parsowanie `tabela_rat_364944.xlsx` → lista rat z datami, kapitałem, odsetkami
- [x] Test: Parsowanie `Harmonogram.pdf` (Alior) → lista rat
- [x] Test: `LFR.pdf` → rzuca ScheduleParseError("Skan PDF, wymaga ręcznego wpisu")
- [x] Test: Parsowanie pliku z brakującymi kolumnami → ValidationError
- [x] Test: Sumy rat per harmonogram zgadzają się z kwotą kredytu

**Weryfikacja:**
- [ ] Weryfikacja: Parsery przetwarzają wszystkie pliki z `zasoby/zaobowiazania/` (oprócz LFR.pdf)
- [ ] Weryfikacja: Każdy harmonogram ma poprawne daty i kwoty

---

### Unit 6: Parser magazynu + integracja NBP API [M]

**Implementacja:**
- [x] Stwórz `packages/backend/src/parsers/warehouse-parser.ts`:
  - Nagłówki wielopoziomowe (wiersz 1-2)
  - Kolumny 9-11 (ilości), 15-17 (wartości), Cena (sprzedaży), Artykuł
  - Sumowanie komponent + gotowe per artykuł
  - Ignorowanie kolumny M (cena zakupu)
- [x] Stwórz `packages/backend/src/services/nbp-rates.ts`:
  - Fetch z `https://api.nbp.pl/api/exchangerates/rates/a/{currency}/?format=json`
  - Retry 3 × 2s backoff
  - Fallback: ostatni kurs z DB + warning
  - PLN → rate 1.0, nieznana waluta → error
- [x] Stwórz `packages/backend/src/parsers/__tests__/warehouse-parser.test.ts`
- [x] Stwórz `packages/backend/src/services/__tests__/nbp-rates.test.ts`

**Testy:**
- [x] Test: Parsowanie `Zestawienie magazynowe DND 10.04.26.xlsx` → lista artykułów z ilościami i wartościami
- [x] Test: Wartość per artykuł = ilość_total × cena_sprzedaży
- [x] Test: NBP API zwraca kurs EUR → zapis do DB
- [x] Test: NBP API niedostępne → fallback na ostatni kurs + warning
- [x] Test: Nieznana waluta (np. CHF) → error z opisem

**Weryfikacja:**
- [ ] Weryfikacja: Parser poprawnie czyta wielopoziomowe nagłówki
- [ ] Weryfikacja: Łączna wartość magazynu zgadza się z sumą w pliku
- [ ] Weryfikacja: Kursy walut zapisane w DB

---

### Unit 7: Orkiestrator importu (backend + UI upload) [L]

**Implementacja:**
- [x] Stwórz `packages/backend/src/import/orchestrator.ts`:
  - Waliduj strukturę wszystkich plików → fail fast
  - Pobierz kursy NBP (jeśli faktury walutowe)
  - BEGIN transaction → DELETE stare → INSERT nowe → COMMIT/ROLLBACK
  - INSERT import_log z details
- [x] Stwórz `packages/backend/src/import/routes.ts`:
  - POST /api/import/saldeo (multipart 5 plików)
  - POST /api/import/warehouse (multipart 1 plik)
  - POST /api/import/schedules (multipart harmonogramy)
  - GET /api/import/status
- [x] Stwórz `packages/frontend/src/features/import/import-page.tsx`
- [x] Stwórz `packages/frontend/src/features/import/file-dropzone.tsx` (drag-n-drop, walidacja typu)
- [x] Stwórz `packages/frontend/src/features/import/import-status.tsx` (ostatni import: data, status, warnings)
- [x] Stwórz `packages/backend/src/import/__tests__/orchestrator.test.ts`

**Testy:**
- [x] Test: Import 5 poprawnych plików → dane w DB, import_log status=success
- [x] Test: Import z 1 uszkodzonym plikiem → rollback, żadne dane nie zmienione, import_log status=failed
- [x] Test: Import nadpisuje poprzedni snapshot (stare invoice usunięte)
- [x] Test: Import z fakturami EUR → kurs NBP pobrany i zapisany
- [ ] Test: [E2E] Przeciągnij 5 plików → dropzone → kliknij "Importuj" → spinner → "Import zakończony" z datą
- [ ] Test: [E2E] Upload pliku z błędną strukturą → komunikat błędu z opisem problemu

**Weryfikacja:**
- [ ] Weryfikacja: Transakcyjność — błąd w jednym pliku = brak zmian w DB
- [ ] Weryfikacja: Status importu widoczny w UI z datą i listą plików

---

## Do poprawy po review fazy 2

- [x] 🟠 [important] **packages/backend/src/import/routes.ts:12-32** — Stub DbAdapter w production routes zwraca false positive "success". Dodaj warning w response lub disable endpointow do czasu prawdziwego DB adapter
- [x] 🟠 [important] **packages/backend/src/parsers/schedule-parser-excel.ts** — Plik 388 linii, podziel parsery per format do oddzielnych modulow
- [x] 🟠 [important] **packages/backend/src/import/orchestrator.ts** — Plik 346 linii, podziel na saldeo-importer.ts, warehouse-importer.ts, schedule-importer.ts
- [x] 🟠 [important] **packages/backend/src/parsers/schedule-parser-excel.ts:128,155** — Millennium parser uzywa `new Date()` jako paymentDate zamiast obliczonych dat z installmentNumber
- [x] 🟠 [important] **packages/frontend/src/features/import/** — Brak testow dla 3 nowych komponentow (import-page, file-dropzone, import-status)
- [x] 🟠 [important] **packages/backend/src/import/orchestrator.ts:178-193** — Rollback + insertImportLog moze rzucic niezlapany blad. Dodaj try-catch wokol rollback
- [x] 🟠 [important] **packages/backend/src/services/nbp-rates.ts:141** — Empty catch block polyka blad bez logowania. Dodaj log przed fallbackiem
- [ ] 🟡 [nit] **packages/backend/src/parsers/** — Duplikacja `toNumber()` w 3 plikach. Wyciagnij do `parsers/utils.ts`
- [ ] 🟡 [nit] **packages/backend/src/parsers/** — Duplikacja `parseDate()` w 2 plikach. Scal w shared helper
- [ ] 🟡 [nit] **packages/frontend/src/features/import/import-page.tsx:37-44** — Brak sprawdzenia `response.ok` przed `response.json()`
- [ ] 🟡 [nit] **packages/frontend/src/features/import/import-status.tsx:53** — `key={file}` moze powodowac duplikaty
- [ ] 🟡 [nit] **packages/backend/src/parsers/schedule-parser-pdf.ts:46-72** — parsePkoFormat identyczny z parseAliorFormat, mozna scalic
- [ ] 🟡 [nit] **packages/backend/src/import/routes.ts:122-131** — GET /api/import/status stub bez komentarza TODO

---

## Faza 3: Dashboard — widoki i formularz

### Unit 8: Layout dashboardu + nawigacja + R4 formularz [L]

**Implementacja:**
- [x] Stwórz `packages/frontend/src/lib/api-client.ts` (fetch wrapper z credentials: 'include')
- [x] Stwórz `packages/frontend/src/router.tsx` (React Router, lazy loading per route)
- [x] Stwórz `packages/frontend/src/layouts/dashboard-layout.tsx` (topbar + sidebar + entity tabs)
- [x] Stwórz `packages/frontend/src/features/auth/login-page.tsx` (formularz hasła)
- [x] Stwórz `packages/frontend/src/features/dashboard/entity-tabs.tsx` (Grupa, CGE, DND Group, DND, TDM, TDP)
- [x] Stwórz `packages/frontend/src/features/dashboard/dashboard-page.tsx` (wrapper per entity)
- [x] Stwórz `packages/frontend/src/features/monthly-input/monthly-input-form.tsx` (5 podmiotów × 3 pola + selector miesiąca)
- [x] Stwórz `packages/frontend/src/features/monthly-input/monthly-input-page.tsx`
- [x] Stwórz `packages/backend/src/routes/monthly-input.ts` (GET + PUT upsert)
- [x] Skonfiguruj shadcn/ui (Tabs, Card, Input, Button, Label, Select)
- [x] Skonfiguruj TailwindCSS v4 z custom OKLCH palette
- [x] Skonfiguruj React Query provider
- [x] Stwórz `packages/backend/src/routes/__tests__/monthly-input.test.ts`

**Testy:**
- [x] Test: PUT monthly-input → upsert w DB, 200
- [x] Test: PUT monthly-input z duplikatem (ten sam podmiot+miesiąc) → update
- [x] Test: GET monthly-input → dane dla podmiotu i miesiąca
- [ ] Test: [E2E] Login → dashboard → kliknij zakładkę "CGE" → widok CGE
- [ ] Test: [E2E] Formularz R4 → wypełnij VAT=5000, wynagrodzenia=20000, saldo=150000 → Submit → dane zapisane
- [ ] Test: [E2E] Zmiana miesiąca w R4 → formularz ładuje dane dla wybranego miesiąca

**Weryfikacja:**
- [ ] Weryfikacja: Dashboard ładuje się po zalogowaniu
- [ ] Weryfikacja: Zakładki przełączają widoki per podmiot
- [ ] Weryfikacja: Formularz R4 zapisuje i odczytuje dane

---

### Unit 9: Widoki należności i zobowiązań handlowych (R7a, R7b) [L]

**Implementacja:**
- [x] Stwórz `packages/shared/src/types/invoice.ts` (InvoiceRow, InvoiceGroup, PeriodType)
- [x] Stwórz `packages/backend/src/routes/receivables.ts`:
  - GET /api/receivables?entity=&period= z GROUP BY contractor_nip
  - Filtr: 7d=[dziś,dziś+7), 30d=[dziś+7,dziś+30), overdue=<dziś
  - JOIN exchange_rate dla przeliczenia walut
- [x] Stwórz `packages/backend/src/routes/payables.ts` (analogiczna struktura)
- [x] Stwórz `packages/frontend/src/features/receivables/invoice-table.tsx` (DataTable shadcn/ui, sumy per sekcja)
- [x] Stwórz `packages/frontend/src/features/receivables/receivables-page.tsx` (3 karty: 7d, 30d, overdue)
- [x] Stwórz `packages/frontend/src/features/payables/payables-page.tsx`
- [x] Stwórz `packages/backend/src/routes/__tests__/receivables.test.ts`
- [x] Stwórz `packages/backend/src/routes/__tests__/payables.test.ts`

**Testy:**
- [x] Test: GET receivables?entity=all&period=7d → należności z terminem w [dziś, dziś+7)
- [x] Test: GET receivables?entity=cgesp&period=overdue → przeterminowane CGE
- [x] Test: Faktura EUR przeliczona do PLN kursem z exchange_rate
- [x] Test: Agregacja per NIP w widoku skonsolidowanym — ten sam NIP z 2 podmiotów = 1 wiersz
- [ ] Test: [E2E] Dashboard → Należności → 3 sekcje widoczne → kwoty per kontrahent → suma na dole sekcji
- [ ] Test: [E2E] Przełączenie na zakładkę "CGE" → tylko należności CGE

**Weryfikacja:**
- [ ] Weryfikacja: Trzy sekcje z poprawnym podziałem czasowym
- [ ] Weryfikacja: Sumy PLN poprawne (w tym przeliczenia walutowe)
- [ ] Weryfikacja: Agregacja per NIP działa w widoku grupy

---

### Unit 10: Widok zobowiązań finansowych (R7c, R7f) [L]

**Implementacja:**
- [x] Stwórz `packages/shared/src/types/liability.ts` (LiabilityRow, ScheduleEntry, LiabilityType)
- [x] Stwórz `packages/backend/src/routes/liabilities.ts`:
  - GET /api/liabilities?entity=&type=
  - GET /api/liabilities/schedule?entity=&months=12
- [x] Stwórz `packages/frontend/src/features/liabilities/liability-list.tsx` (lista per podmiot, sekcja informacyjna)
- [x] Stwórz `packages/frontend/src/features/liabilities/liability-timeline.tsx` (grid: miesiące × pozycje, desktop-first)
- [x] Stwórz `packages/frontend/src/features/liabilities/liabilities-page.tsx`
- [x] Stwórz `packages/backend/src/routes/__tests__/liabilities.test.ts`

**Testy:**
- [x] Test: GET liabilities?entity=all → wszystkie 15 pozycji + rolling
- [x] Test: GET liabilities?type=info → tylko ISAG, NCBiR, PARP
- [x] Test: GET liabilities/schedule?months=12 → raty per miesiąc per pozycja
- [ ] Test: [E2E] Dashboard → Zobowiązania finansowe → widoczny timeline 12 miesięcy → kliknij podmiot → filtr
- [ ] Test: [E2E] Sekcja "Zobowiązania informacyjne" widoczna z ISAG, NCBiR, PARP

**Weryfikacja:**
- [ ] Weryfikacja: Timeline pokazuje raty per miesiąc dla aktywnych zobowiązań
- [ ] Weryfikacja: Sekcja informacyjna oddzielona od aktywnych
- [ ] Weryfikacja: Rolling (ING) widoczne z stałą kwotą

---

### Unit 11: Prognoza wpływów (R7d) + Stany magazynowe (R7e) [M]

**Implementacja:**
- [x] Stwórz `packages/backend/src/routes/forecast.ts`:
  - GET /api/forecast?days=30
  - Należności pogrupowane wg tygodni w przód (naive forecast)
  - Przeterminowane w osobnej sekcji, NIE wliczane do prognozy
- [x] Stwórz `packages/backend/src/routes/warehouse.ts`:
  - GET /api/warehouse (zawsze dngro)
  - Lista artykułów + łączna wartość
- [x] Stwórz `packages/frontend/src/features/forecast/forecast-page.tsx`
- [x] Stwórz `packages/frontend/src/features/warehouse/warehouse-page.tsx` (widoczne tylko w zakładce dngro)
- [x] Stwórz `packages/backend/src/routes/__tests__/forecast.test.ts`
- [x] Stwórz `packages/backend/src/routes/__tests__/warehouse.test.ts`

**Testy:**
- [x] Test: GET forecast?days=30 → należności pogrupowane per tydzień
- [x] Test: Przeterminowane nie wliczone do sumy prognozy 30d
- [x] Test: GET warehouse → artykuły z ilością i wartością, łączna suma
- [ ] Test: [E2E] Dashboard → Prognoza → sekcja "Oczekiwane wpływy" + sekcja "Przeterminowane (niepewne)"
- [ ] Test: [E2E] Zakładka DND Group → Magazyn → tabela artykułów + łączna wartość
- [ ] Test: [E2E] Zakładka CGE → brak widoku magazynu

**Weryfikacja:**
- [ ] Weryfikacja: Prognoza pokazuje only future-dated receivables
- [ ] Weryfikacja: Magazyn widoczny only w zakładce dngro
- [ ] Weryfikacja: Łączna wartość magazynu zgadza się z sumą pozycji

---

### Unit 12: Widok skonsolidowany dashboardu (R5) [M]

**Implementacja:**
- [x] Stwórz `packages/backend/src/routes/dashboard-summary.ts`:
  - GET /api/dashboard/summary?entity=all|{code}
  - Agregacja: należności, zobowiązania handlowe, zobowiązania finansowe (30d), saldo bankowe, wartość magazynu, data importu
- [x] Stwórz `packages/frontend/src/features/dashboard/summary-cards.tsx` (karty z kwotami, kolorowe akcenty)
- [x] Stwórz `packages/frontend/src/features/dashboard/summary-page.tsx` (strona główna po zalogowaniu)
- [x] Stwórz `packages/backend/src/routes/__tests__/dashboard-summary.test.ts`

**Testy:**
- [x] Test: GET dashboard/summary?entity=all → sumy z 5 podmiotów
- [x] Test: GET dashboard/summary?entity=cgesp → sumy tylko CGE
- [x] Test: Kwoty walutowe przeliczone do PLN
- [ ] Test: [E2E] Dashboard → Grupa → 5+ kart z kwotami → data importu widoczna
- [ ] Test: [E2E] Kliknij kartę "Należności" → redirect do widoku należności

**Weryfikacja:**
- [ ] Weryfikacja: Karty podsumowania wyświetlają poprawne sumy
- [ ] Weryfikacja: Data importu widoczna
- [ ] Weryfikacja: Nawigacja z kart do szczegółowych widoków

---

## Do poprawy po review fazy 3

- [x] 🟠 [important] **packages/backend/src/routes/*.ts** — Brak walidacji `entity` query param. Dowolna wartosc przechodzi bez bledu 400. Dodaj walidacje dozwolonych kodow (all, cgesp, dngro, dndsp, tdmsp, tdpsp) we wszystkich 7 route modulach.
- [x] 🟠 [important] **packages/backend/src/routes/receivables.ts:19-110** — Masywna duplikacja SQL (6 blokow, 90+ linii). Wyodrebnij budowanie WHERE clause do helpera. Dotyczy tez dashboard-summary.ts.
- [x] 🟠 [important] **packages/frontend/src/features/** — Brak testow dla 15 nowych komponentow Fazy 3 (summary-cards, invoice-table, entity-tabs, monthly-input-form, etc.). Dodaj minimum smoke testy.
- [x] 🟠 [important] **packages/backend/src/routes/__tests__/** — Brak testow error handling: auth 401 (tylko payables ma), bledne parametry, blad DB. Dodaj do kazdego route test suite.
- [x] 🟠 [important] **packages/backend/src/routes/forecast.ts** — Brak filtra `entity` — endpoint zwraca WSZYSTKIE naleznosci niezaleznie od podmiotu. Dodaj parametr entity analogicznie do receivables.
- [x] 🟠 [important] **Root vitest config** — Brak workspace config. Uruchomienie z roota powoduje 11 failujacych testow frontend (brak jsdom). Dodaj vitest.workspace.ts.
- [ ] 🟡 [nit] **packages/backend/src/routes/dashboard-summary.ts** — 8 sekwencyjnych SQL zapytan. Zrownolegnij z Promise.all.
- [ ] 🟡 [nit] **packages/frontend/src/features/monthly-input/monthly-input-form.tsx:186** — Hardcoded years [2024-2027]. Generuj dynamicznie.
- [ ] 🟡 [nit] **packages/backend/src/routes/receivables.ts:125-128, forecast.ts:95-98** — Duplikacja logiki przeliczania walut. Wyciagnij do helpera.
- [ ] 🟡 [nit] **packages/frontend/src/features/auth/login-page.tsx** — Brak sprawdzenia /api/auth/me — zalogowany user widzi login page.
- [ ] 🟡 [nit] **packages/backend/src/routes/__tests__/monthly-input.test.ts** — Brak testu NaN year/month i PUT schema validation (brakujacy field, zly typ).

---

## Faza 4: AI i projekcja

### Unit 13: Viktor AI — Claude API + function calling [L]

**Implementacja:**
- [x] Stwórz `packages/backend/src/viktor/system-prompt.ts` (kontekst biznesowy: 5 podmiotów, kody, waluty, instrukcje po polsku)
- [x] Stwórz `packages/backend/src/viktor/tools.ts` (7 narzędzi: get_receivables, get_payables, get_overdue, get_liability_schedule, get_cashflow_projection, get_warehouse_value, get_entity_summary)
- [x] Stwórz `packages/backend/src/viktor/model-router.ts` (keyword heuristic: prognoza/ryzyko/cashflow → Sonnet, reszta → Haiku)
- [x] Stwórz `packages/backend/src/viktor/chat.ts` (Anthropic SDK, function calling loop, cost logging)
- [x] Stwórz `packages/backend/src/routes/viktor.ts` (POST /api/viktor/chat → SSE streaming)
- [x] Stwórz `packages/frontend/src/features/viktor/message-bubble.tsx`
- [x] Stwórz `packages/frontend/src/features/viktor/viktor-chat.tsx` (panel czatu, input, historia, SSE)
- [x] Stwórz `packages/backend/src/viktor/__tests__/tools.test.ts`
- [x] Stwórz `packages/backend/src/viktor/__tests__/model-router.test.ts`

**Testy:**
- [x] Test: Model router: "ile mamy zobowiązań?" → Haiku
- [x] Test: Model router: "czy grupa ma ryzyko płynności?" → Sonnet
- [x] Test: Tool `get_receivables` zwraca poprawne dane z DB
- [x] Test: Tool error → fallback tekstowy
- [x] Test: System prompt zawiera kontekst 5 podmiotów
- [ ] Test: [E2E] Viktor chat → "Ile łącznie wynoszą zobowiązania CGE?" → odpowiedź z kwotą PLN
- [ ] Test: [E2E] Viktor chat → "Który kontrahent ma najwyższe przeterminowane?" → odpowiedź z nazwą i kwotą

**Weryfikacja:**
- [ ] Weryfikacja: Viktor odpowiada po polsku z kwotami
- [ ] Weryfikacja: Function calling poprawnie wywołuje narzędzia i zwraca dane
- [ ] Weryfikacja: Model routing działa deterministycznie

---

### Unit 14: Projekcja cashflow (on-demand) [M]

**Implementacja:**
- [x] Stwórz `packages/backend/src/services/cashflow-projection.ts`:
  - Formuła: saldo_grupy_start + wpływy_30d − wypływy_30d
  - saldo_start = suma bank_balance z monthly_input (5 podmiotów, aktualny miesiąc)
  - wpływy_30d = należności [dziś, dziś+30), BEZ przeterminowanych
  - wypływy_30d = raty harmonogramów + rolling ING pro-rata + zobowiązania handlowe + wynagrodzenia pro-rata + VAT (25. następnego miesiąca)
  - Próg: wynik < 0.15 × wypływy_30d → warning, < 0 → critical
  - Brak salda → warning "Brak danych salda bankowego"
- [x] Stwórz `packages/backend/src/routes/cashflow.ts` (GET /api/cashflow?days=30)
- [x] Podłącz jako tool `get_cashflow_projection` w Viktor tools
- [x] Stwórz `packages/backend/src/services/__tests__/cashflow-projection.test.ts`

**Testy:**
- [x] Test: Projekcja z pełnymi danymi → poprawne sumy i risk_level
- [x] Test: Projekcja < 15% wypływów → risk_level = 'warning'
- [x] Test: Projekcja < 0 → risk_level = 'critical'
- [x] Test: Brak salda bankowego → warning w odpowiedzi
- [x] Test: Przeterminowane należności NIE wliczone do wpływów_30d
- [x] Test: ING rolling pro-rata: 30/30 × kwota miesięczna

**Weryfikacja:**
- [ ] Weryfikacja: Formuła poprawnie kalkuluje cashflow
- [ ] Weryfikacja: Viktor używa narzędzia i interpretuje wynik

---

## Do poprawy po review fazy 4

- [ ] 🟠 [important] **packages/backend/src/routes/viktor.ts** — Brak rate limiting na endpoint `/api/viktor/chat`. Kazdy request generuje koszty Claude API. Dodaj rate limit (np. 20 req/min per user).
- [ ] 🟠 [important] **packages/backend/src/viktor/chat.ts:42-48** — Nowa instancja Anthropic client per request. Wyciagnij do singleton/module-level cache.
- [ ] 🟠 [important] **packages/backend/src/viktor/tools.ts** — Plik 398 linii (regula: max 300). Wyodrebnij definicje narzedzi do `tool-definitions.ts` i executory do `tool-executors.ts`.
- [ ] 🟠 [important] **packages/frontend/src/features/viktor/** — Brak testow dla ViktorChat i MessageBubble. Dodaj minimum smoke test + test SSE parsing.
- [ ] 🟠 [important] **packages/backend/src/viktor/__tests__/** — Brak testow dla `chat.ts` (streamChat). Dodaj testy: cost calculation, tool error fallback, max rounds.
- [ ] 🟡 [nit] **packages/backend/src/viktor/chat.ts:35** — Fallback pricing defaultuje do Sonnet. Dodaj explicit warning log dla nieznanego modelu.
- [ ] 🟡 [nit] **packages/backend/src/viktor/tools.ts:195-226** — `get_overdue` robi 4 queries zamiast 2 (detail zawiera total).
- [ ] 🟡 [nit] **packages/frontend/src/features/viktor/viktor-chat.tsx:177** — Array index jako React key. Rozważ unikalne ID.
- [ ] 🟡 [nit] **packages/frontend/src/features/viktor/viktor-chat.tsx** — Brak AbortController na fetch SSE — ryzyko memory leak przy odmontowaniu.
- [ ] 🟡 [nit] **packages/backend/src/services/cashflow-projection.ts:118** — Dodaj inline komentarz wyjasniajacy logike 0-indexed month dla VAT.
- [ ] 🟡 [nit] **packages/backend/src/viktor/chat.ts:165** — Cost warning porownuje pojedynczy request z dziennym budzetem — nigdy sie nie odpali. Sledz sumaryczny koszt.

---

## Faza 5: Deployment

### Unit 15: Dockerization + deploy na Coolify [M]

**Implementacja:**
- [x] Stwórz `packages/frontend/Dockerfile` (multi-stage: Node build → nginx:alpine)
- [x] Stwórz `packages/frontend/nginx.conf` (serving static + proxy /api)
- [x] Stwórz `packages/backend/Dockerfile` (Node 22 alpine, pnpm install --frozen-lockfile)
- [x] Stwórz `docker-compose.prod.yml` (frontend + backend, bez PostgreSQL — managed by Coolify)
- [x] Dodaj health checks do `docker-compose.yml` (dev)
- [x] Dodaj endpoint `/api/health` w backend (DB connection check)
- [ ] Skonfiguruj Coolify: 3 serwisy + env vars + SSL Let's Encrypt
- [ ] Skonfiguruj backup PostgreSQL (pg_dump via cron)

**Testy:**
- [ ] Test: [E2E] `docker compose up` → frontend + backend + PostgreSQL startują
- [ ] Test: [E2E] Frontend pod `https://[domena]` → strona logowania
- [ ] Test: [E2E] Health endpoint `/api/health` → 200
- [ ] Test: [E2E] Import plików działa po deploy

**Weryfikacja:**
- [ ] Weryfikacja: Aplikacja dostępna pod docelową domeną z SSL
- [ ] Weryfikacja: Wszystkie funkcje działają w production environment
- [ ] Weryfikacja: PostgreSQL backup skonfigurowany (cron pg_dump)

---

## Podsumowanie postępu

| Faza | Unity | Status |
|---|---|---|
| 1. Fundament | 1, 2, 3 | ✅ Implementacja ukończona |
| 2. Ingestion | 4, 5, 6, 7 | ✅ Implementacja ukończona, awaiting review |
| 3. Dashboard | 8, 9, 10, 11, 12 | ✅ Implementacja ukończona |
| 4. AI | 13, 14 | ✅ Implementacja ukończona |
| 5. Deploy | 15 | ✅ Implementacja ukończona (Dockerfiles + compose + health) |
