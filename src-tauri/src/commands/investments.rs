use sqlx::SqlitePool;

use crate::services::investments::{
    create_investment as create_investment_entry, delete_investment as delete_investment_entry,
    list_investments, list_portfolio_snapshots,
    save_portfolio_snapshot as persist_portfolio_snapshot,
    update_investment_value as update_investment_quote, CreateInvestmentPayload, InvestmentEntry,
    PortfolioSnapshot,
};

#[tauri::command]
pub async fn save_portfolio_snapshot(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    total_value_ars: f64,
    total_value_usd: f64,
    total_invested_ars: f64,
    ccl: f64,
) -> Result<(), String> {
    persist_portfolio_snapshot(
        pool.inner(),
        &profile_id,
        total_value_ars,
        total_value_usd,
        total_invested_ars,
        ccl,
    )
    .await
}

#[tauri::command]
pub async fn get_portfolio_snapshots(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    limit_days: Option<i64>,
) -> Result<Vec<PortfolioSnapshot>, String> {
    list_portfolio_snapshots(pool.inner(), &profile_id, limit_days).await
}

#[tauri::command]
pub async fn get_investments(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<InvestmentEntry>, String> {
    list_investments(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_investment(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateInvestmentPayload,
) -> Result<InvestmentEntry, String> {
    create_investment_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn update_investment_value(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    current_value: f64,
    current_price_ars: Option<f64>,
) -> Result<(), String> {
    update_investment_quote(pool.inner(), &id, current_value, current_price_ars).await
}

#[tauri::command]
pub async fn delete_investment(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_investment_entry(pool.inner(), &id).await
}
