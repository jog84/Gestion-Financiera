use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncomeEntry {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub source_id: Option<String>,
    pub source_name: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub origin: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncomePayload {
    pub profile_id: String,
    pub source_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

pub async fn get_or_create_period(
    pool: &SqlitePool,
    profile_id: &str,
    date: &str,
) -> Result<String, String> {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() < 2 {
        return Err("invalid date format".to_string());
    }
    let year: i64 = parts[0].parse().map_err(|_| "invalid year")?;
    let month: i64 = parts[1].parse().map_err(|_| "invalid month")?;

    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM periods WHERE profile_id = ? AND year = ? AND month = ?")
            .bind(profile_id)
            .bind(year)
            .bind(month)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO periods (id, profile_id, year, month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn get_incomes(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<IncomeEntry>, String> {
    sqlx::query_as::<_, IncomeEntry>(
        r#"SELECT
            ie.id, ie.profile_id, ie.period_id, ie.source_id,
            src.name AS source_name,
            ie.amount, ie.transaction_date, ie.description, ie.notes, ie.origin
        FROM income_entries ie
        LEFT JOIN income_sources src ON ie.source_id = src.id
        JOIN periods p ON ie.period_id = p.id
        WHERE ie.profile_id = ? AND p.year = ? AND p.month = ?
        ORDER BY ie.transaction_date DESC"#,
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_income(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateIncomePayload,
) -> Result<IncomeEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id =
        get_or_create_period(pool.inner(), &payload.profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "INSERT INTO income_entries (id, profile_id, period_id, source_id, amount, transaction_date, description, notes, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.source_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, IncomeEntry>(
        r#"SELECT ie.id, ie.profile_id, ie.period_id, ie.source_id,
                  src.name AS source_name,
                  ie.amount, ie.transaction_date, ie.description, ie.notes, ie.origin
           FROM income_entries ie
           LEFT JOIN income_sources src ON ie.source_id = src.id
           WHERE ie.id = ?"#,
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_income(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM income_entries WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncomePayload {
    pub source_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn update_income(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateIncomePayload,
) -> Result<IncomeEntry, String> {
    let now = Utc::now().to_rfc3339();
    // Get profile_id for period creation
    let (profile_id,): (String,) = sqlx::query_as(
        "SELECT profile_id FROM income_entries WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let period_id = get_or_create_period(pool.inner(), &profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "UPDATE income_entries SET source_id = ?, amount = ?, transaction_date = ?, description = ?, notes = ?, period_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&payload.source_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.notes)
    .bind(&period_id)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, IncomeEntry>(
        r#"SELECT ie.id, ie.profile_id, ie.period_id, ie.source_id,
                  src.name AS source_name,
                  ie.amount, ie.transaction_date, ie.description, ie.notes, ie.origin
           FROM income_entries ie
           LEFT JOIN income_sources src ON ie.source_id = src.id
           WHERE ie.id = ?"#,
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
