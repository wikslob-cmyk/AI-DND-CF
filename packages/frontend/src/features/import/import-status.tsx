interface ImportStatusProps {
  status: {
    lastImport: {
      importedAt: string;
      status: "success" | "failed";
      files: string[];
      warnings: string[];
      errors: string[];
    } | null;
  };
}

export function ImportStatus({ status }: ImportStatusProps) {
  if (!status.lastImport) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">
          Brak danych o ostatnim imporcie
        </p>
      </div>
    );
  }

  const { lastImport } = status;
  const isSuccess = lastImport.status === "success";
  const date = new Date(lastImport.importedAt);

  return (
    <div
      className={`rounded-lg border p-4 ${
        isSuccess
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isSuccess ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-sm font-medium">
          {isSuccess ? "Import zakończony" : "Import nieudany"}
        </span>
        <span className="text-xs text-gray-500">
          {date.toLocaleDateString("pl-PL")} {date.toLocaleTimeString("pl-PL")}
        </span>
      </div>

      {lastImport.files.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">Pliki:</p>
          <ul className="text-xs text-gray-700 space-y-0.5">
            {lastImport.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      )}

      {lastImport.warnings.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-amber-600 font-medium mb-1">
            Ostrzeżenia:
          </p>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {lastImport.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {lastImport.errors.length > 0 && (
        <div>
          <p className="text-xs text-red-600 font-medium mb-1">Błędy:</p>
          <ul className="text-xs text-red-700 space-y-0.5">
            {lastImport.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
