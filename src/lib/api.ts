import { invoke } from "@tauri-apps/api/core";
import type {
  UserProfile, IncomeEntry, ExpenseEntry, DashboardSummary,
  IncomeSource, ExpenseCategory, InstallmentEntry, InvestmentEntry,
  AssetSnapshot, FinancialAccount, CashOverview, GoalEntry, PortfolioSnapshot,
  RecurringTransaction, AppliedRecurring, CategoryBudget,
  Alert, NetWorthPoint, GoalMilestone, CustomTheme, FinancialOverview,
  YoyComparison, InstallmentCashflowPoint, FinancialTransfer,
  AccountLedgerEntry, AccountBalancePoint,
  FinancialInsight, FinancialRecommendation,
} from "@/types";

// ── Profiles ──────────────────────────────────────────────────────────────────

export const getProfiles = () => invoke<UserProfile[]>("get_profiles");
export const createProfile = (name: string, currency_code: string) =>
  invoke<UserProfile>("create_profile", { name, currencyCode: currency_code });

// ── Incomes ───────────────────────────────────────────────────────────────────

export const getIncomes = (profileId: string, year: number, month: number) =>
  invoke<IncomeEntry[]>("get_incomes", { profileId, year, month });

export const createIncome = (payload: {
  profile_id: string;
  account_id?: string;
  source_id?: string;
  amount: number;
  transaction_date: string;
  description?: string;
  notes?: string;
}) => invoke<IncomeEntry>("create_income", { payload });

export const updateIncome = (id: string, payload: {
  account_id?: string | null;
  source_id?: string | null;
  amount: number;
  transaction_date: string;
  description?: string | null;
  notes?: string | null;
}) => invoke<IncomeEntry>("update_income", { id, payload });

export const deleteIncome = (id: string) => invoke<void>("delete_income", { id });

// ── Expenses ──────────────────────────────────────────────────────────────────

export const getExpenses = (profileId: string, year: number, month: number) =>
  invoke<ExpenseEntry[]>("get_expenses", { profileId, year, month });

export const createExpense = (payload: {
  profile_id: string;
  account_id?: string;
  category_id?: string;
  amount: number;
  transaction_date: string;
  description?: string;
  vendor?: string;
  payment_method?: string;
  notes?: string;
}) => invoke<ExpenseEntry>("create_expense", { payload });

export const updateExpense = (id: string, payload: {
  account_id?: string | null;
  category_id?: string | null;
  amount: number;
  transaction_date: string;
  description?: string | null;
  vendor?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}) => invoke<ExpenseEntry>("update_expense", { id, payload });

export const deleteExpense = (id: string) => invoke<void>("delete_expense", { id });

// ── Dashboard & Charts ────────────────────────────────────────────────────────

export const getDashboardSummary = (profileId: string, year: number, month: number) =>
  invoke<DashboardSummary>("get_dashboard_summary", { profileId, year, month });

export const getFinancialOverview = (profileId: string, year: number, month: number) =>
  invoke<FinancialOverview>("get_financial_overview", { profileId, year, month });

export const getFinancialInsights = (profileId: string, year: number, month: number) =>
  invoke<FinancialInsight[]>("get_financial_insights", { profileId, year, month });

export const checkFinancialAlerts = (profileId: string, year: number, month: number) =>
  invoke<FinancialInsight[]>("check_financial_alerts", { profileId, year, month });

export const getFinancialRecommendations = (profileId: string, year: number, month: number) =>
  invoke<FinancialRecommendation[]>("get_financial_recommendations", { profileId, year, month });

export interface MonthlySummary { year: number; month: number; total_income: number; total_expenses: number; }
export interface CategoryBreakdown { category_id: string | null; category_name: string; total: number; }

export const getMonthlySummary = (profileId: string, months: number) =>
  invoke<MonthlySummary[]>("get_monthly_summary", { profileId, months });

export const getExpenseBreakdown = (profileId: string, year: number, month: number) =>
  invoke<CategoryBreakdown[]>("get_expense_breakdown", { profileId, year, month });

export const getInstallmentCashflow = (profileId: string, monthsAhead: number) =>
  invoke<InstallmentCashflowPoint[]>("get_installment_cashflow", { profileId, monthsAhead });

// ── Sources & Categories ──────────────────────────────────────────────────────

export const getIncomeSources = (profileId: string) =>
  invoke<IncomeSource[]>("get_income_sources", { profileId });

export const createIncomeSource = (profileId: string, name: string, color?: string, icon?: string) =>
  invoke<IncomeSource>("create_income_source", { profileId, name, color: color ?? null, icon: icon ?? null });

export const updateIncomeSource = (id: string, name: string, color?: string | null, icon?: string | null) =>
  invoke<IncomeSource>("update_income_source", { id, name, color: color ?? null, icon: icon ?? null });

export const deleteIncomeSource = (id: string) => invoke<void>("delete_income_source", { id });

export const getExpenseCategories = (profileId: string) =>
  invoke<ExpenseCategory[]>("get_expense_categories", { profileId });

export const createExpenseCategory = (profileId: string, name: string, color?: string, icon?: string) =>
  invoke<ExpenseCategory>("create_expense_category", { profileId, name, color: color ?? null, icon: icon ?? null });

export const updateExpenseCategory = (id: string, name: string, color?: string | null, icon?: string | null) =>
  invoke<ExpenseCategory>("update_expense_category", { id, name, color: color ?? null, icon: icon ?? null });

export const deleteExpenseCategory = (id: string) => invoke<void>("delete_expense_category", { id });

// ── Installments ──────────────────────────────────────────────────────────────

export const getInstallments = (profileId: string) =>
  invoke<InstallmentEntry[]>("get_installments", { profileId });

export const createInstallment = (payload: {
  profile_id: string;
  account_id?: string | null;
  description: string;
  total_amount: number;
  installment_count: number;
  start_date: string;
  notes?: string;
}) => invoke<InstallmentEntry>("create_installment", { payload });

export const deleteInstallment = (id: string) => invoke<void>("delete_installment", { id });

// ── Investments ───────────────────────────────────────────────────────────────

export const getInvestments = (profileId: string) =>
  invoke<InvestmentEntry[]>("get_investments", { profileId });

export const createInvestment = (payload: {
  profile_id: string;
  name: string;
  ticker?: string;
  transaction_kind?: "buy" | "sell";
  account_id?: string | null;
  amount_invested: number;
  current_value?: number;
  transaction_date: string;
  notes?: string;
  quantity?: number;
  price_ars?: number;
  dolar_ccl?: number;
  current_price_ars?: number;
  instrument_type?: string;
  tna?: number;
  plazo_dias?: number;
  fecha_vencimiento?: string;
}) => invoke<InvestmentEntry>("create_investment", { payload });

export const updateInvestmentValue = (id: string, currentValue: number, currentPriceArs?: number) =>
  invoke<void>("update_investment_value", { id, currentValue, currentPriceArs });

export const deleteInvestment = (id: string) => invoke<void>("delete_investment", { id });

export const savePortfolioSnapshot = (
  profileId: string,
  totalValueArs: number,
  totalValueUsd: number,
  totalInvestedArs: number,
  ccl: number,
) => invoke<void>("save_portfolio_snapshot", { profileId, totalValueArs, totalValueUsd, totalInvestedArs, ccl });

export const getPortfolioSnapshots = (profileId: string, limitDays?: number) =>
  invoke<PortfolioSnapshot[]>("get_portfolio_snapshots", { profileId, limitDays });

// ── Assets ────────────────────────────────────────────────────────────────────

export const getAssets = (profileId: string) =>
  invoke<AssetSnapshot[]>("get_assets", { profileId });

export const createAsset = (payload: {
  profile_id: string;
  name: string;
  category?: string;
  value: number;
  snapshot_date: string;
  notes?: string;
}) => invoke<AssetSnapshot>("create_asset", { payload });

export const updateAsset = (id: string, payload: {
  name: string;
  category?: string | null;
  value: number;
  snapshot_date: string;
  notes?: string | null;
}) => invoke<AssetSnapshot>("update_asset", { id, payload });

export const deleteAsset = (id: string) => invoke<void>("delete_asset", { id });

// ── Accounts & Cash ───────────────────────────────────────────────────────────

export const getFinancialAccounts = (profileId: string) =>
  invoke<FinancialAccount[]>("get_financial_accounts", { profileId });

export const createFinancialAccount = (payload: {
  profile_id: string;
  name: string;
  institution?: string | null;
  account_type: string;
  currency_code: string;
  current_balance: number;
  is_liquid: boolean;
  include_in_net_worth: boolean;
  notes?: string | null;
}) => invoke<FinancialAccount>("create_financial_account", { payload });

export const updateFinancialAccount = (id: string, payload: {
  name: string;
  institution?: string | null;
  account_type: string;
  currency_code: string;
  current_balance: number;
  is_liquid: boolean;
  include_in_net_worth: boolean;
  notes?: string | null;
}) => invoke<FinancialAccount>("update_financial_account", { id, payload });

export const deleteFinancialAccount = (id: string) => invoke<void>("delete_financial_account", { id });

export const getCashOverview = (profileId: string) =>
  invoke<CashOverview>("get_cash_overview", { profileId });

export const getFinancialTransfers = (profileId: string, limit = 20) =>
  invoke<FinancialTransfer[]>("get_financial_transfers", { profileId, limit });

export const createFinancialTransfer = (payload: {
  profile_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  description?: string | null;
  notes?: string | null;
}) => invoke<FinancialTransfer>("create_financial_transfer", { payload });

export const deleteFinancialTransfer = (id: string) =>
  invoke<void>("delete_financial_transfer", { id });

export const getAccountLedger = (profileId: string, accountId: string, limit = 25) =>
  invoke<AccountLedgerEntry[]>("get_account_ledger", { profileId, accountId, limit });

export const getAccountBalanceHistory = (profileId: string, accountId: string, days = 30) =>
  invoke<AccountBalancePoint[]>("get_account_balance_history", { profileId, accountId, days });

// ── Goals ─────────────────────────────────────────────────────────────────────

export const getGoals = (profileId: string) =>
  invoke<GoalEntry[]>("get_goals", { profileId });

export const createGoal = (payload: {
  profile_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  notes?: string;
}) => invoke<GoalEntry>("create_goal", { payload });

export const updateGoalAmount = (id: string, currentAmount: number) =>
  invoke<void>("update_goal_amount", { id, currentAmount });

export const deleteGoal = (id: string) => invoke<void>("delete_goal", { id });
export const updateGoalStatus = (id: string, status: string) =>
  invoke<void>("update_goal_status", { id, status });

// ── Milestones ────────────────────────────────────────────────────────────────

export const getMilestones = (goalId: string) =>
  invoke<GoalMilestone[]>("get_milestones", { goalId });

export const createMilestone = (goalId: string, profileId: string, label: string, targetPct: number) =>
  invoke<GoalMilestone>("create_milestone", { goalId, profileId, label, targetPct });

export const deleteMilestone = (id: string) => invoke<void>("delete_milestone", { id });

export const checkAndMarkMilestones = (goalId: string, currentPct: number) =>
  invoke<GoalMilestone[]>("check_and_mark_milestones", { goalId, currentPct });

// ── Budgets ───────────────────────────────────────────────────────────────────

export const getBudgets = (profileId: string, year: number, month: number) =>
  invoke<CategoryBudget[]>("get_budgets", { profileId, year, month });

export const upsertBudget = (profileId: string, categoryId: string, year: number, month: number, budgetAmount: number) =>
  invoke<CategoryBudget>("upsert_budget", { profileId, categoryId, year, month, budgetAmount });

export const deleteBudget = (id: string) => invoke<void>("delete_budget", { id });

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getAlerts = (profileId: string, unreadOnly: boolean) =>
  invoke<Alert[]>("get_alerts", { profileId, unreadOnly });

export const createAlert = (payload: {
  profile_id: string;
  kind: string;
  title: string;
  body: string;
  ref_id?: string | null;
  ref_type?: string | null;
}) => invoke<Alert>("create_alert", { payload });

export const markAlertRead = (id: string) => invoke<void>("mark_alert_read", { id });
export const markAllAlertsRead = (profileId: string) => invoke<void>("mark_all_alerts_read", { profileId });
export const deleteAlert = (id: string) => invoke<void>("delete_alert", { id });
export const checkBudgetAlerts = (profileId: string, year: number, month: number) =>
  invoke<Alert[]>("check_budget_alerts", { profileId, year, month });

// ── Recurring transactions ────────────────────────────────────────────────────

export const getRecurringTransactions = (profileId: string) =>
  invoke<RecurringTransaction[]>("get_recurring_transactions", { profileId });

export const createRecurringTransaction = (payload: {
  profile_id: string;
  kind: string;
  account_id?: string | null;
  source_id?: string | null;
  category_id?: string | null;
  amount: number;
  description?: string | null;
  vendor?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  frequency: string;
  day_of_month?: number | null;
  next_due_date: string;
}) => invoke<RecurringTransaction>("create_recurring_transaction", { payload });

export const updateRecurringTransaction = (id: string, payload: {
  profile_id: string;
  kind: string;
  account_id?: string | null;
  source_id?: string | null;
  category_id?: string | null;
  amount: number;
  description?: string | null;
  vendor?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  frequency: string;
  day_of_month?: number | null;
  next_due_date: string;
}) => invoke<RecurringTransaction>("update_recurring_transaction", { id, payload });

export const deleteRecurringTransaction = (id: string) => invoke<void>("delete_recurring_transaction", { id });
export const toggleRecurringActive = (id: string) => invoke<void>("toggle_recurring_active", { id });
export const applyDueRecurring = (profileId: string, referenceDate: string) =>
  invoke<AppliedRecurring[]>("apply_due_recurring", { profileId, referenceDate });

// ── Net worth history ─────────────────────────────────────────────────────────

export const getNetWorthHistory = (profileId: string, limitDays?: number) =>
  invoke<NetWorthPoint[]>("get_net_worth_history", { profileId, limitDays });

export const saveNetWorthSnapshot = (profileId: string, totalAssets: number, notes?: string) =>
  invoke<NetWorthPoint>("save_net_worth_snapshot", { profileId, totalAssets, notes: notes ?? null });

// ── Custom themes ─────────────────────────────────────────────────────────────

export const getThemes = (profileId: string) =>
  invoke<CustomTheme[]>("get_themes", { profileId });

export const createTheme = (profileId: string, name: string, tokens: string) =>
  invoke<CustomTheme>("create_theme", { profileId, name, tokens });

export const activateTheme = (profileId: string, themeId: string) =>
  invoke<void>("activate_theme", { profileId, themeId });

export const deactivateAllThemes = (profileId: string) =>
  invoke<void>("deactivate_all_themes", { profileId });

export const deleteTheme = (id: string) => invoke<void>("delete_theme", { id });

// ── Reports ───────────────────────────────────────────────────────────────────

export interface RecentTransaction {
  id: string; kind: "income" | "expense"; amount: number;
  transaction_date: string; description: string | null; source_or_category: string | null;
}
export interface AnnualRow {
  month: number; month_name: string; total_income: number; total_expenses: number; balance: number;
}
export interface AnnualReport {
  rows: AnnualRow[]; total_income: number; total_expenses: number; total_balance: number;
}

export const getRecentTransactions = (profileId: string, limit: number) =>
  invoke<RecentTransaction[]>("get_recent_transactions", { profileId, limit });

export const getAnnualReport = (profileId: string, year: number) =>
  invoke<AnnualReport>("get_annual_report", { profileId, year });

export const getYoyComparison = (profileId: string, yearA: number, yearB: number) =>
  invoke<YoyComparison>("get_yoy_comparison", { profileId, yearA, yearB });

// ── Settings ──────────────────────────────────────────────────────────────────

export interface ProfileSettings { id: string; name: string; currency_code: string; locale: string; }

export const getDefaultProfile = () => invoke<ProfileSettings>("get_default_profile");
export const updateProfileSettings = (name: string, currencyCode: string, locale: string) =>
  invoke<ProfileSettings>("update_profile", { name, currencyCode, locale });

// ── Prices (Yahoo Finance) ────────────────────────────────────────────────────

export interface PriceResult { ticker: string; price_ars: number; currency: string; market_state: string; }
export interface PriceUpdate { ticker: string; price_ars: number; }
export const fetchPrices = (tickers: string[]) => invoke<PriceResult[]>("fetch_prices", { tickers });
export const fetchCcl = () => invoke<number>("fetch_ccl");
export const updatePricesByTicker = (profileId: string, updates: PriceUpdate[], currentCcl?: number) =>
  invoke<number>("update_prices_by_ticker", { profileId, updates, currentCcl });

// ── DB location (shared folder) ───────────────────────────────────────────────

export const getDbLocation = () => invoke<string>("get_db_location");
export const setDbLocation = (path: string) => invoke<void>("set_db_location", { path });
export const resetDbLocation = () => invoke<void>("reset_db_location");
export const copyDbToLocation = (path: string) => invoke<void>("copy_db_to_location", { path });

// ── Inversiones AR integration ────────────────────────────────────────────────

export interface InversionesSignal {
  id: string;
  ticker: string;
  instrument_name: string;
  asset_class: string;
  signal_type: "COMPRA" | "VENTA" | "NEUTRAL";
  entry_price: number;
  entry_price_usd: number | null;
  stop_loss: number;
  stop_loss_percent: number;
  take_profit1: number;
  take_profit1_percent: number;
  take_profit2: number;
  take_profit2_percent: number;
  strength: number;
  confidence_score: number;
  reasoning: string[];
  max_position_size_pct: number;
  risk_reward_ratio: number;
  generated_at: string;
  expires_at: string;
  is_stale: boolean;
  execution_ready: boolean;
  data_quality: string;
}

export const fetchInversionesSignals = () =>
  invoke<InversionesSignal[]>("fetch_inversiones_signals");

export interface TickerTechnicals {
  rsi14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  atr14: number | null;
  adx14: number | null;
  plus_di: number | null;
  minus_di: number | null;
  support_level: number | null;
  resistance_level: number | null;
  rsi_divergence: string | null;
  timestamp: string;
}

export interface PriceBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerAnalysis {
  ticker: string;
  instrument_name: string;
  asset_class: string;
  current_price: number | null;
  signal: InversionesSignal | null;
  technicals: TickerTechnicals | null;
  price_history: PriceBar[];
  macro_snapshot: {
    embi?: number | null;
    embiTrend?: string | null;
    inflacionMensual?: number | null;
    brechaCambiaria?: number | null;
    macroScore?: number;
    bondScore?: number;
    equityScore?: number;
  } | null;
}

export const fetchTickerAnalysis = (ticker: string) =>
  invoke<TickerAnalysis>("fetch_ticker_analysis", { ticker });
