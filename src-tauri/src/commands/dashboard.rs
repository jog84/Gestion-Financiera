use sqlx::SqlitePool;

use crate::services::analytics::{
    check_financial_alerts as run_financial_alert_checks,
    get_dashboard_summary as load_dashboard_summary,
    get_financial_insights as load_financial_insights,
    get_financial_overview as load_financial_overview,
    get_financial_recommendations as load_financial_recommendations, DashboardSummary,
    FinancialInsight, FinancialOverview, FinancialRecommendation,
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

#[tauri::command]
pub async fn get_financial_insights(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialInsight>, String> {
    load_financial_insights(pool.inner(), &profile_id, year, month).await
}

#[tauri::command]
pub async fn check_financial_alerts(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialInsight>, String> {
    run_financial_alert_checks(pool.inner(), &profile_id, year, month).await
}

#[tauri::command]
pub async fn get_financial_recommendations(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialRecommendation>, String> {
    load_financial_recommendations(pool.inner(), &profile_id, year, month).await
}
