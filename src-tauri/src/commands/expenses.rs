use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::incomes::get_or_create_period;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExpenseEntry {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub is_installment_derived: bool,
    pub origin: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateExpensePayload {
    pub profile_id: String,
    pub category_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_expenses(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<ExpenseEntry>, String> {
    sqlx::query_as::<_, ExpenseEntry>(
        r#"SELECT
            ee.id, ee.profile_id, ee.period_id, ee.category_id,
            cat.name AS category_name,
            ee.amount, ee.transaction_date, ee.description, ee.vendor,
            ee.payment_method, ee.notes, ee.is_installment_derived, ee.origin
        FROM expense_entries ee
        LEFT JOIN expense_categories cat ON ee.category_id = cat.id
        JOIN periods p ON ee.period_id = p.id
        WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?
        ORDER BY ee.transaction_date DESC"#,
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_expense(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateExpensePayload,
) -> Result<ExpenseEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id =
        get_or_create_period(pool.inner(), &payload.profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "INSERT INTO expense_entries (id, profile_id, period_id, category_id, amount, transaction_date, description, vendor, payment_method, notes, is_installment_derived, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'manual', ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ExpenseEntry>(
        r#"SELECT ee.id, ee.profile_id, ee.period_id, ee.category_id,
                  cat.name AS category_name,
                  ee.amount, ee.transaction_date, ee.description, ee.vendor,
                  ee.payment_method, ee.notes, ee.is_installment_derived, ee.origin
           FROM expense_entries ee
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           WHERE ee.id = ?"#,
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_expense(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM expense_entries WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpensePayload {
    pub category_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn update_expense(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateExpensePayload,
) -> Result<ExpenseEntry, String> {
    let now = Utc::now().to_rfc3339();
    let (profile_id,): (String,) = sqlx::query_as(
        "SELECT profile_id FROM expense_entries WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let period_id = get_or_create_period(pool.inner(), &profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "UPDATE expense_entries SET category_id = ?, amount = ?, transaction_date = ?, description = ?, vendor = ?, payment_method = ?, notes = ?, period_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&period_id)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, ExpenseEntry>(
        r#"SELECT ee.id, ee.profile_id, ee.period_id, ee.category_id,
                  cat.name AS category_name,
                  ee.amount, ee.transaction_date, ee.description, ee.vendor,
                  ee.payment_method, ee.notes, ee.is_installment_derived, ee.origin
           FROM expense_entries ee
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           WHERE ee.id = ?"#,
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}
