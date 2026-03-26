CREATE TABLE IF NOT EXISTS alerts_new (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK(kind IN (
                    'budget_exceeded', 'budget_warning',
                    'goal_reached', 'goal_milestone',
                    'installment_due', 'price_target',
                    'low_liquidity', 'negative_cashflow',
                    'portfolio_concentration'
                )),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    ref_id      TEXT,
    ref_type    TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO alerts_new (id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at)
SELECT id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at
FROM alerts;

DROP TABLE alerts;
ALTER TABLE alerts_new RENAME TO alerts;

CREATE INDEX IF NOT EXISTS ix_alerts_profile_read ON alerts(profile_id, is_read);
