import { Outlet, NavLink, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Podsumowanie" },
  { to: "/dashboard/receivables", label: "Naleznosci" },
  { to: "/dashboard/payables", label: "Zobowiazania handlowe" },
  { to: "/dashboard/liabilities", label: "Zobowiazania finansowe" },
  { to: "/dashboard/forecast", label: "Prognoza" },
  { to: "/dashboard/warehouse", label: "Magazyn" },
  { to: "/dashboard/monthly-input", label: "Dane R4" },
  { to: "/dashboard/import", label: "Import" },
];

export function DashboardLayout(): React.ReactNode {
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // Ignore logout errors
    });
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-gray-900">
            Dashboard Finansowy
          </h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Wyloguj
          </Button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4">
          <div className="flex gap-1 py-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
