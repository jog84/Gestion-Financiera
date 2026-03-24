-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    currency_code TEXT NOT NULL DEFAULT 'ARS',
    locale TEXT NOT NULL DEFAULT 'es-AR',
    is_default INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Periods (year/month per profile)
CREATE TABLE IF NOT EXISTS periods (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, year, month)
);

-- Income sources
CREATE TABLE IF NOT EXISTS income_sources (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Income entries
CREATE TABLE IF NOT EXISTS income_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES income_sources(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    origin TEXT NOT NULL DEFAULT 'manual',
    import_batch_id TEXT,
    external_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_income_entries_profile_period ON income_entries(profile_id, period_id);

-- Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Expense entries
CREATE TABLE IF NOT EXISTS expense_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT,
    vendor TEXT,
    payment_method TEXT,
    notes TEXT,
    is_installment_derived INTEGER NOT NULL DEFAULT 0,
    origin TEXT NOT NULL DEFAULT 'manual',
    import_batch_id TEXT,
    external_ref TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_expense_entries_profile_period ON expense_entries(profile_id, period_id);

-- Installment providers
CREATE TABLE IF NOT EXISTS installment_providers (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Installment entries
CREATE TABLE IF NOT EXISTS installment_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    provider_id TEXT REFERENCES installment_providers(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    total_amount REAL NOT NULL,
    installment_count INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    notes TEXT,
    origin TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Investment entries
CREATE TABLE IF NOT EXISTS investment_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ticker TEXT,
    amount_invested REAL NOT NULL,
    current_value REAL,
    transaction_date TEXT NOT NULL,
    notes TEXT,
    origin TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Asset snapshots (patrimonio)
CREATE TABLE IF NOT EXISTS asset_snapshots (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    value REAL NOT NULL,
    snapshot_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Goal entries
CREATE TABLE IF NOT EXISTS goal_entries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    target_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monthly balances
CREATE TABLE IF NOT EXISTS monthly_balances (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    total_income REAL NOT NULL DEFAULT 0,
    total_expenses REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, period_id)
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default profile
INSERT OR IGNORE INTO user_profiles (id, name, currency_code, locale, is_default, status)
VALUES ('default', 'Mi Perfil', 'ARS', 'es-AR', 1, 'active');
