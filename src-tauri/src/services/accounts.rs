use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct FinancialAccount {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub currency_code: String,
    pub current_balance: f64,
    pub is_liquid: bool,
    pub include_in_net_worth: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFinancialAccountPayload {
    pub profile_id: String,
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub currency_code: String,
    pub current_balance: f64,
    pub is_liquid: bool,
    pub include_in_net_worth: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFinancialAccountPayload {
    pub name: String,
    pub institution: Option<String>,
    pub account_type: String,
    pub currency_code: String,
    pub current_balance: f64,
    pub is_liquid: bool,
    pub include_in_net_worth: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CashOverview {
    pub total_balance: f64,
    pub liquid_balance: f64,
    pub non_liquid_balance: f64,
    pub account_count: i64,
    pub liquid_account_count: i64,
}

pub async fn list_financial_accounts(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<FinancialAccount>, String> {
    sqlx::query_as::<_, FinancialAccount>(
        "SELECT id, profile_id, name, institution, account_type, currency_code, current_balance, is_liquid, include_in_net_worth, notes
         FROM financial_accounts
         WHERE profile_id = ?
         ORDER BY is_liquid DESC, current_balance DESC, name ASC",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_financial_account(
    pool: &SqlitePool,
    payload: CreateFinancialAccountPayload,
) -> Result<FinancialAccount, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO financial_accounts
         (id, profile_id, name, institution, account_type, currency_code, current_balance, is_liquid, include_in_net_worth, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.name)
    .bind(&payload.institution)
    .bind(&payload.account_type)
    .bind(&payload.currency_code)
    .bind(payload.current_balance)
    .bind(payload.is_liquid)
    .bind(payload.include_in_net_worth)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_financial_account_by_id(pool, &id).await
}

pub async fn update_financial_account(
    pool: &SqlitePool,
    id: &str,
    payload: UpdateFinancialAccountPayload,
) -> Result<FinancialAccount, String> {
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE financial_accounts
         SET name = ?, institution = ?, account_type = ?, currency_code = ?, current_balance = ?, is_liquid = ?, include_in_net_worth = ?, notes = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&payload.name)
    .bind(&payload.institution)
    .bind(&payload.account_type)
    .bind(&payload.currency_code)
    .bind(payload.current_balance)
    .bind(payload.is_liquid)
    .bind(payload.include_in_net_worth)
    .bind(&payload.notes)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_financial_account_by_id(pool, id).await
}

pub async fn delete_financial_account(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM financial_accounts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_cash_overview(pool: &SqlitePool, profile_id: &str) -> Result<CashOverview, String> {
    let (total_balance, liquid_balance, account_count, liquid_account_count): (f64, f64, i64, i64) = sqlx::query_as(
        "SELECT
            COALESCE(SUM(CASE WHEN include_in_net_worth = 1 THEN current_balance ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN include_in_net_worth = 1 AND is_liquid = 1 THEN current_balance ELSE 0 END), 0.0),
            COUNT(*),
            COALESCE(SUM(CASE WHEN is_liquid = 1 THEN 1 ELSE 0 END), 0)
         FROM financial_accounts
         WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(CashOverview {
        total_balance,
        liquid_balance,
        non_liquid_balance: total_balance - liquid_balance,
        account_count,
        liquid_account_count,
    })
}

pub async fn apply_account_balance_delta(
    pool: &SqlitePool,
    account_id: Option<&str>,
    delta: f64,
) -> Result<(), String> {
    if let Some(account_id) = account_id {
        sqlx::query(
            "UPDATE financial_accounts
             SET current_balance = current_balance + ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(delta)
        .bind(Utc::now().to_rfc3339())
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn get_financial_account_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<FinancialAccount, String> {
    sqlx::query_as::<_, FinancialAccount>(
        "SELECT id, profile_id, name, institution, account_type, currency_code, current_balance, is_liquid, include_in_net_worth, notes
         FROM financial_accounts
         WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
