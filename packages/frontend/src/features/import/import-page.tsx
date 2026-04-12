import { useState, useCallback } from "react";
import { FileDropzone } from "./file-dropzone.js";
import { ImportStatus } from "./import-status.js";

type ImportType = "saldeo" | "warehouse" | "schedules";

interface ImportState {
  isLoading: boolean;
  lastResult: {
    importedAt: string;
    status: "success" | "failed";
    files: string[];
    warnings: string[];
    errors: string[];
  } | null;
}

const API_BASE = "/api/import";

async function uploadFiles(
  endpoint: string,
  files: File[],
): Promise<{
  status: "success" | "failed";
  importedAt: string;
  details: {
    files: string[];
    warnings: string[];
    errors: string[];
  };
}> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("file", file);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const json = await response.json();
  return json.data;
}

export function ImportPage() {
  const [saldeoFiles, setSaldeoFiles] = useState<File[]>([]);
  const [warehouseFile, setWarehouseFile] = useState<File[]>([]);
  const [scheduleFiles, setScheduleFiles] = useState<File[]>([]);
  const [importState, setImportState] = useState<
    Record<ImportType, ImportState>
  >({
    saldeo: { isLoading: false, lastResult: null },
    warehouse: { isLoading: false, lastResult: null },
    schedules: { isLoading: false, lastResult: null },
  });

  const handleImport = useCallback(
    async (type: ImportType, files: File[]) => {
      if (files.length === 0) return;

      setImportState((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true },
      }));

      try {
        const result = await uploadFiles(type, files);
        setImportState((prev) => ({
          ...prev,
          [type]: {
            isLoading: false,
            lastResult: {
              importedAt: result.importedAt,
              status: result.status,
              files: result.details.files,
              warnings: result.details.warnings,
              errors: result.details.errors,
            },
          },
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Nieznany błąd";
        setImportState((prev) => ({
          ...prev,
          [type]: {
            isLoading: false,
            lastResult: {
              importedAt: new Date().toISOString(),
              status: "failed",
              files: files.map((f) => f.name),
              warnings: [],
              errors: [message],
            },
          },
        }));
      }
    },
    [],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Import danych</h1>

      {/* Saldeo import */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Pliki Saldeo (faktury)
        </h2>
        <FileDropzone
          accept=".xlsx"
          multiple={true}
          maxFiles={5}
          onFilesSelected={setSaldeoFiles}
          label="Przeciągnij 5 plików lista-dokumentow-*.xlsx"
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={
              saldeoFiles.length === 0 || importState.saldeo.isLoading
            }
            onClick={() => handleImport("saldeo", saldeoFiles)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importState.saldeo.isLoading
              ? "Importowanie..."
              : "Importuj Saldeo"}
          </button>
          <span className="text-sm text-gray-500">
            {saldeoFiles.length > 0
              ? `${saldeoFiles.length} plik(ów) wybranych`
              : ""}
          </span>
        </div>
        {importState.saldeo.lastResult && (
          <ImportStatus
            status={{ lastImport: importState.saldeo.lastResult }}
          />
        )}
      </section>

      {/* Warehouse import */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Zestawienie magazynowe
        </h2>
        <FileDropzone
          accept=".xlsx"
          multiple={false}
          maxFiles={1}
          onFilesSelected={setWarehouseFile}
          label="Przeciągnij plik zestawienia magazynowego"
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={
              warehouseFile.length === 0 ||
              importState.warehouse.isLoading
            }
            onClick={() => handleImport("warehouse", warehouseFile)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importState.warehouse.isLoading
              ? "Importowanie..."
              : "Importuj magazyn"}
          </button>
        </div>
        {importState.warehouse.lastResult && (
          <ImportStatus
            status={{ lastImport: importState.warehouse.lastResult }}
          />
        )}
      </section>

      {/* Schedule import */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Harmonogramy zobowiązań
        </h2>
        <FileDropzone
          accept=".xlsx,.pdf"
          multiple={true}
          maxFiles={14}
          onFilesSelected={setScheduleFiles}
          label="Przeciągnij pliki harmonogramów (Excel + PDF)"
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={
              scheduleFiles.length === 0 ||
              importState.schedules.isLoading
            }
            onClick={() => handleImport("schedules", scheduleFiles)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importState.schedules.isLoading
              ? "Importowanie..."
              : "Importuj harmonogramy"}
          </button>
        </div>
        {importState.schedules.lastResult && (
          <ImportStatus
            status={{ lastImport: importState.schedules.lastResult }}
          />
        )}
      </section>
    </div>
  );
}
