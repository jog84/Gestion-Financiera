ALTER TABLE recurring_transactions ADD COLUMN account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;
ALTER TABLE installment_entries ADD COLUMN account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_recurring_transactions_account ON recurring_transactions(account_id);
CREATE INDEX IF NOT EXISTS ix_installment_entries_account ON installment_entries(account_id);
