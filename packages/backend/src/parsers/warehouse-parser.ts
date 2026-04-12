import * as XLSX from "xlsx";
import { ValidationError } from "./types.js";

export interface ParsedWarehouseItem {
  articleName: string;
  unitPrice: number;
  quantityComponent: number;
  quantityFinished: number;
  quantityTotal: number;
  valueComponent: number;
  valueFinished: number;
  valueTotal: number;
}

export interface ParsedWarehouse {
  items: ParsedWarehouseItem[];
  totalValue: number;
  eurRate: number | null;
}

/**
 * Warehouse file layout (multi-level headers):
 * Row 0: DND | ARTYKUŁ | (date) | ... | Ilość magazynowa | Operacje | ... | (date) | ... | Ilość magazynowa | Operacje (PLN) | ... | Wartość magazynu na koniec dnia | ... | M
 * Row 1: Cena | | niespakowany | gotowe | ... | PZ | MM | WZ | nieapakowany | gotowe | ... | PZ | MM | WZ | komponent | gotowe | (total value) | |
 * Row 2: (empty)
 * Row 3+: data rows
 *
 * Columns by index (0-based):
 * 0: Cena (selling price)
 * 1: ARTYKUŁ (article name)
 * 2-4: quantities (old period)
 * 5-7: operations qty
 * 8-10: quantities (current) - 8=niespakowany(component), 9=gotowe(finished), 10=total
 * 11-13: operations (PLN)
 * 14-16: values - 14=komponent, 15=gotowe, 16=total value
 * 18: M (cena zakupu - ignored)
 */
const COL_PRICE = 0;
const COL_ARTICLE = 1;
const COL_QTY_COMPONENT = 8;
const COL_QTY_FINISHED = 9;
const COL_QTY_TOTAL = 10;
const COL_VAL_COMPONENT = 14;
const COL_VAL_FINISHED = 15;
const COL_VAL_TOTAL = 16;

const DATA_START_ROW = 3;

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function parseWarehouseFile(
  buffer: Buffer,
  filename: string,
): ParsedWarehouse {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ValidationError("Workbook has no sheets", { file: filename });
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ValidationError("Sheet is empty", { file: filename });
  }

  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    defval: "",
  });

  // Validate that this looks like a warehouse file
  const row0 = data[0];
  if (
    !row0 ||
    String(row0[0] ?? "").trim().toUpperCase() !== "DND"
  ) {
    throw new ValidationError(
      'Expected warehouse file header starting with "DND"',
      { file: filename },
    );
  }

  const items: ParsedWarehouseItem[] = [];
  let totalValue = 0;
  let eurRate: number | null = null;

  for (let i = DATA_START_ROW; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const articleName = String(row[COL_ARTICLE] ?? "").trim();
    if (!articleName) {
      // Check for EUR rate row
      const cell2 = String(row[2] ?? "").trim().toLowerCase();
      if (cell2.includes("kurs eur")) {
        eurRate = toNumber(row[3]);
      }
      continue;
    }

    const unitPrice = toNumber(row[COL_PRICE]);
    const quantityComponent = toNumber(row[COL_QTY_COMPONENT]);
    const quantityFinished = toNumber(row[COL_QTY_FINISHED]);
    const quantityTotal = toNumber(row[COL_QTY_TOTAL]);
    const valueComponent = toNumber(row[COL_VAL_COMPONENT]);
    const valueFinished = toNumber(row[COL_VAL_FINISHED]);
    const valueTotal = toNumber(row[COL_VAL_TOTAL]);

    // Skip rows with zero quantity and zero value (empty article entries)
    if (quantityTotal === 0 && valueTotal === 0) continue;

    items.push({
      articleName,
      unitPrice,
      quantityComponent,
      quantityFinished,
      quantityTotal,
      valueComponent,
      valueFinished,
      valueTotal,
    });

    totalValue += valueTotal;
  }

  return { items, totalValue, eurRate };
}
