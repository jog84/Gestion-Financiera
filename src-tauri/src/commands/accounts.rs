use sqlx::SqlitePool;

use crate::services::accounts::{
    create_financial_account as create_financial_account_entry,
    delete_financial_account as delete_financial_account_entry,
    get_cash_overview as load_cash_overview,
    list_financial_accounts, update_financial_account as update_financial_account_entry,
    CashOverview, CreateFinancialAccountPayload, FinancialAccount, UpdateFinancialAccountPayload,
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
