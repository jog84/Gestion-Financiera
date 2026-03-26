use sqlx::SqlitePool;

use crate::services::analytics::{
    get_annual_report as load_annual_report, get_recent_transactions as load_recent_transactions,
    get_yoy_comparison as load_yoy_comparison, AnnualReport, RecentTransaction, YoyComparison,
};

#[tauri::command]
pub async fn get_recent_transactions(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    limit: i64,
) -> Result<Vec<RecentTransaction>, String> {
    load_recent_transactions(pool.inner(), &profile_id, limit).await
}

#[tauri::command]
pub async fn get_annual_report(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
) -> Result<AnnualReport, String> {
    load_annual_report(pool.inner(), &profile_id, year).await
}

#[tauri::command]
pub async fn get_yoy_comparison(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year_a: i64,
    year_b: i64,
) -> Result<YoyComparison, String> {
    load_yoy_comparison(pool.inner(), &profile_id, year_a, year_b).await
}
