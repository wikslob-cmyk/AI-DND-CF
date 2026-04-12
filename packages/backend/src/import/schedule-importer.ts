import { parseScheduleExcel } from "../parsers/schedule-parser-excel.js";
import { parseSchedulePdf } from "../parsers/schedule-parser-pdf.js";
import {
  SCAN_PDF_FILES,
  SCHEDULE_FILE_MAP,
} from "../parsers/schedule-types.js";
import type { ParsedSchedule } from "../parsers/schedule-types.js";
import type { ImportResult, FileInput, DbAdapter } from "./orchestrator.js";

export async function importScheduleFiles(
  files: FileInput[],
  db: DbAdapter,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const filenames = files.map((f) => f.filename);
  let scheduleCount = 0;

  // Phase 1: Parse all files
  const schedules: Array<{
    schedule: ParsedSchedule;
    mapping: { entityCode: string; liabilityName: string };
  }> = [];

  for (const file of files) {
    // Skip known scan PDFs
    if (SCAN_PDF_FILES.includes(file.filename)) {
      warnings.push(
        `${file.filename}: Skan PDF, wymaga ręcznego wpisu`,
      );
      continue;
    }

    const mapping = SCHEDULE_FILE_MAP[file.filename];
    if (!mapping) {
      warnings.push(
        `${file.filename}: Brak mapowania pliku — pominięto`,
      );
      continue;
    }

    try {
      let schedule: ParsedSchedule;
      if (file.filename.endsWith(".pdf")) {
        schedule = await parseSchedulePdf(file.buffer, file.filename);
      } else {
        schedule = parseScheduleExcel(file.buffer, file.filename);
      }
      schedules.push({ schedule, mapping });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push(`${file.filename}: ${message}`);
    }
  }

  if (errors.length > 0) {
    await db.insertImportLog("failed", {
      files: filenames,
      errors,
      warnings,
    });
    return {
      status: "failed",
      importedAt: new Date(),
      details: { files: filenames, warnings, errors },
    };
  }

  // Phase 2: Transactional write
  try {
    await db.beginTransaction();

    for (const { schedule, mapping } of schedules) {
      const liabilityId = await db.findLiabilityId(
        mapping.entityCode,
        mapping.liabilityName,
      );

      if (!liabilityId) {
        warnings.push(
          `${schedule.sourceFile}: Nie znaleziono zobowiązania "${mapping.liabilityName}" dla ${mapping.entityCode} — pominięto`,
        );
        continue;
      }

      await db.deleteScheduleEntries(liabilityId);
      await db.insertScheduleEntries(liabilityId, schedule.entries);
      scheduleCount += schedule.entries.length;
    }

    await db.insertImportLog("success", {
      files: filenames,
      scheduleCount,
      warnings,
    });

    await db.commitTransaction();

    return {
      status: "success",
      importedAt: new Date(),
      details: {
        files: filenames,
        scheduleCount,
        warnings,
        errors: [],
      },
    };
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch (rollbackErr) {
      const rollbackMsg =
        rollbackErr instanceof Error
          ? rollbackErr.message
          : String(rollbackErr);
      warnings.push(`Rollback failed: ${rollbackMsg}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: filenames,
        warnings,
        errors: [message],
      },
    };
  }
}
