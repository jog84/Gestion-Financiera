import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Incomes } from "@/pages/Incomes";
import { Expenses } from "@/pages/Expenses";
import { Installments } from "@/pages/Installments";
import { Investments } from "@/pages/Investments";
import { Assets } from "@/pages/Assets";
import { Goals } from "@/pages/Goals";
import { Reports } from "@/pages/Reports";
import { Settings } from "@/pages/Settings";
import { Recurring } from "@/pages/Recurring";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="bottom-right" richColors theme="dark" />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="incomes" element={<Incomes />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="installments" element={<Installments />} />
            <Route path="investments" element={<Investments />} />
            <Route path="assets" element={<Assets />} />
            <Route path="goals" element={<Goals />} />
            <Route path="reports" element={<Reports />} />
            <Route path="recurring" element={<Recurring />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
