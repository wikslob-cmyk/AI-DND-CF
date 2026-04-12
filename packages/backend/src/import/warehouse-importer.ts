import { parseWarehouseFile } from "../parsers/warehouse-parser.js";
import type { ImportResult, FileInput, DbAdapter } from "./orchestrator.js";

export async function importWarehouseFile(
  file: FileInput,
  db: DbAdapter,
): Promise<ImportResult> {
  const warnings: string[] = [];

  try {
    const warehouse = parseWarehouseFile(file.buffer, file.filename);

    await db.beginTransaction();
    await db.deleteWarehouseItems();
    await db.insertWarehouseItems(warehouse.items);

    await db.insertImportLog("success", {
      files: [file.filename],
      warehouseItemCount: warehouse.items.length,
      totalValue: warehouse.totalValue,
      eurRate: warehouse.eurRate,
      warnings,
    });

    await db.commitTransaction();

    return {
      status: "success",
      importedAt: new Date(),
      details: {
        files: [file.filename],
        warehouseItemCount: warehouse.items.length,
        warnings,
        errors: [],
      },
    };
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch (rollbackErr) {
      const rollbackMsg =
        rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      warnings.push(`Rollback failed: ${rollbackMsg}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: [file.filename],
        warnings,
        errors: [message],
      },
    };
  }
}
