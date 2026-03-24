use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub month: i64,
    pub year: i64,
}

#[tauri::command]
pub async fn get_dashboard_summary(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<DashboardSummary, String> {
    let (total_income,): (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ie.amount), 0.0)
         FROM income_entries ie
         JOIN periods p ON ie.period_id = p.id
         WHERE ie.profile_id = ? AND p.year = ? AND p.month = ?",
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (total_expenses,): (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ee.amount), 0.0)
         FROM expense_entries ee
         JOIN periods p ON ee.period_id = p.id
         WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?",
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(DashboardSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
        month,
        year,
    })
}
