---
title: "Fullstack monorepo dashboard finansowy - architektura i kluczowe wzorce"
date: 2026-04-12
category: build-errors
severity: high
stack:
  - React 19
  - TypeScript
  - Fastify 5
  - PostgreSQL
  - pnpm workspaces
  - Claude API
  - Docker
tags:
  - monorepo
  - function-calling
  - model-routing
  - jwt-auth
  - cashflow-projection
  - excel-import
status: verified
last_verified: 2026-04-12
---

# Fullstack monorepo dashboard finansowy - architektura i kluczowe wzorce

## Symptomy

- Potrzeba dashboardu finansowego dla grupy 5 podmiotow DND z: importem faktur Excel, harmonogramami kredytow, projekcja cashflow, AI asystentem (Viktor)
- Wymagania: pnpm monorepo, React 19 + Fastify 5, JWT auth, PostgreSQL, Claude API function calling z model routing
- 5 faz implementacji, 175 testow, review po kazdej fazie

## Root Cause

Zlozonosc wynikala z integracji wielu systemow: parsowanie roznych formatow Excel (faktury FS/FZ, harmonogramy kredytowe, stany magazynowe), projekcja cashflow z wieloma zrodlami danych (salda bankowe, naleznosci, zobowiazania, raty, VAT), oraz AI asystent z function calling ktory musi odpytywac te dane w czasie rzeczywistym.

## Rozwiazanie

### 1. Model routing (Haiku/Sonnet) - optymalizacja kosztow API

Keyword-based router kieruje proste pytania do Haiku (tanszy), a analityczne do Sonnet:

```typescript
// packages/backend/src/viktor/model-router.ts
const SONNET_KEYWORDS = [
  "prognoza", "projekcja", "cashflow", "ryzyko", "analiza",
  "trend", "scenariusz", "rekomendacja", "strategia", "optymalizacja",
] as const;

export function selectModel(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const keyword of SONNET_KEYWORDS) {
    if (lower.includes(keyword)) return SONNET_MODEL;
  }
  return HAIKU_MODEL;
}
```

### 2. Function calling loop z limitem rund

AsyncGenerator pattern z max 5 tool rounds, koszt tracking per-request:

```typescript
// packages/backend/src/viktor/chat.ts
export async function* streamChat(
  messages: ChatMessage[],
  logger: FastifyBaseLogger,
): AsyncGenerator<string, CostEntry> {
  const MAX_TOOL_ROUNDS = 5;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({ model, tools, messages });
    // yield text blocks, execute tool calls, push results back
    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") break;
  }
  return costEntry; // tracks input/output tokens + USD cost
}
```

### 3. Cashflow projection formula

```
projekcja = saldo_start + wplywy_30d - wyplywy_30d
wyplywy = raty_harmonogramow + rolling_ING_prorata + zobowiazania_handlowe + wynagrodzenia_prorata + VAT
```

Risk levels: `ok` (projekcja > 15% wyplywow), `warning` (< 15%), `critical` (< 0).

### 4. JWT auth ze shared password + HttpOnly cookie

Fastify JWT plugin z cookie transport zamiast Authorization header - bezpieczniejsze dla SPA.

### 5. Monorepo structure

```
packages/
  backend/   - Fastify 5, postgres.js, @anthropic-ai/sdk
  frontend/  - React 19, Vite, TailwindCSS, shadcn/ui
```

Docker multi-stage builds: backend (Node Alpine), frontend (nginx + SPA).

## Komendy diagnostyczne

```bash
# Sprawdz strukture monorepo
pnpm -r list --depth 0

# Uruchom testy
pnpm -r test

# Sprawdz health endpoint
curl http://localhost:3001/api/health

# Docker build
docker compose -f docker-compose.prod.yml build
```

## Zapobieganie

- Model routing: monitoruj koszty per-model w logach (structured logging z pino). Dodaj alerty gdy dzienny koszt > budget/30
- Function calling: zawsze limituj max tool rounds (tu: 5) zeby uniknac nieskonczonej petli
- Cashflow projection: waliduj entity_count - jesli brak danych salda, projekcja jest niedokladna (warning w response)
- Excel import: waliduj strukture arkusza PRZED parsowaniem - fail fast z czytelnym bledem

## Powiazane

- Brak powiazanych dokumentow (pierwszy wpis w docs/solutions/)

## Kontekst

- Projekt: Dashboard finansowy grupy DND (5 podmiotow: CGESP, DNGRO, DNDSP, TDMSP, TDPSP)
- Branch: feature/dashboard-finansowy (15 commitow, 5 faz)
- 175 testow (Vitest), review po kazdej fazie z cyklem poprawek
- Git user: Viktor Slob
- Srodowisko: Node 24, pnpm 10, PostgreSQL 17, Docker
