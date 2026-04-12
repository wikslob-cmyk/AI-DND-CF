import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ENTITY_CODES, ENTITY_NAMES, type EntityCode } from "@dnd/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MonthlyInputData {
  id: number;
  entityCode: string;
  year: number;
  month: number;
  vatRefund: number;
  salariesNet: number;
  bankBalance: number;
  updatedAt: string;
}

const MONTHS = [
  { value: 1, label: "Styczen" },
  { value: 2, label: "Luty" },
  { value: 3, label: "Marzec" },
  { value: 4, label: "Kwiecien" },
  { value: 5, label: "Maj" },
  { value: 6, label: "Czerwiec" },
  { value: 7, label: "Lipiec" },
  { value: 8, label: "Sierpien" },
  { value: 9, label: "Wrzesien" },
  { value: 10, label: "Pazdziernik" },
  { value: 11, label: "Listopad" },
  { value: 12, label: "Grudzien" },
];

interface EntityFormProps {
  entityCode: EntityCode;
  year: number;
  month: number;
}

function EntityForm({
  entityCode,
  year,
  month,
}: EntityFormProps): ReactNode {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["monthly-input", entityCode, year, month],
    queryFn: () =>
      api.get<MonthlyInputData | null>(
        `/api/monthly-input?entity=${entityCode}&year=${year}&month=${month}`,
      ),
  });

  const [vatRefund, setVatRefund] = useState("");
  const [salariesNet, setSalariesNet] = useState("");
  const [bankBalance, setBankBalance] = useState("");

  useEffect(() => {
    if (data) {
      setVatRefund(String(data.vatRefund));
      setSalariesNet(String(data.salariesNet));
      setBankBalance(String(data.bankBalance));
    } else {
      setVatRefund("0");
      setSalariesNet("0");
      setBankBalance("0");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: {
      entityCode: string;
      year: number;
      month: number;
      vatRefund: number;
      salariesNet: number;
      bankBalance: number;
    }) => api.put<MonthlyInputData>("/api/monthly-input", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monthly-input", entityCode, year, month],
      });
    },
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    mutation.mutate({
      entityCode,
      year,
      month,
      vatRefund: Number(vatRefund) || 0,
      salariesNet: Number(salariesNet) || 0,
      bankBalance: Number(bankBalance) || 0,
    });
  }

  const entityName = ENTITY_NAMES[entityCode];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{entityName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor={`vat-${entityCode}`}>
                Zwrot VAT (PLN)
              </Label>
              <Input
                id={`vat-${entityCode}`}
                type="number"
                step="0.01"
                value={vatRefund}
                onChange={(e) => setVatRefund(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`salaries-${entityCode}`}>
                Wynagrodzenia netto (PLN)
              </Label>
              <Input
                id={`salaries-${entityCode}`}
                type="number"
                step="0.01"
                value={salariesNet}
                onChange={(e) => setSalariesNet(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`balance-${entityCode}`}>
                Saldo bankowe (PLN)
              </Label>
              <Input
                id={`balance-${entityCode}`}
                type="number"
                step="0.01"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
          {mutation.isSuccess && (
            <span className="ml-2 text-sm text-green-600">Zapisano</span>
          )}
          {mutation.isError && (
            <span className="ml-2 text-sm text-red-600">
              Blad zapisu
            </span>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function MonthlyInputForm(): ReactNode {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div>
          <Label htmlFor="year">Rok</Label>
          <Select
            id="year"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="month">Miesiac</Label>
          <Select
            id="month"
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-36"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {ENTITY_CODES.map((code) => (
          <EntityForm
            key={`${code}-${year}-${month}`}
            entityCode={code}
            year={year}
            month={month}
          />
        ))}
      </div>
    </div>
  );
}
