import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCcl,
  getCashOverview,
  getDashboardSummary,
  getFinancialAccounts,
  getInvestments,
  getPortfolioSnapshots,
} from "@/lib/api";
import { QK } from "@/lib/queryKeys";

function getStoredCcl() {
  const stored = parseFloat(localStorage.getItem("last_ccl") ?? "");
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

export function useInvestmentsDashboard(profileId: string) {
  const [currentCcl, setCurrentCcl] = useState<number | null>(getStoredCcl);
  const [cclStale, setCclStale] = useState(currentCcl != null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { data: investments = [], isLoading } = useQuery({
    queryKey: QK.investments(profileId),
    queryFn: () => getInvestments(profileId),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: QK.financialAccounts(profileId),
    queryFn: () => getFinancialAccounts(profileId),
  });

  const { data: cashOverview } = useQuery({
    queryKey: QK.cashOverview(profileId),
    queryFn: () => getCashOverview(profileId),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: QK.portfolioSnapshots(profileId),
    queryFn: () => getPortfolioSnapshots(profileId),
  });

  const { data: dashSummary } = useQuery({
    queryKey: QK.dashboard(profileId, currentYear, currentMonth),
    queryFn: () => getDashboardSummary(profileId, currentYear, currentMonth),
    staleTime: 60_000,
  });

  useEffect(() => {
    let active = true;

    fetchCcl()
      .then((ccl) => {
        if (!active) return;
        setCurrentCcl(ccl);
        setCclStale(false);
        localStorage.setItem("last_ccl", String(ccl));
      })
      .catch(() => {
        if (!active) return;
        setCclStale(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    accounts,
    cashOverview,
    currentCcl,
    cclStale,
    dashSummary,
    investments,
    isLoading,
    setCurrentCcl,
    setCclStale,
    snapshots,
  };
}
