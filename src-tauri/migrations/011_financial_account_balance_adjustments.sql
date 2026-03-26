CREATE TABLE IF NOT EXISTS financial_account_balance_adjustments (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    adjustment_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_balance_adjustments_account_date
ON financial_account_balance_adjustments(account_id, adjustment_date DESC);
