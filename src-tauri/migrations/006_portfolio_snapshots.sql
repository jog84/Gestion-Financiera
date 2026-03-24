CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    total_value_ars REAL NOT NULL DEFAULT 0,
    total_value_usd REAL NOT NULL DEFAULT 0,
    total_invested_ars REAL NOT NULL DEFAULT 0,
    ccl REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, snapshot_date)
);
