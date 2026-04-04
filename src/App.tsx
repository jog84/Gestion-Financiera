import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Toaster } from "sonner";
import { ProfileProvider, useProfile } from "@/app/providers/ProfileProvider";

// ── Route-level code splitting ──────────────────────────────────────────────
const Dashboard   = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Incomes     = lazy(() => import("@/pages/Incomes").then(m => ({ default: m.Incomes })));
const Expenses    = lazy(() => import("@/pages/Expenses").then(m => ({ default: m.Expenses })));
const Installments = lazy(() => import("@/pages/Installments").then(m => ({ default: m.Installments })));
const Investments = lazy(() => import("@/pages/Investments").then(m => ({ default: m.Investments })));
const Accounts    = lazy(() => import("@/pages/Accounts").then(m => ({ default: m.Accounts })));
const Assets      = lazy(() => import("@/pages/Assets").then(m => ({ default: m.Assets })));
const Goals       = lazy(() => import("@/pages/Goals").then(m => ({ default: m.Goals })));
const Reports     = lazy(() => import("@/pages/Reports").then(m => ({ default: m.Reports })));
const Recurring   = lazy(() => import("@/pages/Recurring").then(m => ({ default: m.Recurring })));
const Settings    = lazy(() => import("@/pages/Settings").then(m => ({ default: m.Settings })));

// ── QueryClient ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false, // app de escritorio: el foco no implica datos desactualizados
    },
  },
});

// ── Fallback para Suspense ───────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)", fontSize: "13px" }}>
      Cargando...
    </div>
  );
}

function ProfileBootstrap({ children }: { children: ReactNode }) {
  const { isLoading, isReady, error } = useProfile();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px", color: "var(--danger)", fontSize: "13px", textAlign: "center" }}>
        {error ?? "No se pudo cargar el perfil por defecto."}
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <Toaster position="bottom-right" richColors theme="dark" />
        <ProfileBootstrap>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                <Route path="incomes" element={<Suspense fallback={<PageLoader />}><Incomes /></Suspense>} />
                <Route path="expenses" element={<Suspense fallback={<PageLoader />}><Expenses /></Suspense>} />
                <Route path="installments" element={<Suspense fallback={<PageLoader />}><Installments /></Suspense>} />
                <Route path="investments" element={<Suspense fallback={<PageLoader />}><Investments /></Suspense>} />
                <Route path="accounts" element={<Suspense fallback={<PageLoader />}><Accounts /></Suspense>} />
                <Route path="assets" element={<Suspense fallback={<PageLoader />}><Assets /></Suspense>} />
                <Route path="goals" element={<Suspense fallback={<PageLoader />}><Goals /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
                <Route path="recurring" element={<Suspense fallback={<PageLoader />}><Recurring /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ProfileBootstrap>
      </ProfileProvider>
    </QueryClientProvider>
  );
}
