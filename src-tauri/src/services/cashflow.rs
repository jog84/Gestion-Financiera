use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::services::accounts::apply_account_balance_delta;
use crate::services::periods::{get_or_create_period, get_profile_id_for_record, ProfileOwnedTable};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncomeEntry {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
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
    pub account_id: Option<String>,
    pub source_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncomePayload {
    pub account_id: Option<String>,
    pub source_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ExpenseEntry {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
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
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpensePayload {
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

const INCOME_SELECT_BY_ID: &str = r#"SELECT ie.id, ie.profile_id, ie.period_id, ie.account_id,
                  fa.name AS account_name,
                  ie.source_id,
                  src.name AS source_name,
                  ie.amount, ie.transaction_date, ie.description, ie.notes, ie.origin
           FROM income_entries ie
           LEFT JOIN financial_accounts fa ON ie.account_id = fa.id
           LEFT JOIN income_sources src ON ie.source_id = src.id
           WHERE ie.id = ?"#;

const EXPENSE_SELECT_BY_ID: &str = r#"SELECT ee.id, ee.profile_id, ee.period_id, ee.account_id,
                  fa.name AS account_name,
                  ee.category_id,
                  cat.name AS category_name,
                  ee.amount, ee.transaction_date, ee.description, ee.vendor,
                  ee.payment_method, ee.notes, ee.is_installment_derived, ee.origin
           FROM expense_entries ee
           LEFT JOIN financial_accounts fa ON ee.account_id = fa.id
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           WHERE ee.id = ?"#;

pub async fn list_incomes(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<Vec<IncomeEntry>, String> {
    sqlx::query_as::<_, IncomeEntry>(
        r#"SELECT
            ie.id, ie.profile_id, ie.period_id, ie.account_id,
            fa.name AS account_name,
            ie.source_id,
            src.name AS source_name,
            ie.amount, ie.transaction_date, ie.description, ie.notes, ie.origin
        FROM income_entries ie
        LEFT JOIN financial_accounts fa ON ie.account_id = fa.id
        LEFT JOIN income_sources src ON ie.source_id = src.id
        JOIN periods p ON ie.period_id = p.id
        WHERE ie.profile_id = ? AND p.year = ? AND p.month = ?
        ORDER BY ie.transaction_date DESC"#,
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_income(
    pool: &SqlitePool,
    payload: CreateIncomePayload,
) -> Result<IncomeEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id = get_or_create_period(pool, &payload.profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "INSERT INTO income_entries (id, profile_id, period_id, account_id, source_id, amount, transaction_date, description, notes, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.account_id)
    .bind(&payload.source_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, payload.account_id.as_deref(), payload.amount).await?;

    get_income_by_id(pool, &id).await
}

pub async fn update_income(
    pool: &SqlitePool,
    id: &str,
    payload: UpdateIncomePayload,
) -> Result<IncomeEntry, String> {
    let now = Utc::now().to_rfc3339();
    let profile_id = get_profile_id_for_record(pool, ProfileOwnedTable::IncomeEntries, id).await?;
    let period_id = get_or_create_period(pool, &profile_id, &payload.transaction_date).await?;
    let previous: (Option<String>, f64) = sqlx::query_as(
        "SELECT account_id, amount FROM income_entries WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE income_entries SET account_id = ?, source_id = ?, amount = ?, transaction_date = ?, description = ?, notes = ?, period_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&payload.account_id)
    .bind(&payload.source_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.notes)
    .bind(&period_id)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, previous.0.as_deref(), -previous.1).await?;
    apply_account_balance_delta(pool, payload.account_id.as_deref(), payload.amount).await?;

    get_income_by_id(pool, id).await
}

pub async fn delete_income(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let previous: (Option<String>, f64) = sqlx::query_as(
        "SELECT account_id, amount FROM income_entries WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM income_entries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, previous.0.as_deref(), -previous.1).await?;
    Ok(())
}

pub async fn list_expenses(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<Vec<ExpenseEntry>, String> {
    sqlx::query_as::<_, ExpenseEntry>(
        r#"SELECT
            ee.id, ee.profile_id, ee.period_id, ee.account_id,
            fa.name AS account_name,
            ee.category_id,
            cat.name AS category_name,
            ee.amount, ee.transaction_date, ee.description, ee.vendor,
            ee.payment_method, ee.notes, ee.is_installment_derived, ee.origin
        FROM expense_entries ee
        LEFT JOIN financial_accounts fa ON ee.account_id = fa.id
        LEFT JOIN expense_categories cat ON ee.category_id = cat.id
        JOIN periods p ON ee.period_id = p.id
        WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?
        ORDER BY ee.transaction_date DESC"#,
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_expense(
    pool: &SqlitePool,
    payload: CreateExpensePayload,
) -> Result<ExpenseEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id = get_or_create_period(pool, &payload.profile_id, &payload.transaction_date).await?;

    sqlx::query(
        "INSERT INTO expense_entries (id, profile_id, period_id, account_id, category_id, amount, transaction_date, description, vendor, payment_method, notes, is_installment_derived, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'manual', ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.account_id)
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, payload.account_id.as_deref(), -payload.amount).await?;

    get_expense_by_id(pool, &id).await
}

pub async fn update_expense(
    pool: &SqlitePool,
    id: &str,
    payload: UpdateExpensePayload,
) -> Result<ExpenseEntry, String> {
    let now = Utc::now().to_rfc3339();
    let profile_id = get_profile_id_for_record(pool, ProfileOwnedTable::ExpenseEntries, id).await?;
    let period_id = get_or_create_period(pool, &profile_id, &payload.transaction_date).await?;
    let previous: (Option<String>, f64) = sqlx::query_as(
        "SELECT account_id, amount FROM expense_entries WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE expense_entries SET account_id = ?, category_id = ?, amount = ?, transaction_date = ?, description = ?, vendor = ?, payment_method = ?, notes = ?, period_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&payload.account_id)
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.transaction_date)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&period_id)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, previous.0.as_deref(), previous.1).await?;
    apply_account_balance_delta(pool, payload.account_id.as_deref(), -payload.amount).await?;

    get_expense_by_id(pool, id).await
}

pub async fn delete_expense(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let previous: (Option<String>, f64) = sqlx::query_as(
        "SELECT account_id, amount FROM expense_entries WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM expense_entries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    apply_account_balance_delta(pool, previous.0.as_deref(), previous.1).await?;
    Ok(())
}

async fn get_income_by_id(pool: &SqlitePool, id: &str) -> Result<IncomeEntry, String> {
    sqlx::query_as::<_, IncomeEntry>(INCOME_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

async fn get_expense_by_id(pool: &SqlitePool, id: &str) -> Result<ExpenseEntry, String> {
    sqlx::query_as::<_, ExpenseEntry>(EXPENSE_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}
