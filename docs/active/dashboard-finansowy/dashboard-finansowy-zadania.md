# Dashboard finansowy — Zadania

Branch: `feature/dashboard-finansowy`
Ostatnia aktualizacja: 2026-04-12 (Faza 1 ukończona)

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

## Faza 2: Pipeline ingestion

### Unit 4: Parser plików Saldeo (Excel) [L]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/parsers/types.ts` (ParsedInvoice interface, ValidationError)
- [ ] Stwórz `packages/backend/src/parsers/nip-normalizer.ts` (usuwanie spacji, myślników, "PL", walidacja 10 cyfr)
- [ ] Stwórz `packages/backend/src/parsers/saldeo-parser.ts`:
  - Walidacja nagłówków wiersz 3, wymagane kolumny
  - Filtr regex `^[A-Z]+_FS_$` (należności) i `^[A-Z]+_FZ_$` (zobowiązania)
  - Kwota z `Pozostało do zapłaty`, nie `Wartość brutto`
  - Entity code z nazwy pliku
- [ ] Stwórz `packages/backend/src/parsers/__tests__/saldeo-parser.test.ts`
- [ ] Stwórz `packages/backend/src/parsers/__tests__/nip-normalizer.test.ts`

**Testy:**
- [ ] Test: Parsowanie `lista-dokumentow-cgesp.xlsx` → poprawna lista należności i zobowiązań
- [ ] Test: Filtr `_FS_` nie łapie `_FS_PF_` ani `_FS_KOR_`
- [ ] Test: Filtr `_FZ_` łapie tylko exact `_FZ_`
- [ ] Test: Plik z brakującą kolumną → ValidationError z nazwą brakującej kolumny
- [ ] Test: NIP z myślnikami "123-456-78-90" → "1234567890"
- [ ] Test: NIP z prefixem "PL" → usunięty
- [ ] Test: Faktura z `Zapłacono = TAK` → wykluczona
- [ ] Test: Faktura z `Remaining = 0` i `Zapłacono = NIE` → dołączona (edge case)

**Weryfikacja:**
- [ ] Weryfikacja: Parser poprawnie przetwarza wszystkie 5 plików z `zasoby/`
- [ ] Weryfikacja: Walidacja struktury odrzuca uszkodzony plik

---

### Unit 5: Parser harmonogramów (Excel + PDF) [XL]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/parsers/schedule-types.ts` (ParsedScheduleEntry, ScheduleParseError)
- [ ] Stwórz `packages/backend/src/parsers/schedule-parser-excel.ts`:
  - Parser per format/plik harmonogramu Excel
  - Mapowanie: tabela_rat_wynagrodzenia, tabela_rat_364944, harmonogram_splat_EFL_*, harmonogram_santander_*, Harmonogram_platnosci-dndgr-mercedes, TDM-leas
- [ ] Stwórz `packages/backend/src/parsers/schedule-parser-pdf.ts`:
  - Parser czytelnych PDF: Harmonogram.pdf (Alior), Harmonogram spłat_nr umowy 01450_PI_24.pdf (PKO), DNDspzoo-leasing.pdf
  - LFR.pdf → ScheduleParseError("Skan PDF, wymaga ręcznego wpisu")
- [ ] Stwórz `packages/backend/src/parsers/__tests__/schedule-parser.test.ts`

**Notatka:** Zacznij od jednego pliku Excel (tabela_rat_364944.xlsx) jako wzorca, potem rozszerz.

**Testy:**
- [ ] Test: Parsowanie `tabela_rat_364944.xlsx` → lista rat z datami, kapitałem, odsetkami
- [ ] Test: Parsowanie `Harmonogram.pdf` (Alior) → lista rat
- [ ] Test: `LFR.pdf` → rzuca ScheduleParseError("Skan PDF, wymaga ręcznego wpisu")
- [ ] Test: Parsowanie pliku z brakującymi kolumnami → ValidationError
- [ ] Test: Sumy rat per harmonogram zgadzają się z kwotą kredytu

**Weryfikacja:**
- [ ] Weryfikacja: Parsery przetwarzają wszystkie pliki z `zasoby/zaobowiazania/` (oprócz LFR.pdf)
- [ ] Weryfikacja: Każdy harmonogram ma poprawne daty i kwoty

---

### Unit 6: Parser magazynu + integracja NBP API [M]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/parsers/warehouse-parser.ts`:
  - Nagłówki wielopoziomowe (wiersz 1-2)
  - Kolumny 9-11 (ilości), 15-17 (wartości), Cena (sprzedaży), Artykuł
  - Sumowanie komponent + gotowe per artykuł
  - Ignorowanie kolumny M (cena zakupu)
- [ ] Stwórz `packages/backend/src/services/nbp-rates.ts`:
  - Fetch z `https://api.nbp.pl/api/exchangerates/rates/a/{currency}/?format=json`
  - Retry 3 × 2s backoff
  - Fallback: ostatni kurs z DB + warning
  - PLN → rate 1.0, nieznana waluta → error
- [ ] Stwórz `packages/backend/src/parsers/__tests__/warehouse-parser.test.ts`
- [ ] Stwórz `packages/backend/src/services/__tests__/nbp-rates.test.ts`

**Testy:**
- [ ] Test: Parsowanie `Zestawienie magazynowe DND 10.04.26.xlsx` → lista artykułów z ilościami i wartościami
- [ ] Test: Wartość per artykuł = ilość_total × cena_sprzedaży
- [ ] Test: NBP API zwraca kurs EUR → zapis do DB
- [ ] Test: NBP API niedostępne → fallback na ostatni kurs + warning
- [ ] Test: Nieznana waluta (np. CHF) → error z opisem

**Weryfikacja:**
- [ ] Weryfikacja: Parser poprawnie czyta wielopoziomowe nagłówki
- [ ] Weryfikacja: Łączna wartość magazynu zgadza się z sumą w pliku
- [ ] Weryfikacja: Kursy walut zapisane w DB

---

### Unit 7: Orkiestrator importu (backend + UI upload) [L]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/import/orchestrator.ts`:
  - Waliduj strukturę wszystkich plików → fail fast
  - Pobierz kursy NBP (jeśli faktury walutowe)
  - BEGIN transaction → DELETE stare → INSERT nowe → COMMIT/ROLLBACK
  - INSERT import_log z details
- [ ] Stwórz `packages/backend/src/import/routes.ts`:
  - POST /api/import/saldeo (multipart 5 plików)
  - POST /api/import/warehouse (multipart 1 plik)
  - POST /api/import/schedules (multipart harmonogramy)
  - GET /api/import/status
- [ ] Stwórz `packages/frontend/src/features/import/import-page.tsx`
- [ ] Stwórz `packages/frontend/src/features/import/file-dropzone.tsx` (drag-n-drop, walidacja typu)
- [ ] Stwórz `packages/frontend/src/features/import/import-status.tsx` (ostatni import: data, status, warnings)
- [ ] Stwórz `packages/backend/src/import/__tests__/orchestrator.test.ts`

**Testy:**
- [ ] Test: Import 5 poprawnych plików → dane w DB, import_log status=success
- [ ] Test: Import z 1 uszkodzonym plikiem → rollback, żadne dane nie zmienione, import_log status=failed
- [ ] Test: Import nadpisuje poprzedni snapshot (stare invoice usunięte)
- [ ] Test: Import z fakturami EUR → kurs NBP pobrany i zapisany
- [ ] Test: [E2E] Przeciągnij 5 plików → dropzone → kliknij "Importuj" → spinner → "Import zakończony" z datą
- [ ] Test: [E2E] Upload pliku z błędną strukturą → komunikat błędu z opisem problemu

**Weryfikacja:**
- [ ] Weryfikacja: Transakcyjność — błąd w jednym pliku = brak zmian w DB
- [ ] Weryfikacja: Status importu widoczny w UI z datą i listą plików

---

## Faza 3: Dashboard — widoki i formularz

### Unit 8: Layout dashboardu + nawigacja + R4 formularz [L]

**Implementacja:**
- [ ] Stwórz `packages/frontend/src/lib/api-client.ts` (fetch wrapper z credentials: 'include')
- [ ] Stwórz `packages/frontend/src/router.tsx` (React Router, lazy loading per route)
- [ ] Stwórz `packages/frontend/src/layouts/dashboard-layout.tsx` (topbar + sidebar + entity tabs)
- [ ] Stwórz `packages/frontend/src/features/auth/login-page.tsx` (formularz hasła)
- [ ] Stwórz `packages/frontend/src/features/dashboard/entity-tabs.tsx` (Grupa, CGE, DND Group, DND, TDM, TDP)
- [ ] Stwórz `packages/frontend/src/features/dashboard/dashboard-page.tsx` (wrapper per entity)
- [ ] Stwórz `packages/frontend/src/features/monthly-input/monthly-input-form.tsx` (5 podmiotów × 3 pola + selector miesiąca)
- [ ] Stwórz `packages/frontend/src/features/monthly-input/monthly-input-page.tsx`
- [ ] Stwórz `packages/backend/src/routes/monthly-input.ts` (GET + PUT upsert)
- [ ] Skonfiguruj shadcn/ui (Tabs, Card, Input, Button, Label, Select)
- [ ] Skonfiguruj TailwindCSS v4 z custom OKLCH palette
- [ ] Skonfiguruj React Query provider
- [ ] Stwórz `packages/backend/src/routes/__tests__/monthly-input.test.ts`

**Testy:**
- [ ] Test: PUT monthly-input → upsert w DB, 200
- [ ] Test: PUT monthly-input z duplikatem (ten sam podmiot+miesiąc) → update
- [ ] Test: GET monthly-input → dane dla podmiotu i miesiąca
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
- [ ] Stwórz `packages/shared/src/types/invoice.ts` (InvoiceRow, InvoiceGroup, PeriodType)
- [ ] Stwórz `packages/backend/src/routes/receivables.ts`:
  - GET /api/receivables?entity=&period= z GROUP BY contractor_nip
  - Filtr: 7d=[dziś,dziś+7), 30d=[dziś+7,dziś+30), overdue=<dziś
  - JOIN exchange_rate dla przeliczenia walut
- [ ] Stwórz `packages/backend/src/routes/payables.ts` (analogiczna struktura)
- [ ] Stwórz `packages/frontend/src/features/receivables/invoice-table.tsx` (DataTable shadcn/ui, sumy per sekcja)
- [ ] Stwórz `packages/frontend/src/features/receivables/receivables-page.tsx` (3 karty: 7d, 30d, overdue)
- [ ] Stwórz `packages/frontend/src/features/payables/payables-page.tsx`
- [ ] Stwórz `packages/backend/src/routes/__tests__/receivables.test.ts`
- [ ] Stwórz `packages/backend/src/routes/__tests__/payables.test.ts`

**Testy:**
- [ ] Test: GET receivables?entity=all&period=7d → należności z terminem w [dziś, dziś+7)
- [ ] Test: GET receivables?entity=cgesp&period=overdue → przeterminowane CGE
- [ ] Test: Faktura EUR przeliczona do PLN kursem z exchange_rate
- [ ] Test: Agregacja per NIP w widoku skonsolidowanym — ten sam NIP z 2 podmiotów = 1 wiersz
- [ ] Test: [E2E] Dashboard → Należności → 3 sekcje widoczne → kwoty per kontrahent → suma na dole sekcji
- [ ] Test: [E2E] Przełączenie na zakładkę "CGE" → tylko należności CGE

**Weryfikacja:**
- [ ] Weryfikacja: Trzy sekcje z poprawnym podziałem czasowym
- [ ] Weryfikacja: Sumy PLN poprawne (w tym przeliczenia walutowe)
- [ ] Weryfikacja: Agregacja per NIP działa w widoku grupy

---

### Unit 10: Widok zobowiązań finansowych (R7c, R7f) [L]

**Implementacja:**
- [ ] Stwórz `packages/shared/src/types/liability.ts` (LiabilityRow, ScheduleEntry, LiabilityType)
- [ ] Stwórz `packages/backend/src/routes/liabilities.ts`:
  - GET /api/liabilities?entity=&type=
  - GET /api/liabilities/schedule?entity=&months=12
- [ ] Stwórz `packages/frontend/src/features/liabilities/liability-list.tsx` (lista per podmiot, sekcja informacyjna)
- [ ] Stwórz `packages/frontend/src/features/liabilities/liability-timeline.tsx` (grid: miesiące × pozycje, desktop-first)
- [ ] Stwórz `packages/frontend/src/features/liabilities/liabilities-page.tsx`
- [ ] Stwórz `packages/backend/src/routes/__tests__/liabilities.test.ts`

**Testy:**
- [ ] Test: GET liabilities?entity=all → wszystkie 15 pozycji + rolling
- [ ] Test: GET liabilities?type=info → tylko ISAG, NCBiR, PARP
- [ ] Test: GET liabilities/schedule?months=12 → raty per miesiąc per pozycja
- [ ] Test: [E2E] Dashboard → Zobowiązania finansowe → widoczny timeline 12 miesięcy → kliknij podmiot → filtr
- [ ] Test: [E2E] Sekcja "Zobowiązania informacyjne" widoczna z ISAG, NCBiR, PARP

**Weryfikacja:**
- [ ] Weryfikacja: Timeline pokazuje raty per miesiąc dla aktywnych zobowiązań
- [ ] Weryfikacja: Sekcja informacyjna oddzielona od aktywnych
- [ ] Weryfikacja: Rolling (ING) widoczne z stałą kwotą

---

### Unit 11: Prognoza wpływów (R7d) + Stany magazynowe (R7e) [M]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/routes/forecast.ts`:
  - GET /api/forecast?days=30
  - Należności pogrupowane wg tygodni w przód (naive forecast)
  - Przeterminowane w osobnej sekcji, NIE wliczane do prognozy
- [ ] Stwórz `packages/backend/src/routes/warehouse.ts`:
  - GET /api/warehouse (zawsze dngro)
  - Lista artykułów + łączna wartość
- [ ] Stwórz `packages/frontend/src/features/forecast/forecast-page.tsx`
- [ ] Stwórz `packages/frontend/src/features/warehouse/warehouse-page.tsx` (widoczne tylko w zakładce dngro)
- [ ] Stwórz `packages/backend/src/routes/__tests__/forecast.test.ts`
- [ ] Stwórz `packages/backend/src/routes/__tests__/warehouse.test.ts`

**Testy:**
- [ ] Test: GET forecast?days=30 → należności pogrupowane per tydzień
- [ ] Test: Przeterminowane nie wliczone do sumy prognozy 30d
- [ ] Test: GET warehouse → artykuły z ilością i wartością, łączna suma
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
- [ ] Stwórz `packages/backend/src/routes/dashboard-summary.ts`:
  - GET /api/dashboard/summary?entity=all|{code}
  - Agregacja: należności, zobowiązania handlowe, zobowiązania finansowe (30d), saldo bankowe, wartość magazynu, data importu
- [ ] Stwórz `packages/frontend/src/features/dashboard/summary-cards.tsx` (karty z kwotami, kolorowe akcenty)
- [ ] Stwórz `packages/frontend/src/features/dashboard/summary-page.tsx` (strona główna po zalogowaniu)
- [ ] Stwórz `packages/backend/src/routes/__tests__/dashboard-summary.test.ts`

**Testy:**
- [ ] Test: GET dashboard/summary?entity=all → sumy z 5 podmiotów
- [ ] Test: GET dashboard/summary?entity=cgesp → sumy tylko CGE
- [ ] Test: Kwoty walutowe przeliczone do PLN
- [ ] Test: [E2E] Dashboard → Grupa → 5+ kart z kwotami → data importu widoczna
- [ ] Test: [E2E] Kliknij kartę "Należności" → redirect do widoku należności

**Weryfikacja:**
- [ ] Weryfikacja: Karty podsumowania wyświetlają poprawne sumy
- [ ] Weryfikacja: Data importu widoczna
- [ ] Weryfikacja: Nawigacja z kart do szczegółowych widoków

---

## Faza 4: AI i projekcja

### Unit 13: Viktor AI — Claude API + function calling [L]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/viktor/system-prompt.ts` (kontekst biznesowy: 5 podmiotów, kody, waluty, instrukcje po polsku)
- [ ] Stwórz `packages/backend/src/viktor/tools.ts` (7 narzędzi: get_receivables, get_payables, get_overdue, get_liability_schedule, get_cashflow_projection, get_warehouse_value, get_entity_summary)
- [ ] Stwórz `packages/backend/src/viktor/model-router.ts` (keyword heuristic: prognoza/ryzyko/cashflow → Sonnet, reszta → Haiku)
- [ ] Stwórz `packages/backend/src/viktor/chat.ts` (Anthropic SDK, function calling loop, cost logging)
- [ ] Stwórz `packages/backend/src/routes/viktor.ts` (POST /api/viktor/chat → SSE streaming)
- [ ] Stwórz `packages/frontend/src/features/viktor/message-bubble.tsx`
- [ ] Stwórz `packages/frontend/src/features/viktor/viktor-chat.tsx` (panel czatu, input, historia, SSE)
- [ ] Stwórz `packages/backend/src/viktor/__tests__/tools.test.ts`
- [ ] Stwórz `packages/backend/src/viktor/__tests__/model-router.test.ts`

**Testy:**
- [ ] Test: Model router: "ile mamy zobowiązań?" → Haiku
- [ ] Test: Model router: "czy grupa ma ryzyko płynności?" → Sonnet
- [ ] Test: Tool `get_receivables` zwraca poprawne dane z DB
- [ ] Test: Tool error → fallback tekstowy
- [ ] Test: System prompt zawiera kontekst 5 podmiotów
- [ ] Test: [E2E] Viktor chat → "Ile łącznie wynoszą zobowiązania CGE?" → odpowiedź z kwotą PLN
- [ ] Test: [E2E] Viktor chat → "Który kontrahent ma najwyższe przeterminowane?" → odpowiedź z nazwą i kwotą

**Weryfikacja:**
- [ ] Weryfikacja: Viktor odpowiada po polsku z kwotami
- [ ] Weryfikacja: Function calling poprawnie wywołuje narzędzia i zwraca dane
- [ ] Weryfikacja: Model routing działa deterministycznie

---

### Unit 14: Projekcja cashflow (on-demand) [M]

**Implementacja:**
- [ ] Stwórz `packages/backend/src/services/cashflow-projection.ts`:
  - Formuła: saldo_grupy_start + wpływy_30d − wypływy_30d
  - saldo_start = suma bank_balance z monthly_input (5 podmiotów, aktualny miesiąc)
  - wpływy_30d = należności [dziś, dziś+30), BEZ przeterminowanych
  - wypływy_30d = raty harmonogramów + rolling ING pro-rata + zobowiązania handlowe + wynagrodzenia pro-rata + VAT (25. następnego miesiąca)
  - Próg: wynik < 0.15 × wypływy_30d → warning, < 0 → critical
  - Brak salda → warning "Brak danych salda bankowego"
- [ ] Stwórz `packages/backend/src/routes/cashflow.ts` (GET /api/cashflow?days=30)
- [ ] Podłącz jako tool `get_cashflow_projection` w Viktor tools
- [ ] Stwórz `packages/backend/src/services/__tests__/cashflow-projection.test.ts`

**Testy:**
- [ ] Test: Projekcja z pełnymi danymi → poprawne sumy i risk_level
- [ ] Test: Projekcja < 15% wypływów → risk_level = 'warning'
- [ ] Test: Projekcja < 0 → risk_level = 'critical'
- [ ] Test: Brak salda bankowego → warning w odpowiedzi
- [ ] Test: Przeterminowane należności NIE wliczone do wpływów_30d
- [ ] Test: ING rolling pro-rata: 30/30 × kwota miesięczna

**Weryfikacja:**
- [ ] Weryfikacja: Formuła poprawnie kalkuluje cashflow
- [ ] Weryfikacja: Viktor używa narzędzia i interpretuje wynik

---

## Faza 5: Deployment

### Unit 15: Dockerization + deploy na Coolify [M]

**Implementacja:**
- [ ] Stwórz `packages/frontend/Dockerfile` (multi-stage: Node build → nginx:alpine)
- [ ] Stwórz `packages/frontend/nginx.conf` (serving static + proxy /api)
- [ ] Stwórz `packages/backend/Dockerfile` (Node 22 alpine, pnpm install --frozen-lockfile)
- [ ] Stwórz `docker-compose.prod.yml` (frontend + backend, bez PostgreSQL — managed by Coolify)
- [ ] Dodaj health checks do `docker-compose.yml` (dev)
- [ ] Dodaj endpoint `/api/health` w backend (DB connection check)
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
| 1. Fundament | 1, 2, 3 | ✅ Implementacja ukończona, awaiting review |
| 2. Ingestion | 4, 5, 6, 7 | - |
| 3. Dashboard | 8, 9, 10, 11, 12 | - |
| 4. AI | 13, 14 | - |
| 5. Deploy | 15 | - |
