import { type ReactNode } from "react";
import { MonthlyInputForm } from "./monthly-input-form";

export function MonthlyInputPage(): ReactNode {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Dane reczne (R4)
        </h2>
        <p className="text-sm text-gray-500">
          VAT, wynagrodzenia i salda bankowe per podmiot per miesiac
        </p>
      </div>
      <MonthlyInputForm />
    </div>
  );
}
