---
date: 2026-04-11
updated: 2026-04-12
topic: dashboard-finansowy-viktor
version: 2
status: gotowy-do-dev-plan
---

# Dashboard finansowy dla właścicieli grupy DND (Viktor)

> **Wersja 2** — wyniki sesji `/zroastuj-mnie` z 2026-04-12. Rozstrzygnięte mapowania danych, źródła prawdy, architektura i scope MVP. Wersja 1 (planowanie bez weryfikacji plików) zarchiwizowana w historii gita.

## Problem

Właściciele grupy spółek (CGE, DND Group, DND, TDM, TDP) nie mają jednego miejsca z aktualną sytuacją finansową: należności, zobowiązania, stany magazynowe, zobowiązania kredytowe i projekcja płynności. Dane są rozproszone w Saldeo (per podmiot), plikach Excel/PDF harmonogramów kredytowych i rozmowach z księgowymi. Brak konsolidacji utrudnia zarządzanie płynnością na poziomie grupy.

## Podmioty grupy (potwierdzone)

| Kod Saldeo | Pełna nazwa | Ma zobowiązania kredytowe | Ma magazyn |
|---|---|---|---|
| `cgesp` | CGE Sp. z o.o. | TAK (7 pozycji) | NIE |
| `dngro` | DND Group Sp. z o.o. | TAK (6 pozycji) | **TAK** (jedyny magazyn grupy) |
| `dndsp` | DND Sp. z o.o. (w zestawieniach też jako "DND zoo") | TAK (1 pozycja — Mercedes przeniesiony z CGE) | NIE |
| `tdmsp` | TDM Sp. z o.o. | TAK (1 pozycja) | NIE |
| `tdpsp` | TDP Sp. z o.o. | NIE | NIE |

Master zobowiązań (`Zobowiązania na dzień 24.02.2026.xlsx`) używa skrótów:
- "CGE" → `cgesp`
- "DND" → `dngro` (DND Group)
- "DND zoo" → `dndsp` (DND Sp. z o.o.)
- "TDM" → `tdmsp`

## Wymagania

### Ingestion danych (tygodniowy cykl)

- **R1.** System importuje **5 plików Saldeo** (po jednym per podmiot: cgesp, dngro, dndsp, tdmsp, tdpsp) — Excel, arkusz `Faktury`, 48 kolumn, nagłówki w wierszu 3. Klucz filtrowania:
  - Pole `Typ` ma format `{PODMIOT}_{KOD_DOKUMENTU}_` (np. `DNDSP_FZ_`, `CGESP_FS_PF_`)
  - **Należności**: `Typ` kończy się dokładnie na `_FS_` (nie `_FS_PF_`) i `Zapłacono = NIE`
  - **Zobowiązania handlowe**: `Typ` kończy się dokładnie na `_FZ_` i `Zapłacono = NIE`
  - **Wykluczone z obu widoków**: `_FS_PF_` (proformy sprzedaży), `_PK_` (polecenia księgowania), `_TOW_` (inne)
  - Kwota pozostała do zapłaty czytana z kolumny `Pozostało do zapłaty` (nie `Wartość brutto`)
  - Kolumny używane: `Numer dokumentu`, `Kontrahent`, `NIP`, `Termin płatności`, `Waluta`, `Wartość brutto`, `Zapłacono`, `Pozostało do zapłaty`, `Suma płatności częściowych`
  - Parser testowany regex: `^[A-Z]+_FS_$` dla należności, `^[A-Z]+_FZ_$` dla zobowiązań (rule: exact ending po prefixie podmiotu)
  - **Pliki zastępcze**: nowy import nadpisuje poprzedni snapshot (historia faktur nie jest zachowywana w bazie)
  - **Podmiot tdpsp** — importujemy jego plik Saldeo (ma faktury handlowe), choć nie ma żadnych zobowiązań kredytowych

- **R2.** System importuje jeden plik zestawienia magazynowego (`Zestawienie magazynowe DND`), dotyczy wyłącznie `dngro`. Struktura:
  - Nagłówki łączone z wierszy 1-2 (wielopoziomowe)
  - Używane kolumny: `Cena` (cena sprzedaży jednostkowa), `Artykuł`, ilość z kolumn 9-11 (`niespakowany`, `gotowe`, razem), wartość z kolumn 15-17 (`komponent`, `gotowe`, razem)
  - Wartość magazynu liczona w **cenie sprzedaży** (już wyliczona w kol. 17 jako `ilość × cena`)
  - Dashboard **sumuje** `komponent + gotowe` w jeden stan per artykuł
  - Kolumna `M` (cena zakupu) — ignorowana w dashboardzie

- **R3.** System importuje harmonogramy zobowiązań finansowych z dwóch źródeł:
  - **a) Pliki harmonogramów** (Excel/PDF) — source of truth dla rat miesięcznych (kapitał + odsetki per miesiąc). Mapowanie 15 pozycji master → pliki harmonogramów zebrane w sekcji "Mapowanie harmonogramów"
  - **b) Konfiguracja stała w bazie** — dla produktów rolling bez harmonogramu:
    - `dngro` / ING limit: 70 000 PLN kapitał + 18 000 PLN odsetki miesięcznie
    - `dngro` / ING faktoring: 0 PLN kapitał + 15 000 PLN odsetki miesięcznie
  - **c) Pozycje informacyjne** (bez wpływu na cashflow, widoczne w dashboardzie w osobnej sekcji):
    - `cgesp` / ISAG (IKEA) — `pending_write_off`, do umorzenia
    - NCBiR 750 000 PLN, NCBiR 3 200 000 PLN, PARP 950 000 PLN — informacyjne, niewymagalne

- **R4.** System udostępnia formularz ręcznego wprowadzania danych **per podmiot per miesiąc**:
  - Kwota VAT do zwrotu
  - Kwota wynagrodzeń netto
  - **Saldo bankowe** (punkt startowy dla projekcji cashflow)
  - Dane przechowywane historycznie (każdy miesiąc ma własne wartości, edycja wstecz możliwa)
  - Aktualizacja: **tygodniowa**, w ramach tego samego momentu co wgranie nowych plików Saldeo. Saldo bankowe aktualizuje się każdy tydzień; VAT i wynagrodzenia w praktyce są aktualizowane raz w miesiącu (10. dnia)

### Widoki dashboardu

- **R5.** Dashboard prezentuje **widok skonsolidowany grupy** (suma z 5 podmiotów przeliczona do PLN) + **zakładki per podmiot** (5 zakładek: CGE, DND Group, DND, TDM, TDP).

- **R6.** Pozycje walutowe przeliczane na PLN kursem NBP pobieranym **raz przy imporcie tygodniowym** i zapisywanym w bazie. Wszystkie widoki używają tego kursu do kolejnego importu. Dane Saldeo zawierają już historyczny kurs przeliczenia na PLN — używany dla wartości historycznych (np. "Kwota netto w PLN" z pliku), kurs NBP pobierany używany dla aktualnych stanów w walucie obcej.

- **R7a.** Widok **należności per kontrahent** — trzy sekcje: "W tym tygodniu", "W kolejnych 30 dniach", "Przeterminowane (oczekujące)". Przeterminowane liczone jako `termin_płatności < dziś AND Zapłacono = NIE`.

- **R7b.** Widok **zobowiązania handlowe per kontrahent** — analogiczna struktura jak R7a.

- **R7c.** Widok **harmonogram płatności zobowiązań finansowych** (timeline/kalendarz) — łączy raty z harmonogramów i stałych konfiguracji rolling. Desktop-first, mobile best-effort.

- **R7d.** Widok **prognoza wpływów** — należności grupowane wg terminów płatności (naive — zakładamy że kontrahent płaci na termin). Przeterminowane w osobnej sekcji, NIE wliczane do prognozy 30 dni. *(Opcja A z sesji roastu.)*

- **R7e.** Widok **stany magazynowe** — tylko w zakładce `dngro`, pozostałe zakładki bez widoku magazynu. Lista per artykuł (ilość + wartość w cenie sprzedaży) + łączna wartość magazynu.

- **R7f.** Widok **lista zobowiązań finansowych** — kredyty, leasingi, limity, raty. Dodatkowa sekcja "Zobowiązania informacyjne / niewymagalne" zawierająca ISAG, NCBiR, PARP (bez wpływu na cashflow).

### AI asystent (Viktor)

- **R8.** Viktor odpowiada na pytania właścicieli w języku naturalnym. Implementacja: **Claude API + function calling**.
  - Modele: **Claude Haiku 4.5** domyślnie (tanie, szybkie), **Claude Sonnet 4.6** dla złożonych zapytań wymagających rozumowania
  - Narzędzia (do doprecyzowania w `/dev-plan`, szkic): `get_receivables`, `get_payables`, `get_liability_schedule`, `get_cashflow_projection(days)`, `get_overdue`, `get_warehouse_value`
  - Przykłady pytań: "Który kontrahent ma najwyższe przeterminowane należności?", "Ile łącznie wynoszą zobowiązania CGE?", "Czy grupa ma ryzyko płynności w najbliższych 30 dniach?"
  - Hardcap kosztowy: **$20 USD/miesiąc** w Anthropic Console

- **R9.** ~~Proaktywny alert płynności~~ **WYCIĘTY ze scope v2.** Logika projekcji cashflow pozostaje, ale uruchamiana tylko **on-demand** przez zapytanie do Viktora (narzędzie `get_cashflow_projection`). Formuła:
  - `saldo_grupy_start + wpływy_30d − wypływy_30d < 0.15 × wypływy_30d` → odpowiedź Viktora sygnalizuje ryzyko
  - `saldo_grupy_start` = suma pól `Saldo bankowe` z R4 dla wszystkich 5 podmiotów w **aktualnym miesiącu** (ostatnia wartość wpisana tygodniowo)
  - Rolling 30 dni od dzisiaj, per grupa skonsolidowana (nie per podmiot)
  - Wpływy 30d: należności z terminem w oknie (R7d, **bez** przeterminowanych — te są pokazywane osobno, niepewne)
  - Wypływy 30d: raty harmonogramów z terminem w oknie + konfiguracje rolling (ING limit, ING faktoring — pro-rata 30 dni) + zobowiązania handlowe z terminem w oknie + wynagrodzenia z R4 (pro-rata 30 dni) + VAT do US z R4 (termin 25. dnia następnego miesiąca)
  - Brak cron joba, brak emaila, brak push notification — tylko odpowiedź na pytanie właściciela

### Dostęp i autoryzacja

- **R10.** Dashboard dostępny dla **max 5 osób** z **jednym wspólnym hasłem** (zmienna środowiskowa `DASHBOARD_PASSWORD`). Brak indywidualnych kont, brak ról, brak audytu. Po poprawnym loginie sesja JWT w HttpOnly cookie, ważność 30 dni.

## Architektura techniczna

| Warstwa | Decyzja |
|---|---|
| Hosting | VPS Hostinger (Ubuntu 24.04, 7 GB RAM) |
| Orchestracja deploymentu | Coolify (zarządza PostgreSQL + backend + frontend) |
| Frontend | React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui |
| Backend | Node.js (własny, Express/Fastify — do wyboru w `/dev-plan`) |
| Baza danych | PostgreSQL self-hosted (via Coolify) |
| Pipeline ingestion | Kod backendu uruchamiany przez przycisk "Importuj" w UI. Parser Excel (biblioteka `xlsx`), parser PDF (dla czytelnych PDF `pdf-parse`; skany wymagają OCR lub ręcznego wpisu harmonogramu). **n8n NIE jest używane w tym projekcie** (mimo że fizycznie istnieje na VPS do innych celów). |
| AI | Anthropic Claude API (Haiku 4.5 / Sonnet 4.6) |
| Autoryzacja | Shared password + JWT w HttpOnly cookie |
| Mobile | Desktop-first, mobile bez optymalizacji |

## Mapowanie harmonogramów → pozycje master

| # | Podmiot | Pozycja master | Plik harmonogramu | Uwagi |
|---|---|---|---|---|
| 1 | cgesp (CGE) | Millennium Leasing - piec | `tabela_rat_wynagrodzenia.xlsx` | Rata netto total 3 858,85 PLN (kapitał 2 792,92) |
| 2 | cgesp | Millennium Leasing - młyn + prasa | `tabela_rat_364944.xlsx` | Rata netto total 6 945,94 PLN (kapitał 5 164,53) |
| 3 | cgesp | Alior Bank (P25DzWRK00463M) | `Harmonogram.pdf` | Produkt w master opisany jako "limit w rachunku", faktycznie amortyzowany kredyt: kwota pierwotna 500 000 PLN, saldo 420 000 PLN (po 8 ratach), kapitał 10 000/mies + zmienne odsetki |
| 4 | cgesp | EFL - linia | `harmonogram_splat_EFL_6F01694.xlsx` | Rata 25 384,19 PLN |
| 5 | cgesp | EFL - piec (1 z 2) | `harmonogram_splat_EFL6F01696.xlsx` | Rata 7 923,68 PLN |
| 6 | cgesp | EFL - piec (2 z 2) | `harmonogram_splat_EFL6F01695.xlsx` | Druga identyczna umowa (dwa identyczne piece), harmonogramy treścią identyczne |
| 7 | cgesp | ISAG (IKEA) | — | **Pending write-off**, sekcja informacyjna |
| 8 | dngro (DND Group) | Santander Leasing - Volvo | `harmonogram_santander_NP6_00258_2023.xlsx` | Klient w umowie: "Dawid Niedbała DND" (historyczne); obecnie rata w dngro |
| 9 | dngro | Mercedes-Benz - S-klasa | `Harmonogram_platnosci-dndgr-mercedes.xlsx` | Umowa L393416A, rata 5 853,74 PLN |
| 10 | dngro | Lubelska Fundacja Rozwoju | `LFR.pdf` | **Skan PDF — wymaga OCR lub ręcznego wpisu harmonogramu do bazy** |
| 11 | dngro | PKO Leasing | `Harmonogram spłat_nr umowy 01450_PI_24.pdf` | Umowa 01450/PI/24, rata 15 324,90 PLN |
| 12 | dngro | ING limit | — (konfig stała) | 70 000 kapitał + 18 000 odsetki miesięcznie |
| 13 | dngro | ING faktoring | — (konfig stała) | 0 kapitał + 15 000 odsetki miesięcznie |
| 14 | dndsp (DND zoo) | Mercedes-Benz Leasing | `DNDspzoo-leasing.pdf` | Umowa L428607, rata 4 920,26 PLN. Historycznie PDF adresowany do CGE — umowa przeniesiona na dndsp |
| 15 | tdmsp (TDM) | Millennium Leasing - zgrzewarka | `TDM-leas.xlsx` | Umowa 371889 |

## Kluczowe decyzje (zmiany vs v1)

- **Harmonogramy = source of truth** dla rat miesięcznych, nie `Zobowiązania na dzień 24.02.2026.xlsx`. Master podawał różne metodologie per pozycja (dla Mercedes — pełna rata netto, dla Millennium — tylko rata kapitałowa). Harmonogramy są spójne i dokładne.
- **R9 wycięte** — brak proaktywnego cron alertu. Projekcja płynności tylko przez zapytanie do Viktora.
- **R4 poszerzone o saldo bankowe** — bez tego alert płynności byłby oderwany od rzeczywistości. Wpisywane ręcznie tygodniowo wraz z importem Saldeo.
- **Sekcja informacyjna** — ISAG (pending write-off), NCBiR 750k, NCBiR 3,2M, PARP 950k widoczne w R7f, ale poza cashflow.
- **n8n odrzucone** — mimo dostępności na VPS, ingestion pipeline pisany w kodzie backendu.
- **Autoryzacja uproszczona** — shared password + JWT, bez indywidualnych kont (świadomie zaakceptowane ryzyko braku audytu).
- **Desktop-first** — mobile nie jest gwarantowany, oszczędza kilka dni pracy.

## Kryteria sukcesu

- Właściciel znajdzie odpowiedź na "ile łącznie mamy przeterminowanych należności grupy?" w ciągu 2 minut bez pomocy księgowego.
- Viktor poprawnie odpowiada na pytania o cashflow na podstawie danych z harmonogramów + Saldeo + R4.
- Aktualizacja tygodniowa (wgranie 5 plików Saldeo + aktualizacja 5 × 3 pól R4) zajmuje < 10 minut.
- Wszystkie widoki odzwierciedlają dane z ostatniego importu — widoczna data aktualizacji.
- Hardcap Claude API $20/mies nie jest przekraczany przy typowym użyciu (5 osób × ~10 pytań/dzień).

## Granice scope'u

- **Brak integracji API** z Saldeo — wyłącznie import plików Excel.
- **Brak integracji API** z bankami — saldo bankowe wpisywane ręcznie w R4.
- **Brak OCR dla skanów PDF** (`LFR.pdf`) — harmonogram Lubelskiej Fundacji Rozwoju wpisywany ręcznie przy setupie.
- **Brak automatycznych przypomnień** do kontrahentów.
- **Brak funkcji fakturowania** ani edycji danych finansowych przez dashboard.
- **Brak wielopoziomowych uprawnień** — jeden wspólny dostęp.
- **Brak proaktywnych alertów** — projekcja płynności tylko on-demand.
- **Brak historii faktur** — tygodniowy import zastępuje poprzedni snapshot, brak trendów historycznych dla faktur. Historia zachowana tylko dla R4 (VAT/wynagrodzenia/saldo bankowe per miesiąc).
- **Mobile best-effort** — desktop-first, responsywność tablet-dół nie gwarantowana.

## Założenia / zależności

- Eksporty z Saldeo mają spójną strukturę 48 kolumn z nagłówkami w wierszu 3 (zweryfikowane na 5 plikach per podmiot).
- Plik master zobowiązań (`Zobowiązania na dzień...xlsx`) dostarcza wyłącznie listę aktywnych kontraktów — raty czytane z harmonogramów.
- Pliki harmonogramów są w formacie Excel albo czytelnego PDF. `LFR.pdf` (skan) wymaga ręcznego wpisu do bazy przy initial setupie.
- NBP publiczne API dostępne dla walut PLN/EUR/USD/GBP/innych — parser rzuca błąd dla nieznanej waluty.
- **Agregacja kontrahentów po NIP przez wszystkie podmioty**: ten sam NIP w fakturach CGE, DND Group i TDM traktowany jest jako **jeden kontrahent grupy**. Viktor przy pytaniach typu "ile łącznie winniśmy kontrahentowi X" sumuje zobowiązania ze wszystkich 5 podmiotów po `NIP`. W widokach per podmiot agregacja nie występuje — każdy podmiot widzi tylko swoje rozrachunki z tym kontrahentem.
- EUR występuje incydentalnie (1 faktura na 91 w sampled DNDSP) — konsolidacja walutowa to marginalny problem.
- VPS Hostinger ma wystarczające zasoby (7 GB RAM) dla React + Node.js + PostgreSQL + już działającego n8n.

## Otwarte pytania (odroczone do `/dev-plan`)

- Wybór backendu: Express vs Fastify vs Hono? (Wszystkie są akceptowalne, do decyzji w planie implementacji)
- Struktura tabel PostgreSQL — schema dla `liability`, `liability_schedule`, `invoice`, `warehouse_item`, `monthly_input` (R4), `exchange_rate`.
- Mechanizm wgrywania plików w UI — drag-n-drop dla 5 plików Saldeo + plików harmonogramów, walidacja formatu, preview przed importem.
- Format JWT + sekret — do ustalenia przy konfiguracji Coolify.
- Domena + SSL — który domain będzie kierować na VPS, Coolify robi Let's Encrypt automatycznie.
- Strategia backupów PostgreSQL — pg_dump via cron + retention.
- Setup Anthropic API key — token w env var backendu, nie wystawiany do frontendu.

## Następne kroki

→ `/dev-plan` do planowania technicznego implementacji na podstawie tego dokumentu (wersja 2)
