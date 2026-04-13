# Learned Patterns

Reguly wyciagniete z rozwiazanych problemow w docs/solutions/. Zarzadzane przez /dev-compound i /dev-compound-refresh.

<!-- rule-count: 1 -->

- **Claude API function calling: zawsze limituj tool rounds i trackuj koszty**: Przy implementacji function calling loop ustaw MAX_TOOL_ROUNDS (np. 5) i breakuj gdy stop_reason === "end_turn". Trackuj input/output tokens per-request z kalkulacja kosztu USD. Bez limitu rund model moze wpasc w nieskonczona petle tool calls, generujac niekontrolowane koszty.
  Source: docs/solutions/build-errors/2026-04-12-fullstack-monorepo-dashboard-finansowy.md
