use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::services::accounts::apply_account_balance_delta;
use crate::services::periods::get_or_create_period;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecurringTransaction {
    pub id: String,
    pub profile_id: String,
    pub kind: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub source_id: Option<String>,
    pub source_name: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub frequency: String,
    pub day_of_month: Option<i64>,
    pub next_due_date: String,
    pub is_active: bool,
    pub last_applied_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppliedRecurring {
    pub id: String,
    pub description: String,
    pub amount: f64,
    pub kind: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecurringPayload {
    pub profile_id: String,
    pub kind: String,
    pub account_id: Option<String>,
    pub source_id: Option<String>,
    pub category_id: Option<String>,
    pub amount: f64,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub frequency: String,
    pub day_of_month: Option<i64>,
    pub next_due_date: String,
}

pub async fn list_recurring_transactions(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<RecurringTransaction>, String> {
    sqlx::query_as::<_, RecurringTransaction>(
        r#"SELECT rt.id, rt.profile_id, rt.kind, rt.account_id,
                  fa.name AS account_name,
                  rt.source_id,
                  src.name AS source_name,
                  rt.category_id,
                  cat.name AS category_name,
                  rt.amount, rt.description, rt.vendor, rt.payment_method, rt.notes,
                  rt.frequency, rt.day_of_month, rt.next_due_date, rt.is_active, rt.last_applied_date
           FROM recurring_transactions rt
           LEFT JOIN financial_accounts fa ON rt.account_id = fa.id
           LEFT JOIN income_sources src ON rt.source_id = src.id
           LEFT JOIN expense_categories cat ON rt.category_id = cat.id
           WHERE rt.profile_id = ?
           ORDER BY rt.next_due_date ASC"#,
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_recurring_transaction(
    pool: &SqlitePool,
    payload: CreateRecurringPayload,
) -> Result<RecurringTransaction, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"INSERT INTO recurring_transactions
           (id, profile_id, kind, account_id, source_id, category_id, amount, description, vendor, payment_method, notes, frequency, day_of_month, next_due_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"#,
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.kind)
    .bind(&payload.account_id)
    .bind(&payload.source_id)
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&payload.frequency)
    .bind(payload.day_of_month)
    .bind(&payload.next_due_date)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_recurring_by_id(pool, &id).await
}

pub async fn update_recurring_transaction(
    pool: &SqlitePool,
    id: &str,
    payload: CreateRecurringPayload,
) -> Result<RecurringTransaction, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"UPDATE recurring_transactions SET
           kind = ?, account_id = ?, source_id = ?, category_id = ?, amount = ?, description = ?,
           vendor = ?, payment_method = ?, notes = ?, frequency = ?, day_of_month = ?,
           next_due_date = ?, updated_at = ? WHERE id = ?"#,
    )
    .bind(&payload.kind)
    .bind(&payload.account_id)
    .bind(&payload.source_id)
    .bind(&payload.category_id)
    .bind(payload.amount)
    .bind(&payload.description)
    .bind(&payload.vendor)
    .bind(&payload.payment_method)
    .bind(&payload.notes)
    .bind(&payload.frequency)
    .bind(payload.day_of_month)
    .bind(&payload.next_due_date)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_recurring_by_id(pool, id).await
}

pub async fn toggle_recurring_active(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE recurring_transactions SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_recurring_transaction(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM recurring_transactions WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn apply_due_recurring(
    pool: &SqlitePool,
    profile_id: &str,
    reference_date: &str,
) -> Result<Vec<AppliedRecurring>, String> {
    let due: Vec<(String, String, Option<String>, Option<String>, Option<String>, f64, Option<String>, Option<String>, Option<String>, Option<String>, String, Option<i64>)> = sqlx::query_as(
        r#"SELECT id, kind, account_id, source_id, category_id, amount, description, vendor, payment_method, notes, frequency, day_of_month
           FROM recurring_transactions
           WHERE profile_id = ? AND is_active = 1
             AND next_due_date <= ?
             AND (last_applied_date IS NULL OR last_applied_date < ?)"#,
    )
    .bind(profile_id)
    .bind(reference_date)
    .bind(reference_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let mut applied = Vec::new();

    for (
        id,
        kind,
        account_id,
        source_id,
        category_id,
        amount,
        description,
        vendor,
        payment_method,
        notes,
        frequency,
        day_of_month,
    ) in due
    {
        let period_id = get_or_create_period(pool, profile_id, reference_date).await?;
        let entry_id = Uuid::new_v4().to_string();
        let desc = description
            .clone()
            .unwrap_or_else(|| "Transacción recurrente".to_string());

        if kind == "income" {
            sqlx::query(
                "INSERT INTO income_entries (id, profile_id, period_id, account_id, source_id, amount, transaction_date, description, notes, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?, ?)",
            )
            .bind(&entry_id)
            .bind(profile_id)
            .bind(&period_id)
            .bind(&account_id)
            .bind(&source_id)
            .bind(amount)
            .bind(reference_date)
            .bind(&description)
            .bind(&notes)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
            apply_account_balance_delta(pool, account_id.as_deref(), amount).await?;
        } else {
            sqlx::query(
                "INSERT INTO expense_entries (id, profile_id, period_id, account_id, category_id, amount, transaction_date, description, vendor, payment_method, notes, is_installment_derived, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'recurring', ?, ?)",
            )
            .bind(&entry_id)
            .bind(profile_id)
            .bind(&period_id)
            .bind(&account_id)
            .bind(&category_id)
            .bind(amount)
            .bind(reference_date)
            .bind(&description)
            .bind(&vendor)
            .bind(&payment_method)
            .bind(&notes)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
            apply_account_balance_delta(pool, account_id.as_deref(), -amount).await?;
        }

        let next_date = advance_date(reference_date, &frequency, day_of_month);
        sqlx::query(
            "UPDATE recurring_transactions SET last_applied_date = ?, next_due_date = ?, updated_at = ? WHERE id = ?",
        )
        .bind(reference_date)
        .bind(&next_date)
        .bind(&now)
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        applied.push(AppliedRecurring {
            id,
            description: desc,
            amount,
            kind,
        });
    }

    Ok(applied)
}

fn advance_date(date: &str, frequency: &str, day_of_month: Option<i64>) -> String {
    let parsed =
        NaiveDate::parse_from_str(date, "%Y-%m-%d").unwrap_or_else(|_| Utc::now().date_naive());
    let next = match frequency {
        "weekly" => parsed + Duration::weeks(1),
        "biweekly" => parsed + Duration::weeks(2),
        "yearly" => {
            let y = parsed.year() + 1;
            NaiveDate::from_ymd_opt(y, parsed.month(), parsed.day()).unwrap_or(parsed)
        }
        _ => {
            let total_months = parsed.month() as i32;
            let new_month = (total_months % 12) + 1;
            let new_year = if new_month == 1 {
                parsed.year() + 1
            } else {
                parsed.year()
            };
            let day = day_of_month.unwrap_or(parsed.day() as i64) as u32;
            let max_day = days_in_month(new_year, new_month as u32);
            NaiveDate::from_ymd_opt(new_year, new_month as u32, day.min(max_day)).unwrap_or(parsed)
        }
    };
    next.format("%Y-%m-%d").to_string()
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

async fn get_recurring_by_id(pool: &SqlitePool, id: &str) -> Result<RecurringTransaction, String> {
    sqlx::query_as::<_, RecurringTransaction>(
        r#"SELECT rt.id, rt.profile_id, rt.kind, rt.account_id,
                  fa.name AS account_name,
                  rt.source_id,
                  src.name AS source_name, rt.category_id,
                  cat.name AS category_name,
                  rt.amount, rt.description, rt.vendor, rt.payment_method, rt.notes,
                  rt.frequency, rt.day_of_month, rt.next_due_date, rt.is_active, rt.last_applied_date
           FROM recurring_transactions rt
           LEFT JOIN financial_accounts fa ON rt.account_id = fa.id
           LEFT JOIN income_sources src ON rt.source_id = src.id
           LEFT JOIN expense_categories cat ON rt.category_id = cat.id
           WHERE rt.id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
