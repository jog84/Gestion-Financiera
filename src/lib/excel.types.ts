export interface ImportedIncome {
  transaction_date: string;
  description: string;
  source_name: string;
  amount: number;
  notes: string;
}

export interface ImportedExpense {
  transaction_date: string;
  description: string;
  category_name: string;
  vendor: string;
  payment_method: string;
  amount: number;
  notes: string;
}

export interface ImportedInstallment {
  description: string;
  provider_name: string;
  total_amount: number;
  installment_count: number;
  start_date: string;
  notes: string;
}

export interface ImportedInvestment {
  transaction_date: string;
  name: string;
  ticker: string;
  amount_invested: number;
  current_value: number;
  notes: string;
  quantity?: number;
  price_ars?: number;
  dolar_ccl?: number;
  current_price_ars?: number;
}

export interface ImportedAsset {
  snapshot_date: string;
  name: string;
  category: string;
  value: number;
  notes: string;
}

export interface ImportedGoal {
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  status: string;
  notes: string;
}
