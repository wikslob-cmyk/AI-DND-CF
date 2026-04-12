# Dashboard finansowy — Kontekst techniczny

Branch: `feature/dashboard-finansowy`
Ostatnia aktualizacja: 2026-04-12 (Faza 2 ukończona)

## Podmioty grupy

| Kod | Pełna nazwa | Kredyty | Magazyn |
|---|---|---|---|
| `cgesp` | CGE Sp. z o.o. | TAK (7 pozycji) | NIE |
| `dngro` | DND Group Sp. z o.o. | TAK (6 pozycji) | TAK |
| `dndsp` | DND Sp. z o.o. | TAK (1 pozycja) | NIE |
| `tdmsp` | TDM Sp. z o.o. | TAK (1 pozycja) | NIE |
| `tdpsp` | TDP Sp. z o.o. | NIE | NIE |

## Struktura monorepo

```
/
├── packages/
│   ├── frontend/          # React 19 + Vite + TailwindCSS v4 + shadcn/ui
│   │   └── src/
│   │       ├── features/  # feature-based folders
│   │       ├── layouts/   # dashboard-layout.tsx
│   │       ├── lib/       # api-client.ts, utils
│   │       └── router.tsx
│   ├── backend/           # Fastify + TypeScript
│   │   └── src/
│   │       ├── auth/      # login, middleware, constants
│   │       ├── db/        # connection, migrations, seeds
│   │       ├── import/    # orchestrator, routes
│   │       ├── parsers/   # saldeo, schedule, warehouse, nip, types
│   │       ├── routes/    # receivables, payables, liabilities, forecast, warehouse, cashflow, monthly-input, dashboard-summary
│   │       ├── services/  # nbp-rates, cashflow-projection
│   │       ├── viktor/    # chat, tools, system-prompt, model-router
│   │       └── server.ts
│   └── shared/            # Współdzielone typy i stałe
│       └── src/
│           ├── index.ts
│           └── types/     # invoice.ts, liability.ts
├── docker-compose.yml     # Dev: PostgreSQL 16
├── docker-compose.prod.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── .nvmrc
```

## Schemat bazy danych

### Tabele
- **entity** — 5 podmiotów grupy (code PK, name, has_warehouse)
- **import_log** — historia importów (id, imported_at, status, details JSONB)
- **invoice** — faktury z Saldeo (entity_code, document_type FS|FZ, contractor_nip, payment_due, remaining_amount, currency)
- **exchange_rate** — kursy NBP per import (currency, rate_pln, rate_date)
- **liability** — 15 pozycji zobowiązań finansowych (entity_code, type, status, config JSONB dla rolling)
- **liability_schedule** — harmonogramy rat (liability_id, payment_date, capital, interest, total)
- **warehouse_item** — stany magazynowe dngro (article_name, quantities, values)
- **monthly_input** — dane ręczne R4 (entity_code, year, month, vat_refund, salaries_net, bank_balance)

### Kluczowe indeksy
- `invoice(entity_code, document_type, payment_due)` — filtrowanie widoków
- `invoice(contractor_nip)` — agregacja per kontrahent
- `liability_schedule(liability_id, payment_date)` — timeline
- `monthly_input(entity_code, year, month)` — UNIQUE

## Powiązane pliki (zasoby danych)

### Pliki Saldeo (import tygodniowy)
- `zasoby/lista-dokumentow-cgesp.xlsx`
- `zasoby/lista-dokumentow-dngro.xlsx`
- `zasoby/lista-dokumentow-dndsp.xlsx`
- `zasoby/lista-dokumentow-tdmsp.xlsx`
- `zasoby/lista-dokumentow-tdpsp.xlsx`

### Zestawienie magazynowe
- `zasoby/Zestawienie magazynowe DND 10.04.26.xlsx`

### Harmonogramy zobowiązań (setup jednorazowy)
- `zasoby/zaobowiazania/tabela_rat_wynagrodzenia.xlsx` → cgesp / Millennium piec
- `zasoby/zaobowiazania/tabela_rat_364944.xlsx` → cgesp / Millennium młyn+prasa
- `zasoby/zaobowiazania/Harmonogram.pdf` → cgesp / Alior Bank
- `zasoby/zaobowiazania/harmonogram_splat_EFL_6F01694.xlsx` → cgesp / EFL linia
- `zasoby/zaobowiazania/harmonogram_splat_EFL6F01696.xlsx` → cgesp / EFL piec 1
- `zasoby/zaobowiazania/harmonogram_splat_EFL6F01695.xlsx` → cgesp / EFL piec 2
- `zasoby/zaobowiazania/harmonogram_santander_NP6_00258_2023.xlsx` → dngro / Santander Volvo
- `zasoby/zaobowiazania/Harmonogram_platnosci-dndgr-mercedes.xlsx` → dngro / Mercedes S-klasa
- `zasoby/zaobowiazania/LFR.pdf` → dngro / LFR (**skan — ręczny wpis**)
- `zasoby/zaobowiazania/Harmonogram spłat_nr umowy 01450_PI_24.pdf` → dngro / PKO Leasing
- `zasoby/zaobowiazania/DNDspzoo-leasing.pdf` → dndsp / Mercedes Leasing
- `zasoby/zaobowiazania/TDM-leas.xlsx` → tdmsp / Millennium zgrzewarka
- `zasoby/zaobowiazania/Harmonogram płatności nowy 22_07_2025.pdf` → do zidentyfikowania
- `zasoby/zaobowiazania/Zobowiązania na dzień 24.02.2026.xlsx` → master list (referencja, nie source of truth)

### Konfiguracje stałe (seed w DB)
- dngro / ING limit: 70 000 PLN kapitał + 18 000 PLN odsetki/mies
- dngro / ING faktoring: 0 PLN kapitał + 15 000 PLN odsetki/mies

### Pozycje informacyjne (seed w DB)
- cgesp / ISAG (IKEA) — pending_write_off
- NCBiR 750 000 PLN — informacyjne
- NCBiR 3 200 000 PLN — informacyjne
- PARP 950 000 PLN — informacyjne

## Decyzje techniczne

### Potwierdzone
- **Backend:** Fastify (natywne TS, JSON Schema validation)
- **Struktura:** Monorepo pnpm workspaces
- **DB:** PostgreSQL 16 via Coolify, biblioteka `postgres` (porsager/postgres)
- **"Ten tydzień":** Rolling dziś + 7 dni
- **Import:** Transakcyjny (BEGIN/COMMIT, rollback przy błędzie)
- **NBP:** Cache + retry 3×2s, fallback na ostatni kurs
- **Filtr Typ:** Regex exact match `^[A-Z]+_FS_$` / `^[A-Z]+_FZ_$`
- **NIP:** Normalizacja do czystych cyfr przed agregacją
- **Model routing:** Keyword heuristic (prognoza/ryzyko/cashflow → Sonnet, reszta → Haiku)
- **Auth:** Shared password → JWT HttpOnly cookie 30 dni

### Odroczone do implementacji
- Dokładna struktura nagłówków każdego harmonogramu
- Finalne sygnatury narzędzi Viktora
- JWT secret format
- Domena + SSL
- Strategia backupów PostgreSQL

## Zależności (biblioteki)

### Frontend
- react 19, react-dom 19
- vite, @vitejs/plugin-react
- tailwindcss v4
- shadcn/ui (components)
- @tanstack/react-query
- react-router (v7)
- zod

### Backend
- fastify
- @fastify/jwt, @fastify/cookie, @fastify/cors, @fastify/multipart
- postgres (porsager/postgres)
- xlsx (SheetJS)
- pdf-parse
- @anthropic-ai/sdk
- zod

### Env vars (`.env`)
- `DATABASE_URL` — PostgreSQL connection string
- `DASHBOARD_PASSWORD` — shared password for auth
- `JWT_SECRET` — JWT signing secret
- `ANTHROPIC_API_KEY` — Claude API key
- `NBP_API_URL` — `https://api.nbp.pl/api/exchangerates/rates/a`

## API Endpoints

### Auth
- `POST /api/auth/login` → JWT cookie
- `POST /api/auth/logout` → clear cookie
- `GET /api/auth/me` → verify session

### Import (chronione JWT)
- `POST /api/import/saldeo` — multipart 5 plików
- `POST /api/import/warehouse` — multipart 1 plik
- `POST /api/import/schedules` — multipart harmonogramy
- `GET /api/import/status`

### Dane (chronione JWT)
- `GET /api/receivables?entity=&period=`
- `GET /api/payables?entity=&period=`
- `GET /api/liabilities?entity=&type=`
- `GET /api/liabilities/schedule?entity=&months=`
- `GET /api/warehouse`
- `GET /api/forecast?days=`
- `GET /api/cashflow?days=`
- `GET /api/dashboard/summary?entity=`
- `GET /api/exchange-rates`
- `GET /api/monthly-input?entity=&year=&month=`
- `PUT /api/monthly-input`

### Viktor AI
- `POST /api/viktor/chat` → SSE streaming

## Narzędzia Viktora (function calling)

| Tool | Opis |
|---|---|
| `get_receivables` | Należności per podmiot/grupa |
| `get_payables` | Zobowiązania handlowe |
| `get_overdue` | Przeterminowane (należności + zobowiązania) |
| `get_liability_schedule` | Harmonogram zobowiązań finansowych |
| `get_cashflow_projection` | Projekcja płynności na N dni |
| `get_warehouse_value` | Stan i wartość magazynu |
| `get_entity_summary` | Podsumowanie podmiotu |

## Historia zmian

### Faza 1: Fundament (2026-04-12)
- Scaffold monorepo: pnpm workspaces, 3 packages (frontend, backend, shared)
- Frontend: React 19 + Vite 5.4 + TailwindCSS v4 + vitest 3.2
- Backend: Fastify 5 + TypeScript strict + vitest 3.2
- Shared: EntityCode, InvoiceType, LiabilityType enums i type guards
- DB: PostgreSQL schema (8 tabel, 4 indeksy), migration runner, seed data
- Auth: JWT HttpOnly cookie (30d), timing-safe password compare, middleware
- Vite 5.x used instead of 6+ due to Node 24 incompatibility with `#module-sync-enabled` package imports
- E2E login test deferred (requires running frontend + backend)
- cross-env added to root for Windows compatibility

## Code Review Fazy 1 (2026-04-12)

**Severity gate:** KONTYNUUJ Z ZASTRZEZENIAMI (1x P1, 6x P2, 5x P3)
**Raport:** `docs/active/dashboard-finansowy/review-faza-1.md`

### Kluczowe wnioski
- **P1 blocking:** JWT_SECRET ma hardcoded fallback -- musi byc naprawiony przed produkcja
- **Security:** Brak rate limiting i body validation na login, CORS open -- 3x P2
- **Observability:** pino-pretty w produkcji + brak w dependencies -- 2x P2
- **Testing:** Brak testow frontend (akceptowalne w scaffold, ale do dodania)
- **Odchylenia od planu:** Brak -- implementacja zgodna z planem technicznym
- **E2E:** 0/7 weryfikacji zrealizowanych (wymagaja infrastruktury)
- **Typecheck:** Czyste (backend + frontend)
- **Testy:** 18 passed, 5 skipped (DB integration), 0 failed

## Re-Review Fazy 1 po cyklu fix (2026-04-12)

**Severity gate:** KONTYNUUJ Z ZASTRZEZENIAMI (0x P1, 1x P2, 5x P3)
**Raport:** `docs/active/dashboard-finansowy/review-faza-1.md`

### Weryfikacja napraw
- Wszystkie 7 napraw (1x P1 + 6x P2) zweryfikowane jako poprawne
- JWT_SECRET: rzuca Error bez fallbacku
- CORS: restrykcyjne (env var lub localhost)
- Body validation: JSON Schema z required/minLength/additionalProperties
- Rate limiting: 5 prob/min na login endpoint
- pino-pretty: warunkowe (dev only), w devDependencies
- Frontend test: 2 testy renderowania App

### Nowy finding
- P2: Brak testow dla nowych mechanizmow (body validation 400, rate limit 429, JWT_SECRET throw)

### Testy po fixie
- Backend: 18 passed, 5 skipped, 0 failed
- Frontend: 2 passed, 0 failed
- Typecheck: czyste (backend + frontend)
- E2E: 0/7 (wymaga infrastruktury)

## Faza 2: Pipeline ingestion (2026-04-12)

### Zmiany
- Unit 4: Parser Saldeo — parsowanie 5 plików xlsx, regex `^[A-Z]+_FS_$` / `^[A-Z]+_FZ_$`, NIP normalization, 48-kolumnowa walidacja
- Unit 5: Parser harmonogramów — 8 parserów Excel (Millennium, EFL, Santander, Mercedes, TDM) + 3 parsery PDF (Alior, PKO, Mercedes). LFR.pdf i Harmonogram platnosci nowy = skany, rejected
- Unit 6: Parser magazynu — wielopoziomowe nagłówki, kolumny ilości/wartości, ekstrakcja kursu EUR. Serwis NBP z retry 3x + fallback z DB
- Unit 7: Orkiestrator importu — transakcyjny (parse-all then write), fail-fast, snapshot replacement. Multipart upload routes. Frontend dropzone UI
- Dodano zależności: xlsx (SheetJS), pdf-parse@1.1.1
- Usunięto rootDir z backend tsconfig (fix dla monorepo path alias @dnd/shared)
- Zarejestrowano @fastify/multipart w server.ts

### Decyzje techniczne
- pdf-parse v1.1.1 (nie v2) — prostsza API, lepsze CJS compat
- pdf-parse wymaga dummy test fixture (test/data/05-versions-space.pdf) at import time
- NBP retry delay zmniejszony w testach (VITEST env var detection)
- DbAdapter interface w orchestrator — pozwala na mockowanie w testach, prawdziwa implementacja będzie w Fazie 3
- Import routes używają stub DbAdapter — będzie podłączony do prawdziwej DB gdy endpointy zostaną zintegrowane z routerem

### Testy
- Backend: 71 passed, 5 skipped (DB integration), 0 failed
- Frontend: 2 passed, 0 failed
- Typecheck: czyste (backend + frontend)
- Nowe testy: 13 NIP, 8 Saldeo, 10 schedule, 5 warehouse, 7 NBP, 6 orchestrator

## Zrodla
- Requirements doc: `docs/dev-brainstorms/2026-04-11-dashboard-finansowy-requirements.md`
- Plan techniczny: `docs/plans/2026-04-12-001-feat-dashboard-finansowy-plan.md`
