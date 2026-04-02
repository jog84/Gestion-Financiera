/**
 * queryKeys.ts — Fuente única de verdad para todas las queryKeys de TanStack Query.
 * Usar QK.* en useQuery y INVALIDATE.* en useMutation.onSuccess.
 */

export const QK = {
  dashboard: (profileId: string, year: number, month: number) => ["dashboard", profileId, year, month] as const,
  financialOverview: (profileId: string, year: number, month: number) => ["financial_overview", profileId, year, month] as const,
  financialInsights: (profileId: string, year: number, month: number) => ["financial_insights", profileId, year, month] as const,
  financialRecommendations: (profileId: string, year: number, month: number) => ["financial_recommendations", profileId, year, month] as const,
  expenseBreakdown: (profileId: string, year: number, month: number) => ["expense_breakdown", profileId, year, month] as const,
  recentTx: (profileId: string, limit: number) => ["recent_transactions", profileId, limit] as const,
  monthlySummary: (profileId: string, months: number) => ["monthly_summary", profileId, months] as const,
  incomes: (profileId: string, year: number, month: number) => ["incomes", profileId, year, month] as const,
  expenses: (profileId: string, year: number, month: number) => ["expenses", profileId, year, month] as const,
  budgets: (profileId: string, year: number, month: number) => ["budgets", profileId, year, month] as const,
  installments: (profileId: string) => ["installments", profileId] as const,
  installmentCf: (profileId: string) => ["installment_cashflow", profileId] as const,
  recurring: (profileId: string) => ["recurring", profileId] as const,
  expenseCategories: (profileId: string) => ["expense_categories", profileId] as const,
  incomeSources: (profileId: string) => ["income_sources", profileId] as const,
  investments: (profileId: string) => ["investments", profileId] as const,
  portfolioSnapshots: (profileId: string) => ["portfolio_snapshots", profileId] as const,
  financialAccounts: (profileId: string) => ["financial_accounts", profileId] as const,
  cashOverview: (profileId: string) => ["cash_overview", profileId] as const,
  financialTransfers: (profileId: string, limit: number) => ["financial_transfers", profileId, limit] as const,
  accountLedger: (profileId: string, accountId: string, limit: number) => ["account_ledger", profileId, accountId, limit] as const,
  accountBalanceHistory: (profileId: string, accountId: string, days: number) => ["account_balance_history", profileId, accountId, days] as const,
  assets: (profileId: string) => ["assets", profileId] as const,
  netWorthHistory: (profileId: string, days: number) => ["net_worth_history", profileId, days] as const,
  goals: (profileId: string) => ["goals", profileId] as const,
  milestones: (goalId: string) => ["milestones", goalId] as const,
  alerts: (profileId: string, unreadOnly: boolean) => ["alerts", profileId, unreadOnly] as const,
  annualReport: (profileId: string, year: number) => ["annual_report", profileId, year] as const,
  yoy: (profileId: string, yearA: number, yearB: number) => ["yoy", profileId, yearA, yearB] as const,
  themes: (profileId: string) => ["themes", profileId] as const,
  profile: (profileId: string) => ["profile", profileId] as const,
  profileSettings: () => ["profile_settings"] as const,
  dbLocation: () => ["db_location"] as const,
  defaultProfile: () => ["default-profile"] as const,
} as const;

export const INVALIDATE = {
  onIncomeChanged: (profileId: string, year: number, month: number) => [
    QK.incomes(profileId, year, month),
    QK.dashboard(profileId, year, month),
    QK.financialOverview(profileId, year, month),
    QK.financialAccounts(profileId),
    QK.cashOverview(profileId),
    QK.recentTx(profileId, 8),
    QK.annualReport(profileId, year),
  ] as const,
  onExpenseChanged: (profileId: string, year: number, month: number) => [
    QK.expenses(profileId, year, month),
    QK.expenseBreakdown(profileId, year, month),
    QK.dashboard(profileId, year, month),
    QK.financialOverview(profileId, year, month),
    QK.financialAccounts(profileId),
    QK.cashOverview(profileId),
    QK.budgets(profileId, year, month),
    QK.recentTx(profileId, 8),
    QK.annualReport(profileId, year),
  ] as const,
  onInvestmentChanged: (profileId: string) => [
    QK.investments(profileId),
    QK.portfolioSnapshots(profileId),
    QK.financialAccounts(profileId),
    QK.cashOverview(profileId),
    QK.financialOverview(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
  ] as const,
  onAssetChanged: (profileId: string) => [
    QK.assets(profileId),
    QK.netWorthHistory(profileId, 90),
    QK.financialOverview(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
  ] as const,
  onAccountChanged: (profileId: string) => [
    QK.financialAccounts(profileId),
    QK.cashOverview(profileId),
    QK.financialTransfers(profileId, 20),
    QK.financialOverview(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
  ] as const,
  onGoalChanged: (profileId: string) => [
    QK.goals(profileId),
  ] as const,
  onRecurringChanged: (profileId: string) => [
    QK.recurring(profileId),
    QK.financialOverview(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
  ] as const,
} as const;
