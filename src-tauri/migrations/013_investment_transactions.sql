ALTER TABLE investment_entries ADD COLUMN transaction_kind TEXT NOT NULL DEFAULT 'buy';
ALTER TABLE investment_entries ADD COLUMN account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;
ALTER TABLE investment_entries ADD COLUMN cash_amount_ars REAL;
ALTER TABLE investment_entries ADD COLUMN realized_cost_ars REAL;
ALTER TABLE investment_entries ADD COLUMN realized_gain_ars REAL;

CREATE INDEX IF NOT EXISTS idx_investment_entries_kind ON investment_entries(profile_id, transaction_kind);
CREATE INDEX IF NOT EXISTS idx_investment_entries_account ON investment_entries(account_id);
