import type Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_receivables",
    description:
      "Pobiera naleznosci (faktury sprzedazowe FS) per podmiot lub dla calej grupy. Mozna filtrowac po okresie: 7d (najblizsze 7 dni), 30d (7-30 dni), overdue (przeterminowane).",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description:
            "Kod podmiotu (cgesp, dngro, dndsp, tdmsp, tdpsp) lub 'all' dla calej grupy",
          default: "all",
        },
        period: {
          type: "string",
          enum: ["7d", "30d", "overdue"],
          description: "Okres: 7d, 30d, lub overdue",
          default: "7d",
        },
      },
      required: [],
    },
  },
  {
    name: "get_payables",
    description:
      "Pobiera zobowiazania handlowe (faktury zakupowe FZ) per podmiot lub dla calej grupy.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
        period: {
          type: "string",
          enum: ["7d", "30d", "overdue"],
          description: "Okres: 7d, 30d, lub overdue",
          default: "7d",
        },
      },
      required: [],
    },
  },
  {
    name: "get_overdue",
    description:
      "Pobiera przeterminowane naleznosci i zobowiazania handlowe. Zwraca osobno receivables i payables overdue.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
      },
      required: [],
    },
  },
  {
    name: "get_liability_schedule",
    description:
      "Pobiera harmonogram zobowiazan finansowych (kredyty, leasingi, limity) na N miesiecy w przod.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
        months: {
          type: "number",
          description: "Liczba miesiecy w przod (max 36)",
          default: 12,
        },
      },
      required: [],
    },
  },
  {
    name: "get_cashflow_projection",
    description:
      "Oblicza projekcje cashflow (plynnosci) grupy na N dni. Formula: saldo_start + wplywy - wyplywy. Zwraca poziom ryzyka.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Liczba dni projekcji (domyslnie 30)",
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: "get_warehouse_value",
    description:
      "Pobiera stan i wartosc magazynu (tylko DND Group / dngro). Zwraca liste artykulow z ilosciami i wartosciami.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_entity_summary",
    description:
      "Pobiera podsumowanie finansowe podmiotu lub calej grupy: naleznosci 30d, zobowiazania 30d, zobowiazania finansowe, saldo bankowe, wartosc magazynu, przeterminowane.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
      },
      required: [],
    },
  },
];
