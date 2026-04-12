import * as XLSX from "xlsx";
import type {
  ParsedSchedule,
  ParsedScheduleEntry,
} from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { parseEflFormat } from "./schedule-parser-efl.js";
import { parseMillenniumFormat } from "./schedule-parser-millennium.js";
import { parseSantanderFormat } from "./schedule-parser-santander.js";
import { parseMercedesExcelFormat } from "./schedule-parser-mercedes.js";
import { parseTdmFormat } from "./schedule-parser-tdm.js";

type ParserFn = (data: unknown[][], filename: string) => ParsedScheduleEntry[];

const PARSER_MAP: Record<string, ParserFn> = {
  "tabela_rat_wynagrodzenia.xlsx": parseMillenniumFormat,
  "tabela_rat_364944.xlsx": parseMillenniumFormat,
  "harmonogram_splat_EFL_6F01694.xlsx": parseEflFormat,
  "harmonogram_splat_EFL6F01696.xlsx": parseEflFormat,
  "harmonogram_splat_EFL6F01695.xlsx": parseEflFormat,
  "harmonogram_santander_NP6_00258_2023.xlsx": parseSantanderFormat,
  "Harmonogram_platnosci-dndgr-mercedes.xlsx": parseMercedesExcelFormat,
  "TDM-leas.xlsx": parseTdmFormat,
};

export function parseScheduleExcel(
  buffer: Buffer,
  filename: string,
): ParsedSchedule {
  const parser = PARSER_MAP[filename];
  if (!parser) {
    throw new ScheduleParseError(
      `No parser configured for Excel file: ${filename}`,
      filename,
    );
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ScheduleParseError("Workbook has no sheets", filename);
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new ScheduleParseError("Sheet is empty", filename);
  }

  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    defval: "",
  });

  const entries = parser(data, filename);

  if (entries.length === 0) {
    throw new ScheduleParseError(
      "No valid installment entries found",
      filename,
    );
  }

  return { sourceFile: filename, entries };
}
