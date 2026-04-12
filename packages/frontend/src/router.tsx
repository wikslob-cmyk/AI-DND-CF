import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
} from "react-router";
import { DashboardLayout } from "@/layouts/dashboard-layout";

const LoginPage = lazy(() =>
  import("@/features/auth/login-page").then((m) => ({
    default: m.LoginPage,
  })),
);

const SummaryPage = lazy(() =>
  import("@/features/dashboard/summary-page").then((m) => ({
    default: m.SummaryPage,
  })),
);

const ReceivablesPage = lazy(() =>
  import("@/features/receivables/receivables-page").then((m) => ({
    default: m.ReceivablesPage,
  })),
);

const PayablesPage = lazy(() =>
  import("@/features/payables/payables-page").then((m) => ({
    default: m.PayablesPage,
  })),
);

const LiabilitiesPage = lazy(() =>
  import("@/features/liabilities/liabilities-page").then((m) => ({
    default: m.LiabilitiesPage,
  })),
);

const ForecastPage = lazy(() =>
  import("@/features/forecast/forecast-page").then((m) => ({
    default: m.ForecastPage,
  })),
);

const WarehousePage = lazy(() =>
  import("@/features/warehouse/warehouse-page").then((m) => ({
    default: m.WarehousePage,
  })),
);

const MonthlyInputPage = lazy(() =>
  import("@/features/monthly-input/monthly-input-page").then((m) => ({
    default: m.MonthlyInputPage,
  })),
);

const ImportPage = lazy(() =>
  import("@/features/import/import-page").then((m) => ({
    default: m.ImportPage,
  })),
);

const ViktorPage = lazy(() =>
  import("@/features/viktor/viktor-chat").then((m) => ({
    default: m.ViktorChat,
  })),
);

function Loading(): React.ReactNode {
  return (
    <p className="py-8 text-center text-gray-500">Ladowanie...</p>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<Loading />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/dashboard",
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Loading />}>
            <SummaryPage />
          </Suspense>
        ),
      },
      {
        path: "receivables",
        element: (
          <Suspense fallback={<Loading />}>
            <ReceivablesPage />
          </Suspense>
        ),
      },
      {
        path: "payables",
        element: (
          <Suspense fallback={<Loading />}>
            <PayablesPage />
          </Suspense>
        ),
      },
      {
        path: "liabilities",
        element: (
          <Suspense fallback={<Loading />}>
            <LiabilitiesPage />
          </Suspense>
        ),
      },
      {
        path: "forecast",
        element: (
          <Suspense fallback={<Loading />}>
            <ForecastPage />
          </Suspense>
        ),
      },
      {
        path: "warehouse",
        element: (
          <Suspense fallback={<Loading />}>
            <WarehousePage />
          </Suspense>
        ),
      },
      {
        path: "monthly-input",
        element: (
          <Suspense fallback={<Loading />}>
            <MonthlyInputPage />
          </Suspense>
        ),
      },
      {
        path: "import",
        element: (
          <Suspense fallback={<Loading />}>
            <ImportPage />
          </Suspense>
        ),
      },
      {
        path: "viktor",
        element: (
          <Suspense fallback={<Loading />}>
            <ViktorPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
