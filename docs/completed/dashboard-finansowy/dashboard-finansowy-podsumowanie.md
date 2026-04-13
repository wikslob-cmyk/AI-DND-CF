# Dashboard finansowy — Podsumowanie ukończenia

Data ukończenia: 2026-04-12
Branch: `feature/dashboard-finansowy`
Autor: Viktor Slob

---

## Co zostało dostarczone

Greenfield dashboard finansowy konsolidujący dane z 5 spółek grupy DND (CGE, DND Group, DND, TDM, TDP). System importuje pliki Saldeo, harmonogramy kredytowe, dane magazynowe i ręczne dane miesięczne. AI asystent Viktor (Claude API) odpowiada na pytania w języku naturalnym.

### Funkcjonalności
- **Pipeline importu:** Parsery Saldeo (5 xlsx), harmonogramów (8 Excel + 3 PDF), magazynu + integracja NBP API
- **6 widoków dashboardu:** Należności, zobowiązania handlowe, zobowiązania finansowe/timeline, prognoza wpływów, magazyn, podsumowanie skonsolidowane
- **Formularz R4:** Ręczne dane miesięczne (VAT, wynagrodzenia, saldo bankowe per podmiot)
- **AI asystent Viktor:** Claude API z function calling (7 narzędzi), model routing (Sonnet/Haiku), SSE streaming
- **Projekcja cashflow:** On-demand z formułą uwzględniającą raty, rolling ING, VAT, wynagrodzenia
- **Deployment:** Multi-stage Dockerfiles (frontend nginx + backend Node), docker-compose.prod.yml, health checks

### Stack technologiczny
- Frontend: React 19 + Vite + TailwindCSS v4 + shadcn/ui + React Query + React Router v7
- Backend: Fastify 5 + TypeScript strict + PostgreSQL 16 (porsager/postgres)
- AI: @anthropic-ai/sdk (Sonnet 4.6 / Haiku 4.5)
- Monorepo: pnpm workspaces (frontend + backend + shared)
- Deploy: Docker + Coolify na VPS Hostinger

---

## Kluczowe decyzje techniczne

1. **Fastify (nie Express)** — natywne TS, wbudowana walidacja JSON Schema, lepsza wydajność
2. **porsager/postgres (nie Prisma/Drizzle)** — lekka biblioteka, elastyczne query bez ORM
3. **Rolling dziś + 7 dni** — "ten tydzień" zawsze aktualne niezależnie od dnia
4. **Import transakcyjny** — parse-all then write, fail-fast, snapshot replacement
5. **pdf-parse v1.1.1** — prostsza API, lepsze CJS compat (wymaga dummy test fixture)
6. **React Router v7** — wymagana przez package, MemoryRouter w testach (jsdom AbortSignal incompatibility)
7. **shadcn/ui ręcznie** — komponenty pisane bezpośrednio, nie przez CLI
8. **Viktor: DB bezpośrednio** — narzędzia wołają bazę, nie HTTP endpoints (unika overhead + auth)
9. **Model routing keyword heuristic** — deterministyczny, łatwy do tuningu
10. **Frontend Dockerfile buduje z roota** — potrzebuje pnpm-workspace.yaml + shared package

---

## Testy

- Backend: 137 passed, 5 skipped (DB integration), 0 failed
- Frontend: 36 passed, 0 failed
- Typecheck: czyste (backend + frontend)
- Łącznie: 173 testy (+ 2 skipped DB = 175 z kontekstem pipeline)
- E2E: odroczone (wymagają infrastruktury + zbudowanych obrazów Docker)

---

## Utworzone/zmodyfikowane pliki (główne)

### Backend (`packages/backend/src/`)
- `auth/` — login.ts, middleware.ts, constants.ts
- `db/` — connection.ts, migrate.ts, migrations/, seeds/
- `import/` — orchestrator.ts (podzielony na sub-importery), routes.ts
- `parsers/` — saldeo-parser.ts, schedule-parser-excel.ts (podzielony per format), schedule-parser-pdf.ts, warehouse-parser.ts, nip-normalizer.ts
- `routes/` — receivables.ts, payables.ts, liabilities.ts, forecast.ts, warehouse.ts, cashflow.ts, monthly-input.ts, dashboard-summary.ts
- `services/` — nbp-rates.ts, cashflow-projection.ts
- `viktor/` — chat.ts, tools.ts, model-router.ts, system-prompt.ts
- `server.ts`

### Frontend (`packages/frontend/src/`)
- `features/auth/` — login-page.tsx
- `features/dashboard/` — entity-tabs.tsx, summary-cards.tsx, summary-page.tsx
- `features/import/` — import-page.tsx, file-dropzone.tsx, import-status.tsx
- `features/receivables/` — receivables-page.tsx, invoice-table.tsx
- `features/payables/` — payables-page.tsx
- `features/liabilities/` — liabilities-page.tsx, liability-list.tsx, liability-timeline.tsx
- `features/forecast/` — forecast-page.tsx
- `features/warehouse/` — warehouse-page.tsx
- `features/monthly-input/` — monthly-input-form.tsx, monthly-input-page.tsx
- `features/viktor/` — viktor-chat.tsx, message-bubble.tsx
- `layouts/` — dashboard-layout.tsx
- `router.tsx`, `lib/api-client.ts`

### Shared (`packages/shared/src/`)
- `types/invoice.ts`, `types/liability.ts`, `index.ts`

### Infra
- `packages/frontend/Dockerfile`, `packages/frontend/nginx.conf`
- `packages/backend/Dockerfile`
- `docker-compose.yml`, `docker-compose.prod.yml`
- `.dockerignore`

---

## Wyciągnięte wnioski

1. **Vite 5.x zamiast 6+** — Node 24 incompatibility z `#module-sync-enabled` package imports
2. **pdf-parse wymaga dummy fixture** — `test/data/05-versions-space.pdf` potrzebny przy imporcie
3. **MemoryRouter w testach React Router v7** — jsdom nie obsługuje AbortSignal poprawnie
4. **cross-env potrzebny na Windows** — skrypty npm z NODE_ENV nie działają natywnie
5. **NBP retry delay w testach** — wykrywanie VITEST env var do skrócenia czasu
6. **SQL duplikacja vs fragmenty** — sql tagged template nie obsługuje fragment interpolation, oddzielne query branches per entity
7. **LFR.pdf i nowy harmonogram** — skany PDF bez OCR, wymagają ręcznego wpisu

---

## Nieukończone elementy (świadoma decyzja)

- **E2E testy** — wymagają uruchomionej infrastruktury (frontend + backend + DB + Docker)
- **Coolify config + SSL** — wymagają dostępu do VPS (konfiguracja infrastrukturalna)
- **pg_dump backup** — wymaga crona na VPS
- **Nity z code review** (P3) — duplikacja toNumber/parseDate, Promise.all dla dashboard-summary, CSP headers w nginx
- **P2 z Fazy 4** — rate limiting Viktor, Anthropic client singleton, tools.ts podział, testy chat.ts

---

## Źródła
- Requirements: `docs/dev-brainstorms/2026-04-11-dashboard-finansowy-requirements.md`
- Plan techniczny: `docs/plans/2026-04-12-001-feat-dashboard-finansowy-plan.md`
- Code reviews: `docs/completed/dashboard-finansowy/review-faza-{1..5}.md`
