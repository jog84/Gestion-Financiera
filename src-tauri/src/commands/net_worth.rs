use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct NetWorthPoint {
    pub id: String,
    pub profile_id: String,
    pub snapshot_date: String,
    pub total_assets: f64,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_net_worth_history(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    limit_days: Option<i64>,
) -> Result<Vec<NetWorthPoint>, String> {
    let days = limit_days.unwrap_or(365);
    sqlx::query_as::<_, NetWorthPoint>(
        r#"SELECT id, profile_id, snapshot_date, total_assets, notes
           FROM net_worth_history
           WHERE profile_id = ? AND snapshot_date >= date('now', ? || ' days')
           ORDER BY snapshot_date ASC"#,
    )
    .bind(&profile_id)
    .bind(format!("-{}", days))
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_net_worth_snapshot(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    total_assets: f64,
    notes: Option<String>,
) -> Result<NetWorthPoint, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let today = &now[..10]; // YYYY-MM-DD

    sqlx::query(
        r#"INSERT INTO net_worth_history (id, profile_id, snapshot_date, total_assets, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(profile_id, snapshot_date) DO UPDATE SET total_assets = excluded.total_assets, notes = excluded.notes"#,
    )
    .bind(&id)
    .bind(&profile_id)
    .bind(today)
    .bind(total_assets)
    .bind(&notes)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let point: NetWorthPoint = sqlx::query_as(
        "SELECT id, profile_id, snapshot_date, total_assets, notes FROM net_worth_history WHERE profile_id = ? AND snapshot_date = ?",
    )
    .bind(&profile_id)
    .bind(today)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(point)
}
