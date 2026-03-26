CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    institution TEXT,
    account_type TEXT NOT NULL DEFAULT 'cash',
    currency_code TEXT NOT NULL DEFAULT 'ARS',
    current_balance REAL NOT NULL DEFAULT 0,
    is_liquid INTEGER NOT NULL DEFAULT 1,
    include_in_net_worth INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_profile ON financial_accounts(profile_id);
