# Code Review Fazy 4 — AI i projekcja

**Data:** 2026-04-12
**Commit:** f079ac7
**Reviewer:** Multi-agent review (5 agentow)
**Pliki sprawdzone:** 19 (z git diff --stat)

---

## Severity Gate: KONTYNUUJ Z ZASTRZEZENIAMI

**P1 (blocking): 0** | **P2 (important): 5** | **P3 (nit): 6**

---

## Skonsolidowane findings

### P2 — Important

1. **[P2-SEC] `packages/backend/src/routes/viktor.ts` — Brak rate limiting na endpoint `/api/viktor/chat`**
   Agent: Security
   Viktor chat woła Claude API ($$$). Bez rate limitingu pojedynczy user moze generowac nieograniczone koszty API. Endpoint login ma rate limit (dodany w Fazie 1 fix), ale viktor/chat — nie. Krytyczne dla budżetu $20/mies.

2. **[P2-PERF] `packages/backend/src/viktor/chat.ts:42-48` — Nowa instancja Anthropic client tworzona per request**
   Agent: Performance
   `getAnthropicClient()` tworzy `new Anthropic({ apiKey })` przy kazdym wywolaniu `streamChat()`. Powinien byc singleton lub cache na poziomie modulu. Nie jest to critical perf issue, ale jest to niepotrzebna alokacja i potencjalnie moze powodowac problemy z connection pooling SDK.

3. **[P2-ARCH] `packages/backend/src/viktor/tools.ts` — Plik ma 398 linii, przekracza regule 300 linii**
   Agent: Architecture
   Plik zawiera 7 definicji narzedzi + 7 funkcji wykonawczych. Kazda funkcja jest relativnie prosta, ale calosc jest za duza. Wyodrebnij `TOOL_DEFINITIONS` (deklaracje schematow) do osobnego pliku `tool-definitions.ts`, a executory do `tool-executors.ts`.

4. **[P2-TEST] `packages/frontend/src/features/viktor/` — Brak jakichkolwiek testow frontend dla komponentow Viktor**
   Agent: Scenario Exploration
   ViktorChat (213 linii) i MessageBubble (30 linii) nie maja testow. ViktorChat zawiera istotna logike SSE parsing, error handling i state management. Minimum smoke test + test SSE parsing jest wymagany.

5. **[P2-TEST] `packages/backend/src/viktor/__tests__/` — Brak testu dla `chat.ts` (streamChat)**
   Agent: Scenario Exploration
   `chat.ts` jest centralnym modulem Viktora (function calling loop, cost calculation, tool error handling). Ma 0 testow. Testy istnieja dla `tools.ts` i `model-router.ts`, ale nie dla samego `chat.ts`. Wymaga przynajmniej testu: cost calculation, tool error fallback, max rounds limit.

### P3 — Nit

1. **[P3-SEC] `packages/backend/src/viktor/chat.ts:35` — Fallback pricing dla nieznanego modelu defaultuje do Sonnet**
   Agent: Security
   `MODEL_PRICING[model] ?? { input: 3, output: 15 }` — jesli model ID sie zmieni, cost logging bedzie niedokladne. Nie jest to security issue, ale moze prowadzic do niedoszacowania kosztow.

2. **[P3-PERF] `packages/backend/src/viktor/tools.ts:195-226` — `get_overdue` wykonuje 4 query do DB (2x overdue total + 2x full detail)**
   Agent: Performance
   Mozna zredukowac do 2 queries (detail zawiera total). Nie jest to N+1, ale jest nadmiarowe.

3. **[P3-ARCH] `packages/frontend/src/features/viktor/viktor-chat.tsx:177` — Uzycie array index jako React key**
   Agent: Architecture
   `key={idx}` w mapowaniu wiadomosci. Poniewaz wiadomosci sa append-only i nigdy nie sa usuwane/reordowane, jest to akceptowalne, ale lepiej byloby uzyc unikalnego ID (np. timestamp + role).

4. **[P3-ARCH] `packages/frontend/src/features/viktor/viktor-chat.tsx` — Brak AbortController dla fetch w useCallback**
   Agent: Architecture
   Jesli komponent jest odmontowany podczas aktywnego streamu SSE, fetch nie zostanie anulowany. Reguła 13 (Async): useEffect z async = ZAWSZE AbortController. Tutaj fetch jest w callback, nie w useEffect, ale ryzyko memory leak istnieje.

5. **[P3-ARCH] `packages/backend/src/services/cashflow-projection.ts:118` — Semantyka VAT moze byc nieoczywista**
   Agent: Architecture
   Komentarz mowi "25. nastepnego miesiaca", ale logika uzywa `new Date(currentYear, currentMonth, 25)` co jest poprawne (JS month 0-indexed, wiec currentMonth = nastepny miesiac). Komentarz wart dodania inline.

6. **[P3-ARCH] `packages/backend/src/viktor/chat.ts:165` — Porownanie kosztu z dziennym budzetem zamiast miesięcznym**
   Agent: Architecture
   `costUsd > MONTHLY_COST_WARNING_USD / 30` porownuje koszt JEDNEGO requestu z dziennym budzetem. Przy Haiku ($0.25/1M) typowy request kosztuje ~$0.001, a dzienni budzet = $0.67. Warning nigdy sie nie odpali w normalnym uzyciu. Logika powinna sledzic sumaryczny koszt (np. w DB) i porownywac z miesięcznym limitem.

---

## Odchylenia od planu

Brak istotnych odchylen. Implementacja jest zgodna z planem technicznym:
- Wszystkie pliki z sekcji "Pliki:" w planie istnieja
- Wszystkie scenariusze testowe unit sa zaimplementowane
- 7 narzedzi Viktora zgodne z tabela w planie
- Model router z keyword heuristic zgodny z planem
- Cashflow formula zgodna z opisem w planie

---

## Weryfikacja testow

### Backend (133 passed, 5 skipped, 0 failed)
- model-router.test.ts: 13 testow (routing keywords, case insensitive, empty string)
- tools.test.ts: 10 testow (7 narzedzi + definitions + error + system-prompt)
- cashflow-projection.test.ts: 8 testow (full data, warning, critical, brak salda, partial entities, overdue excluded, ING pro-rata, details)

### Frontend (29 passed, 0 failed)
- Brak testow dla komponentow Viktor (P2 finding)

### Typecheck
- Backend: czyste (0 errors)
- Frontend: czyste (0 errors)

---

## Weryfikacja E2E

**Status: 0/2 weryfikacji zrealizowanych**

Weryfikacje wymagajace infrastruktury (frontend + backend + DB + Anthropic API):
- [ ] Viktor chat -> pytanie -> odpowiedz z kwota PLN
- [ ] Function calling poprawnie wywoluje narzedzia

E2E nie mozliwe bez dzialajacego srodowiska z kluczem API Anthropic.

---

## Podsumowanie per agent

### Agent 1: Security Review
- 0x P1, 1x P2 (rate limiting), 1x P3 (cost fallback)
- ANTHROPIC_API_KEY: poprawnie walidowany (throw Error bez fallbacku)
- Body validation: JSON Schema na /api/viktor/chat z limitem 50 wiadomosci x 10000 znakow
- Auth: middleware onRequest poprawnie zastosowany
- Parametrized queries: tak (porsager/postgres tagged templates)

### Agent 2: Performance Review
- 0x P1, 1x P2 (client per request), 1x P3 (nadmiarowe queries w get_overdue)
- Function calling loop: max 5 round-tripow (poprawne)
- SSE streaming: poprawna implementacja (no buffering)
- Lazy loading: ViktorPage lazy-loaded w router.tsx

### Agent 3: Architecture & Code Quality
- 0x P1, 1x P2 (file size), 3x P3 (key index, AbortController, VAT semantics)
- SOLID: tools.ts narusza SRP (definicje + executory w jednym pliku)
- Nazewnictwo: poprawne (camelCase, descriptive)
- Import organization: poprawna (third-party, local grouped)
- Type safety: explicit types, brak `any`, poprawne type guards

### Agent 4: Scenario Exploration & Test Coverage
- 0x P1, 2x P2 (brak testow frontend Viktor, brak testow chat.ts)
- Happy path: pokryty w tools.test.ts i cashflow-projection.test.ts
- Error handling: tool error fallback testowany
- Boundary conditions: empty string routing, max days=90, max months=36
- Brakujace testy: chat.ts (cost calc, tool error fallback, max rounds)

### Agent 5: E2E Browser Verification
- 0/2 weryfikacji — wymaga infrastruktury
- Brak uruchomionego frontendu + backendu + klucza Anthropic API
