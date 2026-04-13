# Code Review Fazy 5 — Dashboard finansowy

**Data:** 2026-04-12
**Commit:** 7525ec5
**Reviewer:** Multi-agent (Security, Performance, Architecture, Scenarios, E2E)
**Scope:** Unit 15 — Dockerization + deploy na Coolify

---

## Severity Gate

**KONTYNUUJ Z ZASTRZEZENIAMI** (0x P1, 4x P2, 5x P3)

---

## Statystyki

- Plikow sprawdzonych: 9 (6 nowych, 3 zmodyfikowane)
- P1 [blocking]: 0
- P2 [important]: 4
- P3 [nit]: 5
- E2E: 0/4 (wymaga zbudowania obrazow Docker + infrastruktury Coolify)

---

## Skonsolidowane findings

### P2 [important]

#### P2-1: DATABASE_URL hardcoded fallback w produkcji
**Plik:** `packages/backend/src/db/connection.ts:3-5`
**Agent:** Security
**Opis:** `DATABASE_URL` ma fallback `postgres://dashboard:dashboard@localhost:5432/dashboard`. W kontenerze produkcyjnym, jesli env var nie zostanie ustawiony, backend polaczyl by sie z localhost (co nie zadziala w kontenerze, ale maskuje blad konfiguracji). Wzorzec analogiczny do naprawionego JWT_SECRET w Fazie 1 — powinien rzucac Error zamiast fallbacku.
**Fix:** Usun fallback, rzuc Error gdy brak `DATABASE_URL` w env (analogicznie do `getJwtSecret()`).

#### P2-2: pnpm@latest w Dockerfile — niedeterministyczny build
**Plik:** `packages/backend/Dockerfile:3`, `packages/frontend/Dockerfile:3`
**Agent:** Architecture
**Opis:** `corepack prepare pnpm@latest` oznacza ze rozne buildy moga uzyc roznych wersji pnpm. Moze prowadzic do roznic w lockfile resolution lub niekompatybilnosci. Powinno byc przypiety do konkretnej wersji.
**Fix:** Zmien na `corepack prepare pnpm@9.15.4` (lub wersja uzywana w dev) w obu Dockerfiles.

#### P2-3: Backend port 3001 wystawiony publicznie
**Plik:** `docker-compose.prod.yml:22-23`
**Agent:** Security
**Opis:** `ports: "3001:3001"` wystawia backend bezposrednio na hoscie. W produkcji caly ruch powinien isc przez nginx (port 80). Bezposredni dostep do backendu omija nginx security headers i potencjalnie SSL termination.
**Fix:** Usun `ports` z serwisu backend lub zmien na `expose: ["3001"]` (dostepny tylko w sieci Docker, nie na hoscie).

#### P2-4: Brak testu /api/health endpoint
**Plik:** `packages/backend/src/server.ts:71-83`
**Agent:** Scenarios
**Opis:** Health endpoint zostal rozszerzony o DB connectivity check (200/503), ale brak testu jednostkowego. To krytyczny endpoint dla health checkow Docker i Coolify — powinien miec test dla obu sciezek (DB connected -> 200, DB disconnected -> 503).
**Fix:** Dodaj test `health.test.ts` z mockiem `checkConnection` dla obu scenariuszy.

### P3 [nit]

#### P3-1: Brak Content-Security-Policy header w nginx
**Plik:** `packages/frontend/nginx.conf:17-19`
**Agent:** Security
**Opis:** Security headers zawieraja X-Frame-Options, X-Content-Type-Options, Referrer-Policy, ale brakuje Content-Security-Policy. CSP to najsilniejsza ochrona przed XSS.
**Sugestia:** Dodaj bazowy CSP: `add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline';" always;`

#### P3-2: Brak X-XSS-Protection header
**Plik:** `packages/frontend/nginx.conf:17-19`
**Agent:** Security
**Opis:** Mimo ze nowoczesne przegladarki uzywaja CSP zamiast XSS-Protection, dodanie `X-XSS-Protection: 0` jest rekomendowane (wylacza stary, potencjalnie niebezpieczny filtr).
**Sugestia:** Dodaj `add_header X-XSS-Protection "0" always;`

#### P3-3: Cache-Control brakuje na static assets z security headers
**Plik:** `packages/frontend/nginx.conf:22-26`
**Agent:** Performance
**Opis:** Location block dla static assets dodaje `Cache-Control: public, immutable` ale nie dziedziczy security headers z bloku server (nginx `add_header` w location nadpisuje server-level headers). Static assets nie beda mialy X-Frame-Options itp.
**Sugestia:** Dodaj security headers rowniez w location block dla static assets lub uzyj `include` snippet.

#### P3-4: Brak .dockerignore w packages/
**Plik:** `.dockerignore`
**Agent:** Architecture
**Opis:** `.dockerignore` wyklucza `*.md` co jest dobre, ale nie wyklucza `packages/*/src/**/*.test.ts` ani `packages/*/vitest.config.ts`. Pliki testowe sa kopiowane do builder stage niepotrzebnie (zwiekszaja rozmiar warstwy i czas budowania).
**Sugestia:** Dodaj `**/*.test.ts`, `**/*.spec.ts`, `**/vitest.config.ts` do `.dockerignore`.

#### P3-5: Health check start_period moze byc za krotki
**Plik:** `docker-compose.prod.yml:35`
**Agent:** Scenarios
**Opis:** `start_period: 10s` moze byc za krotki jesli backend potrzebuje czasu na polaczenie z zewnetrzna baza danych (Coolify managed PG). Przy cold start + DB connection timeout (10s z connection.ts), health check moze zglaszac unhealthy zanim backend zdazy sie polaczyc.
**Sugestia:** Zwieksz do `start_period: 30s` dla bezpieczenstwa.

---

## Odchylenia od planu

Plan techniczny dla Unit 15 definiuje:
1. Dockerfiles (frontend nginx + backend node) -- **zrealizowane**
2. docker-compose.prod.yml -- **zrealizowane**
3. Health checks -- **zrealizowane**
4. Konfiguracja Coolify (3 serwisy + env vars + SSL) -- **NIE zrealizowane** (wymaga infrastruktury)
5. Backup PostgreSQL (pg_dump via cron) -- **NIE zrealizowane** (wymaga infrastruktury)

Odchylenia 4-5 sa akceptowalne — wymagaja dostepu do VPS i nie sa kodem.

---

## Weryfikacja E2E

Faza 5 definiuje 4 checkboxy E2E:
- [ ] `docker compose up` -> frontend + backend + PostgreSQL startuja
- [ ] Frontend pod `https://[domena]` -> strona logowania
- [ ] Health endpoint `/api/health` -> 200
- [ ] Import plikow dziala po deploy

**Wynik:** 0/4 — wymaga zbudowania obrazow Docker i infrastruktury Coolify. Nie mozna zweryfikowac w srodowisku CI/dev.

---

## Podsumowanie

Faza 5 jest solidna implementacja infrastruktury deploymentu. Multi-stage Dockerfiles sa poprawnie skonstruowane, nginx config obsluguje SPA fallback i SSE streaming. Glowne problemy to:

1. **DATABASE_URL fallback** — powtorzenie wzorca naprawionego w Fazie 1 (JWT_SECRET). Latwy fix.
2. **Niedeterministyczny pnpm** — moze powodowac problemy w przyszlych buildach.
3. **Wystawiony port backendu** — potencjalne obejscie nginx w produkcji.
4. **Brak testu health** — krytyczny endpoint bez pokrycia testowego.

Zadne z powyzszych nie blokuje kontynuacji, ale P2-1 i P2-3 powinny byc naprawione przed pierwszym deployem produkcyjnym.
