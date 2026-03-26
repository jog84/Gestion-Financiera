use chrono::{Duration, Local, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::services::periods::get_or_create_period;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PortfolioSnapshot {
    pub id: String,
    pub profile_id: String,
    pub snapshot_date: String,
    pub total_value_ars: f64,
    pub total_value_usd: f64,
    pub total_invested_ars: f64,
    pub ccl: f64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct InvestmentEntry {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub name: String,
    pub ticker: Option<String>,
    pub amount_invested: f64,
    pub current_value: Option<f64>,
    pub transaction_date: String,
    pub notes: Option<String>,
    pub quantity: Option<f64>,
    pub price_ars: Option<f64>,
    pub dolar_ccl: Option<f64>,
    pub current_price_ars: Option<f64>,
    pub instrument_type: String,
    pub tna: Option<f64>,
    pub plazo_dias: Option<i64>,
    pub fecha_vencimiento: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvestmentPayload {
    pub profile_id: String,
    pub name: String,
    pub ticker: Option<String>,
    pub amount_invested: f64,
    pub current_value: Option<f64>,
    pub transaction_date: String,
    pub notes: Option<String>,
    pub quantity: Option<f64>,
    pub price_ars: Option<f64>,
    pub dolar_ccl: Option<f64>,
    pub current_price_ars: Option<f64>,
    pub instrument_type: Option<String>,
    pub tna: Option<f64>,
    pub plazo_dias: Option<i64>,
    pub fecha_vencimiento: Option<String>,
}

const INVESTMENT_SELECT_BY_ID: &str =
    "SELECT id, profile_id, period_id, name, ticker, amount_invested, current_value,
            transaction_date, notes, quantity, price_ars, dolar_ccl, current_price_ars,
            COALESCE(instrument_type, 'cedear') as instrument_type,
            tna, plazo_dias, fecha_vencimiento
     FROM investment_entries WHERE id = ?";

pub async fn save_portfolio_snapshot(
    pool: &SqlitePool,
    profile_id: &str,
    total_value_ars: f64,
    total_value_usd: f64,
    total_invested_ars: f64,
    ccl: f64,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let today = Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO portfolio_snapshots (id, profile_id, snapshot_date, total_value_ars, total_value_usd, total_invested_ars, ccl)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, snapshot_date) DO UPDATE SET
             total_value_ars = excluded.total_value_ars,
             total_value_usd = excluded.total_value_usd,
             total_invested_ars = excluded.total_invested_ars,
             ccl = excluded.ccl",
    )
    .bind(&id)
    .bind(profile_id)
    .bind(&today)
    .bind(total_value_ars)
    .bind(total_value_usd)
    .bind(total_invested_ars)
    .bind(ccl)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn list_portfolio_snapshots(
    pool: &SqlitePool,
    profile_id: &str,
    limit_days: Option<i64>,
) -> Result<Vec<PortfolioSnapshot>, String> {
    let days = limit_days.unwrap_or(730);
    let cutoff = Local::now()
        .checked_sub_signed(Duration::days(days))
        .unwrap_or_else(Local::now)
        .format("%Y-%m-%d")
        .to_string();

    sqlx::query_as::<_, PortfolioSnapshot>(
        "SELECT id, profile_id, snapshot_date, total_value_ars, total_value_usd, total_invested_ars, ccl
         FROM portfolio_snapshots
         WHERE profile_id = ? AND snapshot_date >= ?
         ORDER BY snapshot_date ASC",
    )
    .bind(profile_id)
    .bind(&cutoff)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn list_investments(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<InvestmentEntry>, String> {
    sqlx::query_as::<_, InvestmentEntry>(
        "SELECT id, profile_id, period_id, name, ticker, amount_invested, current_value,
                transaction_date, notes, quantity, price_ars, dolar_ccl, current_price_ars,
                COALESCE(instrument_type, 'cedear') as instrument_type,
                tna, plazo_dias, fecha_vencimiento
         FROM investment_entries WHERE profile_id = ? ORDER BY transaction_date DESC",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_investment(
    pool: &SqlitePool,
    payload: CreateInvestmentPayload,
) -> Result<InvestmentEntry, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id = get_or_create_period(pool, &payload.profile_id, &payload.transaction_date).await?;
    let instrument_type = payload.instrument_type.unwrap_or_else(|| "cedear".to_string());

    sqlx::query(
        "INSERT INTO investment_entries
            (id, profile_id, period_id, name, ticker, amount_invested, current_value,
             transaction_date, notes, origin, quantity, price_ars, dolar_ccl, current_price_ars,
             instrument_type, tna, plazo_dias, fecha_vencimiento, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.name)
    .bind(&payload.ticker)
    .bind(payload.amount_invested)
    .bind(payload.current_value)
    .bind(&payload.transaction_date)
    .bind(&payload.notes)
    .bind(payload.quantity)
    .bind(payload.price_ars)
    .bind(payload.dolar_ccl)
    .bind(payload.current_price_ars)
    .bind(&instrument_type)
    .bind(payload.tna)
    .bind(payload.plazo_dias)
    .bind(&payload.fecha_vencimiento)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_investment_by_id(pool, &id).await
}

pub async fn update_investment_value(
    pool: &SqlitePool,
    id: &str,
    current_value: f64,
    current_price_ars: Option<f64>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE investment_entries SET current_value = ?, current_price_ars = ?, updated_at = ? WHERE id = ?",
    )
    .bind(current_value)
    .bind(current_price_ars)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_investment(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM investment_entries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn get_investment_by_id(pool: &SqlitePool, id: &str) -> Result<InvestmentEntry, String> {
    sqlx::query_as::<_, InvestmentEntry>(INVESTMENT_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}
