import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ENTITY_CODES, ENTITY_NAMES, type EntityCode } from "@dnd/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ManualEntryData {
  id: number;
  entityCode: string;
  name: string;
  entryType: "receivable" | "payable";
  grossValue: number;
  currency: string;
  createdAt: string;
}

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"] as const;

export function ManualEntriesSection(): ReactNode {
  const queryClient = useQueryClient();

  const [entityCode, setEntityCode] = useState<EntityCode>(ENTITY_CODES[0]!);
  const [name, setName] = useState("");
  const [entryType, setEntryType] = useState<"receivable" | "payable">(
    "receivable",
  );
  const [grossValue, setGrossValue] = useState("");
  const [currency, setCurrency] = useState("PLN");

  const { data: entries } = useQuery({
    queryKey: ["manual-entries"],
    queryFn: () =>
      api.get<ManualEntryData[]>("/api/manual-entries?entity=all"),
  });

  const addMutation = useMutation({
    mutationFn: (payload: {
      entityCode: string;
      name: string;
      entryType: string;
      grossValue: number;
      currency: string;
    }) => api.post<ManualEntryData>("/api/manual-entries", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setName("");
      setGrossValue("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ deleted: boolean }>(`/api/manual-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const value = Number(grossValue);
    if (!name.trim() || !value || value <= 0) return;

    addMutation.mutate({
      entityCode,
      name: name.trim(),
      entryType,
      grossValue: value,
      currency,
    });
  }

  const receivables = (entries ?? []).filter(
    (e) => e.entryType === "receivable",
  );
  const payables = (entries ?? []).filter((e) => e.entryType === "payable");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pozycje reczne (spoza Saldeo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <Label htmlFor="me-entity">Podmiot</Label>
              <Select
                id="me-entity"
                value={entityCode}
                onChange={(e) =>
                  setEntityCode(e.target.value as EntityCode)
                }
              >
                {ENTITY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {ENTITY_NAMES[code]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="me-type">Typ</Label>
              <Select
                id="me-type"
                value={entryType}
                onChange={(e) =>
                  setEntryType(
                    e.target.value as "receivable" | "payable",
                  )
                }
              >
                <option value="receivable">Naleznosc</option>
                <option value="payable">Zobowiazanie</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="me-name">Nazwa pozycji</Label>
              <Input
                id="me-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Projekt X"
              />
            </div>
            <div>
              <Label htmlFor="me-value">Wartosc brutto</Label>
              <Input
                id="me-value"
                type="number"
                step="0.01"
                min="0.01"
                value={grossValue}
                onChange={(e) => setGrossValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="me-currency">Waluta</Label>
              <Select
                id="me-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={addMutation.isPending || !name.trim() || !grossValue}
          >
            {addMutation.isPending ? "Dodawanie..." : "Dodaj pozycje"}
          </Button>
          {addMutation.isError && (
            <span className="ml-2 text-sm text-red-600">Blad dodawania</span>
          )}
        </form>

        {/* List */}
        {receivables.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
              Naleznosci
            </h4>
            <div className="space-y-1">
              {receivables.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => deleteMutation.mutate(entry.id)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {payables.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-2">
              Zobowiazania
            </h4>
            <div className="space-y-1">
              {payables.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => deleteMutation.mutate(entry.id)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {!entries?.length && (
          <p className="text-sm text-gray-500">Brak pozycji recznych</p>
        )}
      </CardContent>
    </Card>
  );
}

function EntryRow({
  entry,
  onDelete,
  isDeleting,
}: {
  entry: ManualEntryData;
  onDelete: () => void;
  isDeleting: boolean;
}): ReactNode {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-400">
          {ENTITY_NAMES[entry.entityCode as EntityCode] ?? entry.entityCode}
        </span>
        <span className="text-sm text-gray-700 truncate">{entry.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold whitespace-nowrap">
          {formatCurrency(entry.grossValue, entry.currency)}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          Usun
        </button>
      </div>
    </div>
  );
}
