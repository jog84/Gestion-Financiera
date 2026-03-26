CREATE TABLE IF NOT EXISTS financial_transfers (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    from_account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    to_account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    transfer_date TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (amount > 0),
    CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transfers_profile_date ON financial_transfers(profile_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transfers_from_account ON financial_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transfers_to_account ON financial_transfers(to_account_id);
