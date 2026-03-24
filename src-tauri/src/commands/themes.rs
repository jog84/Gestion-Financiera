use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CustomTheme {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub tokens: String,
    pub is_active: bool,
}

#[tauri::command]
pub async fn get_themes(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<CustomTheme>, String> {
    sqlx::query_as::<_, CustomTheme>(
        "SELECT id, profile_id, name, tokens, is_active FROM custom_themes WHERE profile_id = ? ORDER BY name",
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_theme(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    name: String,
    tokens: String,
) -> Result<CustomTheme, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO custom_themes (id, profile_id, name, tokens, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&profile_id)
    .bind(&name)
    .bind(&tokens)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, CustomTheme>(
        "SELECT id, profile_id, name, tokens, is_active FROM custom_themes WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn activate_theme(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    theme_id: String,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    // Deactivate all
    sqlx::query("UPDATE custom_themes SET is_active = 0, updated_at = ? WHERE profile_id = ?")
        .bind(&now)
        .bind(&profile_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    // Activate selected
    sqlx::query("UPDATE custom_themes SET is_active = 1, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&theme_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn deactivate_all_themes(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE custom_themes SET is_active = 0, updated_at = ? WHERE profile_id = ?")
        .bind(&now)
        .bind(&profile_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_theme(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM custom_themes WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
