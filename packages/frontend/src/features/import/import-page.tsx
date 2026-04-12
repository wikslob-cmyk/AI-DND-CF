import React, { useState, useCallback, useEffect } from "react";
import {
  ENTITY_NAMES,
  LIABILITY_TYPES,
  LIABILITY_TYPE_LABELS,
} from "@dnd/shared";
import type { EntityCode, LiabilityType } from "@dnd/shared";
import { FileDropzone } from "./file-dropzone.js";
import { ImportStatus } from "./import-status.js";
import { ImportedFilesInfo } from "./imported-files-info.js";
import { ManualEntryForm } from "./manual-entry-form.js";
import { ScheduleMapper } from "./schedule-mapper.js";

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

interface Liability {
  id: number;
  entityCode: string;
  name: string;
  type: string;
  status: string;
  sourceFile: string | null;
  scheduleCount: number;
  config: {
    manualEntry?: {
      enteredAt: string;
      remainingAmount: number;
      installments: number;
      monthlyCapital: number;
      monthlyInterest: number;
    };
  };
}

interface ImportStatusData {
  saldeo: { importedAt: string; files: string[] } | null;
  warehouse: { importedAt: string; files: string[] } | null;
  schedules: { importedAt: string; files: string[] } | null;
}

const API_BASE = "/api/import";

async function uploadFiles(
  endpoint: string,
  files: File[],
  extraFields?: Record<string, string>,
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
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      formData.append(key, value);
    }
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json.error?.message ?? `Import failed (${response.status})`,
    );
  }

  return json.data;
}

export function ImportPage() {
  const [saldeoFiles, setSaldeoFiles] = useState<File[]>([]);
  const [warehouseFile, setWarehouseFile] = useState<File[]>([]);
  const [scheduleFiles, setScheduleFiles] = useState<File[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [importStatusData, setImportStatusData] =
    useState<ImportStatusData | null>(null);
  const [importState, setImportState] = useState<
    Record<ImportType, ImportState>
  >({
    saldeo: { isLoading: false, lastResult: null },
    warehouse: { isLoading: false, lastResult: null },
    schedules: { isLoading: false, lastResult: null },
  });

  const fetchData = useCallback(async () => {
    const [liabRes, statusRes] = await Promise.all([
      fetch("/api/liabilities?entity=all", { credentials: "include" }),
      fetch("/api/import/status", { credentials: "include" }),
    ]);
    const liabJson = await liabRes.json();
    const statusJson = await statusRes.json();
    setLiabilities(liabJson.data?.liabilities ?? []);
    setImportStatusData(statusJson.data ?? null);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = useCallback(
    async (
      type: ImportType,
      files: File[],
      extraFields?: Record<string, string>,
    ) => {
      if (files.length === 0) return;

      setImportState((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true },
      }));

      try {
        const result = await uploadFiles(type, files, extraFields);
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
        fetchData();
      } catch (err) {
        console.error("Import error:", err);
        const message =
          err instanceof Error ? err.message : "Nieznany blad";
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
    [fetchData],
  );

  const handleScheduleImport = useCallback(
    (
      mapping: Record<
        string,
        {
          mode: string;
          liabilityId?: number;
          newLiability?: {
            entityCode: string;
            name: string;
            type: string;
          };
        }
      >,
      files: File[],
    ) => {
      const backendMapping: Record<
        string,
        | { liabilityId: number }
        | {
            newLiability: {
              entityCode: string;
              name: string;
              type: string;
            };
          }
      > = {};

      for (const [filename, m] of Object.entries(mapping)) {
        if (m.mode === "skip") continue;
        if (m.mode === "existing" && m.liabilityId) {
          backendMapping[filename] = { liabilityId: m.liabilityId };
        } else if (m.mode === "new" && m.newLiability) {
          backendMapping[filename] = { newLiability: m.newLiability };
        }
      }

      handleImport("schedules", files, {
        mapping: JSON.stringify(backendMapping),
      });
    },
    [handleImport],
  );

  const handleTypeChange = useCallback(
    async (liabilityId: number, newType: string) => {
      try {
        await fetch(`/api/liabilities/${liabilityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: newType }),
        });
        setLiabilities((prev) =>
          prev.map((l) =>
            l.id === liabilityId ? { ...l, type: newType } : l,
          ),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const activeLiabilities = liabilities.filter(
    (l) => l.status === "active" || l.status === "pending_write_off",
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Import danych</h1>

      {/* Saldeo import */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Pliki Saldeo (faktury)
        </h2>
        <ImportedFilesInfo
          importedAt={importStatusData?.saldeo?.importedAt ?? null}
          files={importStatusData?.saldeo?.files ?? []}
        />
        <FileDropzone
          accept=".xlsx"
          multiple={true}
          maxFiles={5}
          onFilesSelected={setSaldeoFiles}
          label="Przeciagnij 5 plików lista-dokumentow-*.xlsx"
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
        <ImportedFilesInfo
          importedAt={importStatusData?.warehouse?.importedAt ?? null}
          files={importStatusData?.warehouse?.files ?? []}
        />
        <FileDropzone
          accept=".xlsx"
          multiple={false}
          maxFiles={1}
          onFilesSelected={setWarehouseFile}
          label="Przeciagnij plik zestawienia magazynowego"
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
          Harmonogramy zobowiazań
        </h2>

        {/* Liabilities table */}
        {activeLiabilities.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 pr-4">Spółka</th>
                  <th className="py-2 pr-4">Zobowiazanie</th>
                  <th className="py-2 pr-4">Typ</th>
                  <th className="py-2 pr-4">Plik</th>
                  <th className="py-2 pr-4 text-right">Harmonogram</th>
                </tr>
              </thead>
              <tbody>
                {activeLiabilities.map((l) => {
                  const hasSchedule = l.scheduleCount > 0;
                  return (
                    <React.Fragment key={l.id}>
                    <tr
                      className={`border-t ${
                        hasSchedule
                          ? "border-green-100 bg-green-50"
                          : "border-gray-100"
                      }`}
                    >
                      <td className="px-4 py-1.5 pr-4 text-gray-600">
                        {ENTITY_NAMES[l.entityCode as EntityCode] ??
                          l.entityCode}
                      </td>
                      <td
                        className={`py-1.5 pr-4 font-medium ${
                          hasSchedule
                            ? "text-green-800"
                            : "text-gray-900"
                        }`}
                      >
                        {l.name}
                      </td>
                      <td className="py-1.5 pr-4">
                        <select
                          value={l.type}
                          onChange={(e) =>
                            handleTypeChange(l.id, e.target.value)
                          }
                          className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-600 hover:border-gray-400"
                        >
                          {LIABILITY_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {LIABILITY_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-4 text-gray-400 truncate max-w-[200px]">
                        {l.sourceFile ?? "—"}
                      </td>
                      <td className="py-1.5 pr-4">
                        {hasSchedule ? (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                              {l.scheduleCount} rat
                            </span>
                            {l.config?.manualEntry && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                recznie
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">brak</span>
                        )}
                      </td>
                    </tr>
                    {/* Manual entry row — only for liabilities without source file */}
                    {!l.sourceFile && l.type !== "info" && (
                      <tr key={`${l.id}-manual`} className="border-t border-gray-50">
                        <td colSpan={5} className="px-4 py-2">
                          <ManualEntryForm
                            liabilityId={l.id}
                            liabilityName={l.name}
                            existingEntry={l.config?.manualEntry ?? null}
                            onSaved={fetchData}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <FileDropzone
          accept=".xlsx,.pdf"
          multiple={true}
          maxFiles={14}
          onFilesSelected={setScheduleFiles}
          label="Przeciagnij pliki harmonogramów (Excel + PDF)"
        />
        {scheduleFiles.length > 0 && (
          <ScheduleMapper
            files={scheduleFiles}
            onMappingComplete={handleScheduleImport}
            isLoading={importState.schedules.isLoading}
          />
        )}
        {importState.schedules.lastResult && (
          <ImportStatus
            status={{ lastImport: importState.schedules.lastResult }}
          />
        )}
      </section>
    </div>
  );
}
