use sqlx::SqlitePool;

use crate::services::analytics::{
    get_dashboard_summary as load_dashboard_summary,
    get_financial_overview as load_financial_overview,
    DashboardSummary,
    FinancialOverview,
};

#[tauri::command]
pub async fn get_dashboard_summary(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<DashboardSummary, String> {
    load_dashboard_summary(pool.inner(), &profile_id, year, month).await
}

#[tauri::command]
pub async fn get_financial_overview(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<FinancialOverview, String> {
    load_financial_overview(pool.inner(), &profile_id, year, month).await
}
