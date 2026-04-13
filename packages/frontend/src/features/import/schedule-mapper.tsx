import { useState, useEffect } from "react";
import {
  ENTITY_CODES,
  ENTITY_NAMES,
  LIABILITY_TYPES,
  LIABILITY_TYPE_LABELS,
} from "@dnd/shared";
import type { EntityCode, LiabilityType } from "@dnd/shared";

interface Liability {
  id: number;
  entityCode: string;
  name: string;
  type: string;
  status: string;
  sourceFile: string | null;
  scheduleCount: number;
}

interface FileMapping {
  mode: "existing" | "new" | "skip";
  liabilityId?: number;
  newLiability?: {
    entityCode: EntityCode;
    name: string;
    type: LiabilityType;
  };
}

interface ScheduleMapperProps {
  files: File[];
  onMappingComplete: (
    mapping: Record<string, FileMapping>,
    files: File[],
  ) => void;
  isLoading: boolean;
}

export function ScheduleMapper({
  files,
  onMappingComplete,
  isLoading,
}: ScheduleMapperProps) {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [mapping, setMapping] = useState<Record<string, FileMapping>>({});
  const [isLoadingLiabilities, setIsLoadingLiabilities] = useState(true);

  useEffect(() => {
    async function fetchLiabilities() {
      try {
        const response = await fetch("/api/liabilities?entity=all", {
          credentials: "include",
        });
        const json = await response.json();
        setLiabilities(json.data?.liabilities ?? []);
      } catch {
        setLiabilities([]);
      } finally {
        setIsLoadingLiabilities(false);
      }
    }
    fetchLiabilities();
  }, []);

  useEffect(() => {
    const initial: Record<string, FileMapping> = {};
    for (const file of files) {
      if (!mapping[file.name]) {
        initial[file.name] = { mode: "existing" };
      }
    }
    if (Object.keys(initial).length > 0) {
      setMapping((prev) => ({ ...prev, ...initial }));
    }
  }, [files]);

  function updateMapping(filename: string, update: Partial<FileMapping>) {
    setMapping((prev) => ({
      ...prev,
      [filename]: { ...(prev[filename] ?? { mode: "skip" as const }), ...update },
    }));
  }

  const activeLiabilities = liabilities.filter(
    (l) => l.status === "active" || l.status === "pending_write_off",
  );

  const isAllMapped = files.every((f) => {
    const m = mapping[f.name];
    if (!m) return false;
    if (m.mode === "skip") return true;
    if (m.mode === "existing") return m.liabilityId !== undefined;
    if (m.mode === "new") {
      return (
        m.newLiability?.entityCode &&
        m.newLiability?.name &&
        m.newLiability?.type
      );
    }
    return false;
  });

  function handleSubmit() {
    const filesToImport = files.filter(
      (f) => mapping[f.name]?.mode !== "skip",
    );
    onMappingComplete(mapping, filesToImport);
  }

  if (isLoadingLiabilities) {
    return (
      <p className="text-sm text-gray-500">Wczytywanie zobowiazań...</p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">
        Przypisz pliki do zobowiazań
      </h3>
      {files.map((file) => {
        const m = mapping[file.name] ?? { mode: "existing" };

        return (
          <div
            key={file.name}
            className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{file.name}</span>
              <select
                value={m.mode}
                onChange={(e) =>
                  updateMapping(file.name, {
                    mode: e.target.value as FileMapping["mode"],
                    liabilityId: undefined,
                    newLiability: undefined,
                  })
                }
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="existing">Przypisz do istniejacego</option>
                <option value="new">Nowe zobowiazanie</option>
                <option value="skip">Pomin</option>
              </select>
            </div>

            {m.mode === "existing" && (
              <select
                value={m.liabilityId ?? ""}
                onChange={(e) =>
                  updateMapping(file.name, {
                    liabilityId: Number(e.target.value),
                  })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— wybierz zobowiazanie —</option>
                {activeLiabilities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {ENTITY_NAMES[l.entityCode as EntityCode] ??
                      l.entityCode}{" "}
                    — {l.name} ({LIABILITY_TYPE_LABELS[l.type as LiabilityType] ?? l.type})
                    {l.scheduleCount > 0
                      ? ` [${l.scheduleCount} rat]`
                      : ""}
                  </option>
                ))}
              </select>
            )}

            {m.mode === "new" && (
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={m.newLiability?.entityCode ?? ""}
                  onChange={(e) =>
                    updateMapping(file.name, {
                      newLiability: {
                        entityCode: e.target.value as EntityCode,
                        name: m.newLiability?.name ?? "",
                        type: m.newLiability?.type ?? "leasing_financial",
                      },
                    })
                  }
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Spółka</option>
                  {ENTITY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {ENTITY_NAMES[code]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Nazwa zobowiazania"
                  value={m.newLiability?.name ?? ""}
                  onChange={(e) =>
                    updateMapping(file.name, {
                      newLiability: {
                        entityCode:
                          m.newLiability?.entityCode ??
                          ("cgesp" as EntityCode),
                        name: e.target.value,
                        type: m.newLiability?.type ?? "leasing_financial",
                      },
                    })
                  }
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                />
                <select
                  value={m.newLiability?.type ?? "leasing"}
                  onChange={(e) =>
                    updateMapping(file.name, {
                      newLiability: {
                        entityCode:
                          m.newLiability?.entityCode ??
                          ("cgesp" as EntityCode),
                        name: m.newLiability?.name ?? "",
                        type: e.target.value as LiabilityType,
                      },
                    })
                  }
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                >
                  {LIABILITY_TYPES.filter((t) => t !== "info").map(
                    (type) => (
                      <option key={type} value={type}>
                        {LIABILITY_TYPE_LABELS[type]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            {m.mode === "skip" && (
              <p className="text-xs text-gray-400">
                Plik zostanie pominiety
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={!isAllMapped || isLoading}
        onClick={handleSubmit}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Importowanie..." : "Importuj harmonogramy"}
      </button>
    </div>
  );
}
