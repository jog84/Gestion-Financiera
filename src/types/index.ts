export interface UserProfile {
  id: string;
  name: string;
  currency_code: string;
  locale: string;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Period {
  id: string;
  profile_id: string;
  year: number;
  month: number;
}

export interface IncomeSource {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
}

export interface IncomeEntry {
  id: string;
  profile_id: string;
  period_id: string;
  account_id: string | null;
  account_name?: string | null;
  source_id: string | null;
  source_name?: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  notes: string | null;
  origin: "manual" | "import" | "recurring";
}

export interface ExpenseCategory {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
}

export interface ExpenseEntry {
  id: string;
  profile_id: string;
  period_id: string;
  account_id: string | null;
  account_name?: string | null;
  category_id: string | null;
  category_name?: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  payment_method: string | null;
  notes: string | null;
  is_installment_derived: boolean;
  origin: "manual" | "import" | "recurring";
}

export interface InstallmentEntry {
  id: string;
  profile_id: string;
  account_id: string | null;
  account_name: string | null;
  provider_id: string | null;
  provider_name: string | null;
  description: string;
  total_amount: number;
  installment_count: number;
  start_date: string;
  notes: string | null;
}

export type InstrumentType = 'cedear' | 'accion' | 'plazo_fijo' | 'bono' | 'fci' | 'crypto' | 'otro';

export interface InvestmentEntry {
  id: string;
  profile_id: string;
  period_id: string;
  name: string;
  ticker: string | null;
  transaction_kind: "buy" | "sell";
  account_id: string | null;
  account_name: string | null;
  amount_invested: number;
  current_value: number | null;
  cash_amount_ars: number | null;
  realized_cost_ars: number | null;
  realized_gain_ars: number | null;
  transaction_date: string;
  notes: string | null;
  quantity: number | null;
  price_ars: number | null;
  dolar_ccl: number | null;
  current_price_ars: number | null;
  instrument_type: InstrumentType;
  tna: number | null;
  plazo_dias: number | null;
  fecha_vencimiento: string | null;
  sector: string | null;
}

export interface PortfolioSnapshot {
  id: string;
  profile_id: string;
  snapshot_date: string;
  total_value_ars: number;
  total_value_usd: number;
  total_invested_ars: number;
  ccl: number;
}

export interface AssetSnapshot {
  id: string;
  profile_id: string;
  period_id: string;
  name: string;
  category: string | null;
  value: number;
  snapshot_date: string;
  notes: string | null;
}

export interface FinancialAccount {
  id: string;
  profile_id: string;
  name: string;
  institution: string | null;
  account_type: string;
  currency_code: string;
  current_balance: number;
  is_liquid: boolean;
  include_in_net_worth: boolean;
  notes: string | null;
}

export interface CashOverview {
  total_balance: number;
  liquid_balance: number;
  non_liquid_balance: number;
  account_count: number;
  liquid_account_count: number;
}

export interface FinancialTransfer {
  id: string;
  profile_id: string;
  from_account_id: string;
  from_account_name: string;
  to_account_id: string;
  to_account_name: string;
  amount: number;
  transfer_date: string;
  description: string | null;
  notes: string | null;
}

export interface AccountLedgerEntry {
  id: string;
  account_id: string;
  account_name: string;
  entry_type: string;
  direction: "in" | "out";
  amount: number;
  entry_date: string;
  description: string | null;
  counterparty: string | null;
  origin: string | null;
}

export interface AccountBalancePoint {
  date: string;
  balance: number;
}

export interface GoalEntry {
  id: string;
  profile_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: string;
  notes: string | null;
}

export interface DashboardSummary {
  total_income: number;
  total_expenses: number;
  balance: number;
  month: number;
  year: number;
}

export interface FinancialOverview {
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  balance: number;
  savings_rate: number;
  total_assets: number;
  liquid_assets: number;
  investment_assets: number;
  physical_assets: number;
  monthly_fixed_expenses: number;
  liquidity_months: number | null;
}

export interface FinancialInsight {
  id: string;
  kind: "low_liquidity" | "negative_cashflow" | "portfolio_concentration" | "fixed_expense_pressure";
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  action_label: string | null;
  action_route: string | null;
  metric_value: number | null;
}

export interface FinancialRecommendation {
  id: string;
  title: string;
  summary: string;
  impact_label: string;
  impact_value: number;
  action_label: string | null;
  action_route: string | null;
}

// ── Recurring transactions ────────────────────────────────────────────────────

export type RecurringFrequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  profile_id: string;
  kind: 'income' | 'expense';
  account_id: string | null;
  account_name: string | null;
  source_id: string | null;
  source_name: string | null;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  description: string | null;
  vendor: string | null;
  payment_method: string | null;
  notes: string | null;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  next_due_date: string;
  is_active: boolean;
  last_applied_date: string | null;
}

export interface AppliedRecurring {
  id: string;
  description: string;
  amount: number;
  kind: string;
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export interface CategoryBudget {
  id: string;
  profile_id: string;
  category_id: string;
  category_name: string | null;
  year: number;
  month: number;
  budget_amount: number;
  spent_amount: number;
  pct_used: number;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AlertKind =
  | 'budget_exceeded'
  | 'budget_warning'
  | 'goal_reached'
  | 'goal_milestone'
  | 'installment_due'
  | 'price_target'
  | 'low_liquidity'
  | 'negative_cashflow'
  | 'portfolio_concentration';

export interface Alert {
  id: string;
  profile_id: string;
  kind: AlertKind;
  title: string;
  body: string;
  ref_id: string | null;
  ref_type: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Net worth history ─────────────────────────────────────────────────────────

export interface NetWorthPoint {
  id: string;
  profile_id: string;
  snapshot_date: string;
  total_assets: number;
  notes: string | null;
}

// ── Goal milestones ───────────────────────────────────────────────────────────

export interface GoalMilestone {
  id: string;
  goal_id: string;
  profile_id: string;
  label: string;
  target_pct: number;
  reached_at: string | null;
}

// ── Custom themes ─────────────────────────────────────────────────────────────

export interface CustomTheme {
  id: string;
  profile_id: string;
  name: string;
  tokens: string;
  is_active: boolean;
}

// ── YoY comparison ────────────────────────────────────────────────────────────

export interface YoyRow {
  month: number;
  month_name: string;
  income_a: number;
  expenses_a: number;
  income_b: number;
  expenses_b: number;
}

export interface YoyComparison {
  year_a: number;
  year_b: number;
  rows: YoyRow[];
  total_income_a: number;
  total_expenses_a: number;
  total_income_b: number;
  total_expenses_b: number;
  income_diff: number;
  expenses_diff: number;
}

// ── Installment cashflow ──────────────────────────────────────────────────────

export interface InstallmentCashflowPoint {
  year: number;
  month: number;
  month_label: string;
  total_due: number;
  installment_count: number;
}
