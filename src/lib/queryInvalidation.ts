import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { QK } from "@/lib/queryKeys";

function invalidateMany(qc: QueryClient, keys: readonly QueryKey[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function invalidateDashboardState(qc: QueryClient, profileId: string) {
  return invalidateMany(qc, [
    QK.dashboardPrefix(profileId),
    QK.financialOverviewPrefix(profileId),
    QK.financialInsightsPrefix(profileId),
    QK.financialRecommendationsPrefix(profileId),
    QK.monthlySummaryPrefix(profileId),
    QK.recentTxPrefix(profileId),
    QK.annualReportPrefix(profileId),
    QK.yoyPrefix(profileId),
  ]);
}

export function invalidateCashState(qc: QueryClient, profileId: string) {
  return invalidateMany(qc, [
    QK.financialAccountsPrefix(profileId),
    QK.cashOverviewPrefix(profileId),
    QK.financialTransfersPrefix(profileId),
    QK.accountLedgerPrefix(profileId),
    QK.accountBalanceHistoryPrefix(profileId),
  ]);
}

export function invalidateIncomeState(qc: QueryClient, profileId: string) {
  return Promise.all([
    invalidateMany(qc, [
      QK.incomesPrefix(profileId),
      QK.incomeSources(profileId),
    ]),
    invalidateCashState(qc, profileId),
    invalidateDashboardState(qc, profileId),
  ]);
}

export function invalidateExpenseState(qc: QueryClient, profileId: string) {
  return Promise.all([
    invalidateMany(qc, [
      QK.expensesPrefix(profileId),
      QK.expenseBreakdownPrefix(profileId),
      QK.budgetsPrefix(profileId),
      QK.expenseCategories(profileId),
      QK.alertsPrefix(profileId),
    ]),
    invalidateCashState(qc, profileId),
    invalidateDashboardState(qc, profileId),
  ]);
}

export function invalidateInvestmentState(qc: QueryClient, profileId: string) {
  return Promise.all([
    invalidateMany(qc, [
      QK.investmentsPrefix(profileId),
      QK.portfolioSnapshotsPrefix(profileId),
    ]),
    invalidateCashState(qc, profileId),
    invalidateDashboardState(qc, profileId),
  ]);
}

export function invalidateAssetState(qc: QueryClient, profileId: string) {
  return Promise.all([
    invalidateMany(qc, [
      QK.assetsPrefix(profileId),
      QK.netWorthHistoryPrefix(profileId),
    ]),
    invalidateDashboardState(qc, profileId),
  ]);
}

export function invalidateRecurringState(qc: QueryClient, profileId: string) {
  return Promise.all([
    invalidateMany(qc, [
      QK.recurringPrefix(profileId),
      QK.installmentsPrefix(profileId),
      QK.installmentCfPrefix(profileId),
    ]),
    invalidateCashState(qc, profileId),
    invalidateDashboardState(qc, profileId),
  ]);
}
