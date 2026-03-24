use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserProfile {
    pub id: String,
    pub name: String,
    pub currency_code: String,
    pub locale: String,
    pub is_default: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn get_profiles(pool: tauri::State<'_, SqlitePool>) -> Result<Vec<UserProfile>, String> {
    sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles ORDER BY name")
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_profile(
    pool: tauri::State<'_, SqlitePool>,
    name: String,
    currency_code: String,
) -> Result<UserProfile, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO user_profiles (id, name, currency_code, locale, is_default, status, created_at, updated_at)
         VALUES (?, ?, ?, 'es-AR', 0, 'active', ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&currency_code)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}
