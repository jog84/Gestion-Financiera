use sqlx::SqlitePool;

use crate::services::accounts::{
    get_account_balance_history as load_account_balance_history,
    list_account_ledger,
    create_financial_account as create_financial_account_entry,
    create_financial_transfer as create_financial_transfer_entry,
    delete_financial_account as delete_financial_account_entry,
    delete_financial_transfer as delete_financial_transfer_entry,
    get_cash_overview as load_cash_overview,
    list_financial_accounts, list_financial_transfers, update_financial_account as update_financial_account_entry,
    AccountBalancePoint, AccountLedgerEntry, CashOverview, CreateFinancialAccountPayload, CreateFinancialTransferPayload,
    FinancialAccount, FinancialTransfer, UpdateFinancialAccountPayload,
};

#[tauri::command]
pub async fn get_financial_accounts(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<FinancialAccount>, String> {
    list_financial_accounts(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_financial_account(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateFinancialAccountPayload,
) -> Result<FinancialAccount, String> {
    create_financial_account_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn update_financial_account(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateFinancialAccountPayload,
) -> Result<FinancialAccount, String> {
    update_financial_account_entry(pool.inner(), &id, payload).await
}

#[tauri::command]
pub async fn delete_financial_account(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_financial_account_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn get_cash_overview(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<CashOverview, String> {
    load_cash_overview(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn get_financial_transfers(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    limit: Option<i64>,
) -> Result<Vec<FinancialTransfer>, String> {
    list_financial_transfers(pool.inner(), &profile_id, limit.unwrap_or(20)).await
}

#[tauri::command]
pub async fn create_financial_transfer(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateFinancialTransferPayload,
) -> Result<FinancialTransfer, String> {
    create_financial_transfer_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn delete_financial_transfer(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_financial_transfer_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn get_account_ledger(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    account_id: String,
    limit: Option<i64>,
) -> Result<Vec<AccountLedgerEntry>, String> {
    list_account_ledger(pool.inner(), &profile_id, &account_id, limit.unwrap_or(25)).await
}

#[tauri::command]
pub async fn get_account_balance_history(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    account_id: String,
    days: Option<i64>,
) -> Result<Vec<AccountBalancePoint>, String> {
    load_account_balance_history(pool.inner(), &profile_id, &account_id, days.unwrap_or(30)).await
}
