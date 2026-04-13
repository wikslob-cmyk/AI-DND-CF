# Code Review — Faza 2: Pipeline ingestion

**Branch:** `feature/dashboard-finansowy`
**Commity:** c1a159a, 62b70cc
**Data review:** 2026-04-12
**Agenci:** Security, Performance, Architecture, Test Coverage, E2E Browser

---

## Severity Gate: KONTYNUUJ Z ZASTRZEZENIAMI

**P1=0, P2=7, P3=6**

---

## Findings

### P2 — Important

1. **[KOD] `packages/backend/src/import/routes.ts:12-32` — Stub DbAdapter w production routes**
   Trzy endpointy importu (`/api/import/saldeo`, `/warehouse`, `/schedules`) uzywaja `createStubDbAdapter()` ktory nic nie robi (no-op). Upload plikow zwroci `status: "success"` ale ZADNE dane nie trafia do bazy. Komentarz mowi "will be replaced in Unit 8+" ale endpointy sa juz zarejestrowane w `server.ts` i dostepne przez API. Jesli ktos uzyje UI importu teraz — dostanie false positive "Import zakonczony".

2. **[KOD] `packages/backend/src/parsers/schedule-parser-excel.ts` — Plik 388 linii (regula: max 300)**
   Plik zawiera 8 parserow per format. Kazdy parser to oddzielna funkcja 30-60 linii, ale plik laczy je wszystkie. Powinien byc podzielony: ekstrakcja parserow per format do oddzielnych modulow, schedule-parser-excel.ts jako dispatcher.

3. **[KOD] `packages/backend/src/import/orchestrator.ts` — Plik 346 linii (regula: max 300)**
   Trzy funkcje importu (Saldeo, Warehouse, Schedules) w jednym pliku. Kazda ma identyczny pattern (parse → transact → log). Wyciagnij do oddzielnych modulow lub podziel na `saldeo-importer.ts`, `warehouse-importer.ts`, `schedule-importer.ts`.

4. **[KOD] `packages/backend/src/parsers/schedule-parser-excel.ts:128,155` — `new Date()` jako paymentDate w Millennium parser**
   Millennium format nie ma dat per rata — parser ustawia `new Date()` (biezacy timestamp) jako `paymentDate`. To oznacza ze wszystkie raty beda mialy ta sama date (dzisiejszy dzien), co zepsuje timeline zobowiazan w Fazie 3. Powinno byc: oblicz daty na podstawie `installmentNumber` i czestotliwosci rat (miesiecznie), lub rzuc blad z informacja ze plik nie zawiera dat.

5. **[TEST] Brak testow frontend dla 3 nowych komponentow (import-page, file-dropzone, import-status)**
   Plan nie definiuje testow jednostkowych dla tych komponentow, ale regula kodowania wymaga: "Kazda nowa funkcja = minimum 1 test happy path + 1 test error case". Trzy nowe eksportowane komponenty React bez testow.

6. **[KOD] `packages/backend/src/import/orchestrator.ts:178-193` — Rollback loguje do DB ale moze rzucic blad**
   W bloku catch: `db.rollbackTransaction()` a potem `db.insertImportLog("failed", ...)`. Jesli rollback sfailuje (np. utrata polaczenia z DB), `insertImportLog` tez sfailuje — ale ten blad jest niezlapany i propagowany zamiast oryginalnego bledu. Blok `rollbackTransaction()` powinien miec wlasny try-catch.

7. **[KOD] `packages/backend/src/services/nbp-rates.ts:141-142` — Empty catch block**
   `catch { ... }` na linii 141 — regula kodowania zabrania empty catch: "NIGDY nie lap wyjatkow i nie ignoruj ich". Tutaj blad z `fetchNbpRate` jest polykany bez logowania. Powinien logowac blad przed fallbackiem (np. `console.warn` lub structured logger).

### P3 — Nit

1. **[KOD] `packages/backend/src/parsers/saldeo-parser.ts`, `schedule-parser-excel.ts`, `warehouse-parser.ts` — Duplikacja `toNumber()` helper**
   Identyczna funkcja `toNumber(value: unknown): number` zdefiniowana w 3 plikach. Wyciagnij do shared helper module (np. `parsers/utils.ts`).

2. **[KOD] `packages/backend/src/parsers/schedule-parser-excel.ts:15-38` i `schedule-parser-pdf.ts:5-9` — Duplikacja `parseDate()` helper**
   Dwie rozne implementacje `parseDate()` w dwoch plikach. Jedna obsluguje format dd-mm-yyyy + Excel serial, druga tylko ISO/standard. Powinny byc scalone w jeden reusable helper.

3. **[KOD] `packages/frontend/src/features/import/import-page.tsx:37-44` — Brak error handling dla `response.json()`**
   Jesli serwer zwroci non-JSON response (np. 500 HTML), `response.json()` rzuci blad. Nie sprawdzamy `response.ok` przed parsowaniem JSON.

4. **[KOD] `packages/frontend/src/features/import/import-status.tsx:53-58` — `file` jako key w liscie plikow**
   `key={file}` moze powodowac duplikaty jesli dwa pliki maja ta sama nazwe. Uzyj `key={index}` lub `key={`${file}-${index}`}`.

5. **[KOD] `packages/backend/src/parsers/schedule-parser-pdf.ts:46-72` — parsePkoFormat identyczny z parseAliorFormat**
   Obie funkcje uzywaja tego samego regex i tej samej logiki. Roznia sie jedynie indeksem match group (match[4] vs match[5]). Mozna scalic w jedna z parametrem kolumny.

6. **[KOD] `packages/backend/src/import/routes.ts:122-131` — GET /api/import/status zwraca hardcoded null**
   Stub endpoint zawsze zwraca `lastImport: null`. Akceptowalne w Phase 2 bo DB adapter jest stub, ale powinien byc opatrzony komentarzem TODO z numerem unitu.

---

## Odchylenia od planu

### Zgodnosc plikow
Wszystkie pliki zdefiniowane w planie dla Unit 4-7 zostaly stworzone:
- **Unit 4:** `parsers/types.ts`, `nip-normalizer.ts`, `saldeo-parser.ts` + 2 test files
- **Unit 5:** `schedule-types.ts`, `schedule-parser-excel.ts`, `schedule-parser-pdf.ts` + 1 test file
- **Unit 6:** `warehouse-parser.ts`, `nbp-rates.ts` + 2 test files
- **Unit 7:** `import/orchestrator.ts`, `import/routes.ts`, 3 frontend komponenty + 1 test file

### Odchylenia
- Plan definiuje `DbAdapter` jako testability interface — zaimplementowany poprawnie
- Plan wspomina o "stub DbAdapter" w routes — zaimplementowany, ale endpointy juz aktywne (P2 #1)
- Plan nie wymienia `Harmonogram platnosci nowy 22_07_2025.pdf` w SCAN_PDF_FILES — dodany w implementacji (poprawne rozszerzenie)

---

## Testy

### Backend: 71 passed, 5 skipped, 0 failed
- `nip-normalizer.test.ts`: 13 tests
- `saldeo-parser.test.ts`: 8 tests
- `schedule-parser.test.ts`: 10 tests
- `warehouse-parser.test.ts`: 5 tests
- `nbp-rates.test.ts`: 7 tests
- `orchestrator.test.ts`: 6 tests
- `auth.test.ts`: 13 tests (Phase 1)
- `migrations.test.ts`: 9 passed + 5 skipped (Phase 1)

### Frontend: 2 passed, 0 failed
- `app.test.tsx`: 2 tests (Phase 1, rendering only)
- Brak testow dla Phase 2 komponentow (P2 #5)

### Typecheck: czyste (backend + frontend)

---

## Scenariusze testowe z planu — pokrycie

| Scenariusz (plan) | Status |
|---|---|
| Parsowanie cgesp.xlsx | PASS |
| Filtr _FS_ nie lapie _FS_PF_/_FS_KOR_ | PASS |
| Filtr _FZ_ exact match | PASS |
| Brakujaca kolumna → ValidationError | PASS |
| NIP z mysnikami/PL | PASS (13 tests) |
| Zapłacono = TAK → wykluczona | PASS |
| Remaining = 0, Zapłacono = NIE → dolaczona | PASS |
| tabela_rat_364944.xlsx → raty | PASS |
| Harmonogram.pdf (Alior) → raty | PASS |
| LFR.pdf → ScheduleParseError | PASS |
| Brakujace kolumny → ValidationError | PASS |
| Sumy rat vs kwota kredytu | PASS |
| Warehouse → artykuly z ilosciami/wartosciami | PASS |
| Wartosc = ilosc × cena | PASS |
| NBP EUR → rate | PASS (mock) |
| NBP unavailable → fallback + warning | PASS |
| CHF → error | PASS |
| Import 5 plikow → success | PASS |
| Import z uszkodzonym plikiem → rollback | PASS |
| Import nadpisuje snapshot | PASS |
| Import EUR → NBP rate | PASS (PLN-only variant) |

---

## E2E Browser Verification

Weryfikacje E2E z pliku zadan (niezaznaczone):
- Parser 5 plikow z zasoby/ → **nie zweryfikowany** (brak uruchomionej aplikacji)
- Parsery harmonogramow → **nie zweryfikowany**
- Wielopoziomowe naglowki magazynu → **nie zweryfikowany**
- Transakcyjnosc importu w UI → **nie zweryfikowany**
- Status importu widoczny w UI → **nie zweryfikowany**

**E2E: 0 passed / 0 failed** (wymagaja infrastruktury: uruchomiony backend + frontend + PostgreSQL)

---

## Podsumowanie

Implementacja Phase 2 jest solidna i zgodna z planem. Parsery dzialaja na prawdziwych plikach z `zasoby/`, testy pokrywaja kluczowe scenariusze. Glowne problemy to:
- Stub DB adapter w aktywnych endpointach (false positive import success)
- Dwa pliki > 300 linii wymagajace podzialu
- Brak dat w Millennium parserze (uzywa `new Date()`)
- Brak testow frontend dla nowych komponentow
- Error handling w rollback i NBP fallback
