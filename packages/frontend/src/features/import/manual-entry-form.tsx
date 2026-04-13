import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

interface ManualEntryFormProps {
  liabilityId: number;
  liabilityName: string;
  existingEntry: {
    enteredAt: string;
    remainingAmount: number;
    monthlyCapital: number;
    monthlyInterest: number;
    installments: number;
  } | null;
  onSaved: () => void;
}

interface PreviewRow {
  nr: number;
  capital: number;
  interest: number;
  total: number;
  balance: number;
}

export function ManualEntryForm({
  liabilityId,
  liabilityName,
  existingEntry,
  onSaved,
}: ManualEntryFormProps) {
  const [remainingAmount, setRemainingAmount] = useState(
    existingEntry?.remainingAmount?.toString() ?? "",
  );
  const [installments, setInstallments] = useState(
    existingEntry?.installments?.toString() ?? "",
  );
  const [monthlyCapital, setMonthlyCapital] = useState(
    existingEntry?.monthlyCapital?.toString() ?? "",
  );
  const [monthlyInterest, setMonthlyInterest] = useState(
    existingEntry?.monthlyInterest?.toString() ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const preview = useMemo((): PreviewRow[] => {
    const amount = parseFloat(remainingAmount) || 0;
    const numInstallments = parseInt(installments) || 0;
    const capital = parseFloat(monthlyCapital) || 0;
    const interest = parseFloat(monthlyInterest) || 0;

    if (amount <= 0 || numInstallments <= 0) return [];

    const rows: PreviewRow[] = [];
    let balance = amount;

    for (let i = 1; i <= numInstallments; i++) {
      const isLast = i === numInstallments;
      // Last installment: balloon payment if remaining balance > monthly capital
      const capitalPayment = isLast ? balance : Math.min(capital, balance);
      const total = capitalPayment + interest;
      balance -= capitalPayment;

      rows.push({
        nr: i,
        capital: capitalPayment,
        interest,
        total,
        balance: Math.max(0, balance),
      });

      if (balance <= 0 && !isLast) {
        // Balance depleted before last installment
        break;
      }
    }

    return rows;
  }, [remainingAmount, installments, monthlyCapital, monthlyInterest]);

  const hasBalloon =
    preview.length > 0 &&
    preview[preview.length - 1]!.capital >
      (parseFloat(monthlyCapital) || 0) * 1.01;

  async function handleSubmit() {
    const amount = parseFloat(remainingAmount);
    const numInstallments = parseInt(installments) || 0;
    const capital = parseFloat(monthlyCapital) || 0;
    const interest = parseFloat(monthlyInterest) || 0;

    if (isNaN(amount) || amount <= 0 || numInstallments <= 0) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/liabilities/${liabilityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          manualEntry: {
            remainingAmount: amount,
            installments: numInstallments,
            monthlyCapital: capital,
            monthlyInterest: interest,
          },
        }),
      });

      if (response.ok) {
        setIsOpen(false);
        onSaved();
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (existingEntry && !isOpen) {
    const date = new Date(existingEntry.enteredAt);
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
          Wprowadzono recznie
        </span>
        <span className="text-xs text-gray-400">
          {date.toLocaleDateString("pl-PL")}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          edytuj
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-blue-600 hover:underline"
      >
        wprowadz recznie
      </button>
    );
  }

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-3">
      <p className="text-xs font-medium text-blue-800">
        {liabilityName} — wprowadzanie reczne
      </p>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Saldo na dzien importu
          </label>
          <input
            type="number"
            step="0.01"
            value={remainingAmount}
            onChange={(e) => setRemainingAmount(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Liczba rat
          </label>
          <input
            type="number"
            step="1"
            min="1"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            placeholder="np. 24"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Rata kapitałowa / mies.
          </label>
          <input
            type="number"
            step="0.01"
            value={monthlyCapital}
            onChange={(e) => setMonthlyCapital(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">
            Rata odsetkowa / mies.
          </label>
          <input
            type="number"
            step="0.01"
            value={monthlyInterest}
            onChange={(e) => setMonthlyInterest(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">
            Podglad harmonogramu ({preview.length} rat)
            {hasBalloon && (
              <span className="ml-2 text-amber-600">
                — ostatnia rata balonowa
              </span>
            )}
          </p>
          <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-gray-500">
                  <th className="px-2 py-1 text-left">Nr</th>
                  <th className="px-2 py-1 text-right">Kapital</th>
                  <th className="px-2 py-1 text-right">Odsetki</th>
                  <th className="px-2 py-1 text-right">Rata</th>
                  <th className="px-2 py-1 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.nr}
                    className={`border-t border-gray-100 ${
                      row.nr === preview.length && hasBalloon
                        ? "bg-amber-50 font-medium"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-0.5">{row.nr}</td>
                    <td className="px-2 py-0.5 text-right">
                      {formatCurrency(row.capital)}
                    </td>
                    <td className="px-2 py-0.5 text-right">
                      {formatCurrency(row.interest)}
                    </td>
                    <td className="px-2 py-0.5 text-right">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-2 py-0.5 text-right">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={
            isSaving ||
            !remainingAmount ||
            !installments ||
            preview.length === 0
          }
          onClick={handleSubmit}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Zapisywanie..." : "Zatwierdz harmonogram"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
