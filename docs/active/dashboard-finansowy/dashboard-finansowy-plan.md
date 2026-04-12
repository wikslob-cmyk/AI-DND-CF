# Dashboard finansowy dla grupy DND (Viktor) — Plan implementacji

Branch: `feature/dashboard-finansowy`
Ostatnia aktualizacja: 2026-04-12

## Podsumowanie wykonawcze

Budowa greenfield dashboardu finansowego konsolidującego dane z 5 spółek grupy DND. System importuje pliki Saldeo (należności/zobowiązania), harmonogramy kredytowe, dane magazynowe i ręczne dane miesięczne. AI asystent Viktor (Claude API) odpowiada na pytania w języku naturalnym. Deploy na VPS Hostinger via Coolify.

**Stack:** React 19 + Vite + TailwindCSS v4 + shadcn/ui | Fastify + TypeScript | PostgreSQL 16 | Claude API (Haiku 4.5 / Sonnet 4.6) | pnpm monorepo | Docker + Coolify

## Cele i zakres

### Cele
- Jedno miejsce dla właścicieli z aktualną sytuacją finansową grupy
- Konsolidacja należności, zobowiązań, harmonogramów kredytowych, stanów magazynowych
- Projekcja cashflow on-demand przez AI asystenta
- Tygodniowy cykl aktualizacji danych (< 10 min)

### Granice scope'u
- Brak integracji API z Saldeo/bankami — wyłącznie import plików Excel
- Brak OCR (LFR.pdf ręcznie), brak automatycznych przypomnień
- Brak wielopoziomowych uprawnień — shared password + JWT
- Desktop-first, mobile best-effort
- Brak historii faktur (snapshot nadpisujący)
- Brak proaktywnych alertów (R9 wycięte)

## Analiza obecnego stanu

**Projekt greenfield** — brak istniejącego kodu aplikacji. Dostępne:
- Zasoby danych w `zasoby/` (5 plików Saldeo, zestawienie magazynowe, 14 harmonogramów)
- Infrastruktura Claude Code (skills, agenty, pipeline dev-*)
- VPS Hostinger z Coolify (Ubuntu 24.04, 7 GB RAM, PostgreSQL gotowy do uruchomienia)

## Proponowany stan docelowy

Działająca aplikacja webowa z:
- 6 widoków dashboardu (należności, zobowiązania handlowe, zobowiązania finansowe/timeline, prognoza wpływów, magazyn, podsumowanie)
- Pipeline importu plików z walidacją i transakcyjnością
- Formularz ręcznych danych miesięcznych (R4)
- AI asystent Viktor z function calling
- Projekcja cashflow on-demand
- Deploy produkcyjny z SSL na Coolify

## Fazy wdrożenia

### Faza 1: Fundament (Units 1-3)
**Cel:** Działające środowisko dev z logowaniem.
- Monorepo pnpm (frontend + backend + shared)
- PostgreSQL schema + migracje + seed data
- Auth (shared password + JWT HttpOnly cookie)
**Nakład:** L

### Faza 2: Pipeline ingestion (Units 4-7)
**Cel:** Dane z plików w DB.
- Parser Saldeo (5 plików Excel, filtrowanie _FS_/_FZ_, normalizacja NIP)
- Parser harmonogramów (12 plików Excel/PDF, 15 pozycji master)
- Parser magazynu + NBP API (kursy walut)
- Orkiestrator importu (transakcyjny, UI drag-n-drop)
**Nakład:** XL

### Faza 3: Dashboard — widoki i formularz (Units 8-12)
**Cel:** Kompletny dashboard bez AI.
- Layout + nawigacja + zakładki podmiotów
- Formularz R4 (VAT, wynagrodzenia, saldo bankowe per podmiot per miesiąc)
- Widoki należności i zobowiązań handlowych (R7a, R7b)
- Widoki zobowiązań finansowych + timeline (R7c, R7f)
- Prognoza wpływów + magazyn (R7d, R7e)
- Widok skonsolidowany (R5)
**Nakład:** XL

### Faza 4: AI i projekcja (Units 13-14)
**Cel:** Pełna funkcjonalność z AI.
- Viktor AI (Claude API + function calling, 7 narzędzi)
- Projekcja cashflow on-demand (formuła z R9)
**Nakład:** L

### Faza 5: Deployment (Unit 15)
**Cel:** Aplikacja live.
- Dockerfiles (frontend nginx, backend Node)
- Konfiguracja Coolify (3 serwisy + env vars + SSL)
- Health checks + backup PostgreSQL
**Nakład:** M

## Kluczowe decyzje techniczne

| Decyzja | Wybór | Uzasadnienie |
|---|---|---|
| Backend framework | Fastify | Natywne TS, wbudowana walidacja JSON Schema, dobra wydajność |
| Struktura projektu | Monorepo pnpm | Współdzielone typy, łatwiejszy dev, jeden pipeline |
| DB library | `postgres` (porsager) | Lekka, natywne TS, bez ORM — elastyczne query |
| "Ten tydzień" | Rolling dziś + 7 dni | Zawsze aktualny niezależnie od dnia tygodnia |
| Import atomowość | Transakcja per cykl | Rollback przy błędzie w dowolnym pliku |
| NBP fallback | Cache + retry (3×2s) | Ostatni kurs + warning gdy API niedostępne |
| Model routing Viktor | Keyword heuristic | Deterministyczny, łatwy do tuningu |
| Brak danych R4 | Warning, nie fallback | Viktor nie zgaduje — wymaga danych |

## Ocena ryzyka

| Ryzyko | Prawdop. | Wpływ | Mitygacja |
|---|---|---|---|
| Zmiana struktury plików Saldeo | Średnie | Wysoki | Walidacja schematu przed importem, czytelne błędy |
| Harmonogramy z różnymi layoutami | Pewne | Średni | Parsery per format, testy na prawdziwych plikach |
| LFR.pdf (skan) bez OCR | Pewne | Niski | Ręczny wpis przy setupie, UI do edycji harmonogramu |
| NBP API downtime | Niskie | Niski | Cache + retry + fallback |
| Hardcap $20/mies Claude API | Średnie | Średni | Domyślnie Haiku (tańszy), logowanie kosztów |
| VPS 7 GB RAM (PG + Node + React + n8n) | Niskie | Średni | Nginx serving static (niski RAM), monitoring |

## Mierniki sukcesu

- Właściciel znajduje "przeterminowane należności grupy" w < 2 min
- Viktor poprawnie odpowiada na pytania cashflow
- Tygodniowy import (5 Saldeo + R4) < 10 min
- Widoki odzwierciedlają ostatni import — data aktualizacji widoczna
- Claude API < $20/mies (5 osób × ~10 pytań/dzień)

## Wymagane zasoby i zależności

### Zależności zewnętrzne
- VPS Hostinger z Coolify (Ubuntu 24.04, 7 GB RAM) — istniejący
- Domena + SSL (Let's Encrypt via Coolify) — do konfiguracji
- Anthropic API key — do uzyskania
- Pliki Saldeo od księgowych (5 plików tygodniowo)

### Główne biblioteki
- **Frontend:** react 19, vite, tailwindcss v4, @tanstack/react-query, react-router, shadcn/ui
- **Backend:** fastify, @fastify/jwt, @fastify/cookie, @fastify/multipart, @fastify/cors, postgres, xlsx, pdf-parse, @anthropic-ai/sdk
- **Shared:** zod (walidacja), typescript 5.7+

## Źródła
- Requirements doc: `docs/dev-brainstorms/2026-04-11-dashboard-finansowy-requirements.md`
- Plan techniczny: `docs/plans/2026-04-12-001-feat-dashboard-finansowy-plan.md`
