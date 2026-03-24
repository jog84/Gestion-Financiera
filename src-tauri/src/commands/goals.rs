use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GoalEntry {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub target_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGoalPayload {
    pub profile_id: String,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub target_date: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_goals(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<GoalEntry>, String> {
    sqlx::query_as::<_, GoalEntry>(
        "SELECT id, profile_id, name, target_amount, current_amount, target_date, status, notes
         FROM goal_entries WHERE profile_id = ? ORDER BY target_date ASC NULLS LAST",
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_goal(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateGoalPayload,
) -> Result<GoalEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO goal_entries (id, profile_id, name, target_amount, current_amount, target_date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.name)
    .bind(payload.target_amount)
    .bind(payload.current_amount)
    .bind(&payload.target_date)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, GoalEntry>(
        "SELECT id, profile_id, name, target_amount, current_amount, target_date, status, notes
         FROM goal_entries WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_goal_amount(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    current_amount: f64,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE goal_entries SET current_amount = ?, updated_at = ? WHERE id = ?")
        .bind(current_amount)
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_goal_status(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    status: String,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE goal_entries SET status = ?, updated_at = ? WHERE id = ?")
        .bind(&status)
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_goal(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM goal_entries WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
