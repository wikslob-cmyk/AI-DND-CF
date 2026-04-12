import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "PLN",
): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100)
    .toString()
    .padStart(2, "0");
  const formatted = intPart
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${formatted},${decPart} ${currency === "PLN" ? "zl" : currency}`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr));
}
