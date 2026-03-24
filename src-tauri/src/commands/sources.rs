use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncomeSource {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExpenseCategory {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub description: Option<String>,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[tauri::command]
pub async fn get_income_sources(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<IncomeSource>, String> {
    sqlx::query_as::<_, IncomeSource>(
        "SELECT id, profile_id, name, description, color, icon FROM income_sources WHERE profile_id = ? ORDER BY name",
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_income_source(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO income_sources (id, profile_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&profile_id)
    .bind(&name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, IncomeSource>(
        "SELECT id, profile_id, name, description, color, icon FROM income_sources WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_income_source(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE income_sources SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, IncomeSource>(
        "SELECT id, profile_id, name, description, color, icon FROM income_sources WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_income_source(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM income_sources WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_expense_categories(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<ExpenseCategory>, String> {
    sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, profile_id, name, description, parent_id, color, icon FROM expense_categories WHERE profile_id = ? ORDER BY name",
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO expense_categories (id, profile_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&profile_id)
    .bind(&name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, profile_id, name, description, parent_id, color, icon FROM expense_categories WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE expense_categories SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, profile_id, name, description, parent_id, color, icon FROM expense_categories WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM expense_categories WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
