use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::incomes::get_or_create_period;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InstallmentEntry {
    pub id: String,
    pub profile_id: String,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub description: String,
    pub total_amount: f64,
    pub installment_count: i64,
    pub start_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInstallmentPayload {
    pub profile_id: String,
    pub description: String,
    pub total_amount: f64,
    pub installment_count: i64,
    pub start_date: String,
    pub notes: Option<String>,
}

fn add_months(date: NaiveDate, months: i32) -> NaiveDate {
    let total_months = date.month() as i32 - 1 + months;
    let year = date.year() + total_months / 12;
    let month = (total_months % 12 + 1) as u32;
    let day = date.day().min(days_in_month(year, month));
    NaiveDate::from_ymd_opt(year, month, day).unwrap_or(date)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) { 29 } else { 28 },
        _ => 30,
    }
}

#[tauri::command]
pub async fn get_installments(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<InstallmentEntry>, String> {
    sqlx::query_as::<_, InstallmentEntry>(
        r#"SELECT ie.id, ie.profile_id, ie.provider_id,
                  ip.name AS provider_name,
                  ie.description, ie.total_amount, ie.installment_count,
                  ie.start_date, ie.notes
           FROM installment_entries ie
           LEFT JOIN installment_providers ip ON ie.provider_id = ip.id
           WHERE ie.profile_id = ?
           ORDER BY ie.start_date DESC"#,
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_installment(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateInstallmentPayload,
) -> Result<InstallmentEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let monthly_amount = payload.total_amount / payload.installment_count as f64;

    sqlx::query(
        "INSERT INTO installment_entries (id, profile_id, description, total_amount, installment_count, start_date, notes, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.description)
    .bind(payload.total_amount)
    .bind(payload.installment_count)
    .bind(&payload.start_date)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Generate derived expense entries for each installment
    let start = NaiveDate::parse_from_str(&payload.start_date, "%Y-%m-%d")
        .map_err(|_| "invalid start_date format")?;

    for i in 0..payload.installment_count as i32 {
        let expense_date = add_months(start, i);
        let date_str = expense_date.format("%Y-%m-%d").to_string();
        let period_id = get_or_create_period(pool.inner(), &payload.profile_id, &date_str).await?;
        let expense_id = Uuid::new_v4().to_string();
        let description = format!("{} (cuota {}/{})", payload.description, i + 1, payload.installment_count);

        sqlx::query(
            "INSERT INTO expense_entries (id, profile_id, period_id, amount, transaction_date, description, is_installment_derived, origin, external_ref, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, 'installment', ?, ?, ?)",
        )
        .bind(&expense_id)
        .bind(&payload.profile_id)
        .bind(&period_id)
        .bind(monthly_amount)
        .bind(&date_str)
        .bind(&description)
        .bind(&id) // external_ref = installment id
        .bind(&now)
        .bind(&now)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query_as::<_, InstallmentEntry>(
        r#"SELECT ie.id, ie.profile_id, ie.provider_id,
                  ip.name AS provider_name,
                  ie.description, ie.total_amount, ie.installment_count,
                  ie.start_date, ie.notes
           FROM installment_entries ie
           LEFT JOIN installment_providers ip ON ie.provider_id = ip.id
           WHERE ie.id = ?"#,
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_installment(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    // Also delete derived expense entries
    sqlx::query("DELETE FROM expense_entries WHERE external_ref = ? AND is_installment_derived = 1")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM installment_entries WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
