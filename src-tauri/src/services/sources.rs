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

pub async fn list_income_sources(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<IncomeSource>, String> {
    sqlx::query_as::<_, IncomeSource>(
        "SELECT id, profile_id, name, description, color, icon FROM income_sources WHERE profile_id = ? ORDER BY name",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_income_source(
    pool: &SqlitePool,
    profile_id: &str,
    name: &str,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO income_sources (id, profile_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(profile_id)
    .bind(name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_income_source_by_id(pool, &id).await
}

pub async fn update_income_source(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE income_sources SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?",
    )
    .bind(name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_income_source_by_id(pool, id).await
}

pub async fn delete_income_source(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM income_sources WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn list_expense_categories(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<ExpenseCategory>, String> {
    sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, profile_id, name, description, parent_id, color, icon FROM expense_categories WHERE profile_id = ? ORDER BY name",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_expense_category(
    pool: &SqlitePool,
    profile_id: &str,
    name: &str,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO expense_categories (id, profile_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(profile_id)
    .bind(name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_expense_category_by_id(pool, &id).await
}

pub async fn update_expense_category(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE expense_categories SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?",
    )
    .bind(name)
    .bind(&color)
    .bind(&icon)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_expense_category_by_id(pool, id).await
}

pub async fn delete_expense_category(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM expense_categories WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn get_income_source_by_id(pool: &SqlitePool, id: &str) -> Result<IncomeSource, String> {
    sqlx::query_as::<_, IncomeSource>(
        "SELECT id, profile_id, name, description, color, icon FROM income_sources WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}

async fn get_expense_category_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<ExpenseCategory, String> {
    sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, profile_id, name, description, parent_id, color, icon FROM expense_categories WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
