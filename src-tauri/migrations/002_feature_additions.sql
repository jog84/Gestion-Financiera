-- ============================================================
-- Recurring transaction templates
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK(kind IN ('income', 'expense')),
    source_id       TEXT REFERENCES income_sources(id) ON DELETE SET NULL,
    category_id     TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    amount          REAL NOT NULL,
    description     TEXT,
    vendor          TEXT,
    payment_method  TEXT,
    notes           TEXT,
    frequency       TEXT NOT NULL CHECK(frequency IN ('monthly', 'weekly', 'biweekly', 'yearly')),
    day_of_month    INTEGER,
    day_of_week     INTEGER,
    month_of_year   INTEGER,
    next_due_date   TEXT NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_applied_date TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_recurring_profile ON recurring_transactions(profile_id, is_active);

-- ============================================================
-- Monthly budgets per expense category
-- ============================================================
CREATE TABLE IF NOT EXISTS category_budgets (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    category_id     TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    budget_amount   REAL NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, category_id, year, month)
);

-- ============================================================
-- In-app alerts / notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK(kind IN (
                    'budget_exceeded', 'budget_warning',
                    'goal_reached', 'goal_milestone',
                    'installment_due', 'price_target'
                )),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    ref_id      TEXT,
    ref_type    TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_alerts_profile_read ON alerts(profile_id, is_read);

-- ============================================================
-- Goal milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS goal_milestones (
    id          TEXT PRIMARY KEY,
    goal_id     TEXT NOT NULL REFERENCES goal_entries(id) ON DELETE CASCADE,
    profile_id  TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    target_pct  REAL NOT NULL,
    reached_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Asset net-worth history (periodic snapshots for chart)
-- ============================================================
CREATE TABLE IF NOT EXISTS net_worth_history (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    snapshot_date   TEXT NOT NULL,
    total_assets    REAL NOT NULL,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, snapshot_date)
);

-- ============================================================
-- Custom color themes
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_themes (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    tokens      TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ADD color and icon columns to expense_categories and income_sources
-- ============================================================
ALTER TABLE expense_categories ADD COLUMN color TEXT;
ALTER TABLE expense_categories ADD COLUMN icon  TEXT;
ALTER TABLE income_sources     ADD COLUMN color TEXT;
ALTER TABLE income_sources     ADD COLUMN icon  TEXT;
