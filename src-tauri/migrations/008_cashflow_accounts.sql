ALTER TABLE income_entries ADD COLUMN account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;
ALTER TABLE expense_entries ADD COLUMN account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_income_entries_account ON income_entries(account_id);
CREATE INDEX IF NOT EXISTS ix_expense_entries_account ON expense_entries(account_id);
