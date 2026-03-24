use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GoalMilestone {
    pub id: String,
    pub goal_id: String,
    pub profile_id: String,
    pub label: String,
    pub target_pct: f64,
    pub reached_at: Option<String>,
}

#[tauri::command]
pub async fn get_milestones(
    pool: tauri::State<'_, SqlitePool>,
    goal_id: String,
) -> Result<Vec<GoalMilestone>, String> {
    sqlx::query_as::<_, GoalMilestone>(
        "SELECT id, goal_id, profile_id, label, target_pct, reached_at FROM goal_milestones WHERE goal_id = ? ORDER BY target_pct ASC",
    )
    .bind(&goal_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_milestone(
    pool: tauri::State<'_, SqlitePool>,
    goal_id: String,
    profile_id: String,
    label: String,
    target_pct: f64,
) -> Result<GoalMilestone, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO goal_milestones (id, goal_id, profile_id, label, target_pct, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&goal_id)
    .bind(&profile_id)
    .bind(&label)
    .bind(target_pct)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, GoalMilestone>(
        "SELECT id, goal_id, profile_id, label, target_pct, reached_at FROM goal_milestones WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_milestone(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM goal_milestones WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_and_mark_milestones(
    pool: tauri::State<'_, SqlitePool>,
    goal_id: String,
    current_pct: f64,
) -> Result<Vec<GoalMilestone>, String> {
    let now = Utc::now().to_rfc3339();

    // Find milestones that should be reached but aren't yet
    let pending: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM goal_milestones WHERE goal_id = ? AND target_pct <= ? AND reached_at IS NULL",
    )
    .bind(&goal_id)
    .bind(current_pct)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    for (mid,) in &pending {
        sqlx::query("UPDATE goal_milestones SET reached_at = ? WHERE id = ?")
            .bind(&now)
            .bind(mid)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    // Return newly marked milestones
    let ids: Vec<String> = pending.into_iter().map(|(id,)| id).collect();
    if ids.is_empty() {
        return Ok(vec![]);
    }

    // Fetch all updated
    let mut result = Vec::new();
    for mid in &ids {
        let m: GoalMilestone = sqlx::query_as(
            "SELECT id, goal_id, profile_id, label, target_pct, reached_at FROM goal_milestones WHERE id = ?",
        )
        .bind(mid)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
        result.push(m);
    }
    Ok(result)
}
