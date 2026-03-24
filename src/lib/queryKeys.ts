/**
 * queryKeys.ts — Fuente única de verdad para todas las queryKeys de TanStack Query.
 * Usar QK.* en useQuery y INVALIDATE.* en useMutation.onSuccess.
 */

const P = "default"; // profile_id hardcodeado hasta implementar multi-perfil

export const QK = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard:        (year: number, month: number) => ["dashboard",            P, year, month] as const,
  expenseBreakdown: (year: number, month: number) => ["expense_breakdown",    P, year, month] as const,
  recentTx:         (limit: number)               => ["recent_transactions",  P, limit]        as const,

  // ── Summary (comparte prefijo → invalidación parcial funciona para 6 y 12)
  monthlySummary:   (months: number)              => ["monthly_summary",      P, months]       as const,

  // ── Cashflow ──────────────────────────────────────────────────────────────
  incomes:       (year: number, month: number) => ["incomes",        P, year, month] as const,
  expenses:      (year: number, month: number) => ["expenses",       P, year, month] as const,
  budgets:       (year: number, month: number) => ["budgets",        P, year, month] as const,
  installments:  ()                            => ["installments",   P]               as const,
  installmentCf: (months: number)             => ["installment_cf",  P, months]      as const,
  recurring:     ()                            => ["recurring",      P]               as const,

  // ── Catálogos ─────────────────────────────────────────────────────────────
  expenseCategories: () => ["expense_categories", P] as const,
  incomeSources:     () => ["income_sources",      P] as const,

  // ── Inversiones ───────────────────────────────────────────────────────────
  investments:        () => ["investments",         P] as const,
  portfolioSnapshots: () => ["portfolio_snapshots", P] as const,

  // ── Patrimonio ────────────────────────────────────────────────────────────
  assets:          ()             => ["assets",            P]         as const,
  netWorthHistory: (days: number) => ["net_worth_history", P, days]   as const,

  // ── Metas ─────────────────────────────────────────────────────────────────
  goals:      ()               => ["goals",      P]      as const,
  milestones: (goalId: string) => ["milestones", goalId] as const,

  // ── Alertas ───────────────────────────────────────────────────────────────
  alerts: (unreadOnly: boolean) => ["alerts", P, unreadOnly] as const,

  // ── Reportes ──────────────────────────────────────────────────────────────
  annualReport: (year: number)                 => ["annual_report", P, year]            as const,
  yoy:          (yearA: number, yearB: number) => ["yoy",           P, yearA, yearB]    as const,

  // ── Settings ──────────────────────────────────────────────────────────────
  themes:  () => ["themes",  P] as const,
  profile: () => ["profile", P] as const,
} as const;

// ── Árbol de invalidación por entidad mutada ──────────────────────────────────
// Devuelve un array de queryKeys a invalidar. Uso:
//   for (const key of INVALIDATE.onExpenseChanged(year, month))
//     qc.invalidateQueries({ queryKey: key });
//
// O más simple, usar el prefijo parcial donde alcanza:
//   qc.invalidateQueries({ queryKey: ["monthly_summary", "default"] }) → invalida 6 y 12 meses

export const INVALIDATE = {
  onIncomeChanged: (year: number, month: number) => [
    QK.incomes(year, month),
    QK.dashboard(year, month),
    QK.recentTx(8),
    QK.annualReport(year),
  ] as const,

  onExpenseChanged: (year: number, month: number) => [
    QK.expenses(year, month),
    QK.expenseBreakdown(year, month),
    QK.dashboard(year, month),
    QK.budgets(year, month),
    QK.recentTx(8),
    QK.annualReport(year),
  ] as const,

  onInvestmentChanged: () => [
    QK.investments(),
    QK.portfolioSnapshots(),
  ] as const,

  onAssetChanged: () => [
    QK.assets(),
    QK.netWorthHistory(90),
  ] as const,

  onGoalChanged: () => [
    QK.goals(),
  ] as const,

  onRecurringChanged: () => [
    QK.recurring(),
  ] as const,
} as const;
