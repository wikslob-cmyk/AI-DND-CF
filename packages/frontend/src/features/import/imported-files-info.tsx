interface ImportedFilesInfoProps {
  importedAt: string | null;
  files: string[];
}

export function ImportedFilesInfo({
  importedAt,
  files,
}: ImportedFilesInfoProps) {
  if (!importedAt || files.length === 0) {
    return (
      <p className="text-xs text-gray-400">Brak zaimportowanych danych</p>
    );
  }

  const date = new Date(importedAt);

  return (
    <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span className="text-xs font-medium text-green-800">
          Zaimportowano{" "}
          {date.toLocaleDateString("pl-PL")}{" "}
          {date.toLocaleTimeString("pl-PL")}
        </span>
      </div>
      <ul className="text-xs text-green-700 space-y-0.5 pl-4">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
