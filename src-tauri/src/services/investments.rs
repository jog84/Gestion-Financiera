use chrono::{Duration, Local, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::services::accounts::apply_account_balance_delta;
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
    pub transaction_kind: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub amount_invested: f64,
    pub current_value: Option<f64>,
    pub cash_amount_ars: Option<f64>,
    pub realized_cost_ars: Option<f64>,
    pub realized_gain_ars: Option<f64>,
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
    pub transaction_kind: Option<String>,
    pub account_id: Option<String>,
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
    "SELECT ie.id, ie.profile_id, ie.period_id, ie.name, ie.ticker, ie.transaction_kind, ie.account_id,
            fa.name AS account_name,
            ie.amount_invested, ie.current_value, ie.cash_amount_ars, ie.realized_cost_ars, ie.realized_gain_ars,
            ie.transaction_date, ie.notes, ie.quantity, ie.price_ars, ie.dolar_ccl, ie.current_price_ars,
            COALESCE(instrument_type, 'cedear') as instrument_type,
            tna, plazo_dias, fecha_vencimiento
     FROM investment_entries ie
     LEFT JOIN financial_accounts fa ON ie.account_id = fa.id
     WHERE ie.id = ?";

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
        "SELECT ie.id, ie.profile_id, ie.period_id, ie.name, ie.ticker, ie.transaction_kind, ie.account_id,
                fa.name AS account_name,
                ie.amount_invested, ie.current_value, ie.cash_amount_ars, ie.realized_cost_ars, ie.realized_gain_ars,
                ie.transaction_date, ie.notes, ie.quantity, ie.price_ars, ie.dolar_ccl, ie.current_price_ars,
                COALESCE(instrument_type, 'cedear') as instrument_type,
                tna, plazo_dias, fecha_vencimiento
         FROM investment_entries ie
         LEFT JOIN financial_accounts fa ON ie.account_id = fa.id
         WHERE ie.profile_id = ?
         ORDER BY ie.transaction_date DESC, ie.created_at DESC",
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
    let period_id =
        get_or_create_period(pool, &payload.profile_id, &payload.transaction_date).await?;
    let instrument_type = payload
        .instrument_type
        .unwrap_or_else(|| "cedear".to_string());
    let transaction_kind = payload
        .transaction_kind
        .unwrap_or_else(|| "buy".to_string());
    let cash_amount_ars = compute_cash_amount_ars(
        &instrument_type,
        payload.quantity,
        payload.price_ars,
        payload.dolar_ccl,
        payload.amount_invested,
        payload.current_value,
    );

    let (amount_invested, current_value, realized_cost_ars, realized_gain_ars) =
        if transaction_kind == "sell" {
            let (available_qty, available_cost_ars) = compute_open_position_state(
                pool,
                &payload.profile_id,
                payload.ticker.as_deref().unwrap_or(&payload.name),
                payload.ticker.as_deref(),
            )
            .await?;

            let sell_qty = payload.quantity.unwrap_or(0.0);
            if sell_qty <= 0.0 {
                return Err("La venta requiere una cantidad mayor a cero".to_string());
            }
            if available_qty + 1e-9 < sell_qty {
                return Err(format!(
                    "No hay cantidad suficiente para vender. Disponible: {:.4}",
                    available_qty
                ));
            }
            if payload.account_id.is_none() {
                return Err(
                    "La venta debe acreditarse en una cuenta para reflejar la liquidez".to_string(),
                );
            }

            let avg_cost_ars = if available_qty > 0.0 {
                available_cost_ars / available_qty
            } else {
                0.0
            };
            let realized_cost = round2(avg_cost_ars * sell_qty);
            let proceeds = cash_amount_ars.unwrap_or(0.0);
            let realized_gain = round2(proceeds - realized_cost);

            (
                realized_cost,
                Some(proceeds),
                Some(realized_cost),
                Some(realized_gain),
            )
        } else {
            (payload.amount_invested, payload.current_value, None, None)
        };

    sqlx::query(
        "INSERT INTO investment_entries
            (id, profile_id, period_id, name, ticker, transaction_kind, account_id, amount_invested, current_value,
             cash_amount_ars, realized_cost_ars, realized_gain_ars,
             transaction_date, notes, origin, quantity, price_ars, dolar_ccl, current_price_ars,
             instrument_type, tna, plazo_dias, fecha_vencimiento, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.name)
    .bind(&payload.ticker)
    .bind(&transaction_kind)
    .bind(&payload.account_id)
    .bind(amount_invested)
    .bind(current_value)
    .bind(cash_amount_ars)
    .bind(realized_cost_ars)
    .bind(realized_gain_ars)
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

    if let Some(account_id) = payload.account_id.as_deref() {
        let delta = if transaction_kind == "sell" {
            cash_amount_ars.unwrap_or(0.0)
        } else {
            -cash_amount_ars.unwrap_or(0.0)
        };
        apply_account_balance_delta(pool, Some(account_id), delta).await?;
    }

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
    let entry = get_investment_by_id(pool, id).await?;

    if entry.transaction_kind == "buy" && would_break_position_sequence(pool, &entry).await? {
        return Err(
            "No se puede eliminar esta compra porque dejaría ventas posteriores sin respaldo"
                .to_string(),
        );
    }

    sqlx::query("DELETE FROM investment_entries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(account_id) = entry.account_id.as_deref() {
        let cash = entry.cash_amount_ars.unwrap_or(0.0);
        let delta = if entry.transaction_kind == "sell" {
            -cash
        } else {
            cash
        };
        apply_account_balance_delta(pool, Some(account_id), delta).await?;
    }
    Ok(())
}

async fn get_investment_by_id(pool: &SqlitePool, id: &str) -> Result<InvestmentEntry, String> {
    sqlx::query_as::<_, InvestmentEntry>(INVESTMENT_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

pub async fn compute_open_positions(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<Vec<OpenInvestmentPosition>, String> {
    let investments = list_investments(pool, profile_id).await?;
    Ok(aggregate_open_positions(&investments))
}

#[derive(Debug, Clone)]
pub struct OpenInvestmentPosition {
    pub key: String,
    pub current_value_ars: f64,
}

fn aggregate_open_positions(entries: &[InvestmentEntry]) -> Vec<OpenInvestmentPosition> {
    let mut grouped: std::collections::BTreeMap<String, Vec<&InvestmentEntry>> =
        std::collections::BTreeMap::new();
    for entry in entries {
        grouped
            .entry(investment_key(entry.ticker.as_deref(), &entry.name))
            .or_default()
            .push(entry);
    }

    let mut positions = Vec::new();

    for (key, rows) in grouped {
        let mut ordered = rows;
        ordered.sort_by(|a, b| {
            a.transaction_date.cmp(&b.transaction_date).then_with(|| {
                if a.transaction_kind == b.transaction_kind {
                    std::cmp::Ordering::Equal
                } else if a.transaction_kind == "buy" {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                }
            })
        });

        let mut remaining_qty = 0.0_f64;
        let mut remaining_cost_ars = 0.0_f64;
        let mut current_price_ars: Option<f64> = None;

        for row in ordered {
            let qty = row.quantity.unwrap_or(0.0);
            if row.transaction_kind == "sell" {
                if row.realized_cost_ars.unwrap_or(0.0) > 0.0 {
                    remaining_cost_ars =
                        (remaining_cost_ars - row.realized_cost_ars.unwrap_or(0.0)).max(0.0);
                }
                remaining_qty = (remaining_qty - qty).max(0.0);
            } else {
                remaining_qty += qty;
                remaining_cost_ars += row.cash_amount_ars.unwrap_or(0.0);
                if row.current_price_ars.unwrap_or(0.0) > 0.0 {
                    current_price_ars = row.current_price_ars;
                }
            }
        }

        let current_value_ars = if remaining_qty > 0.0 {
            round2(current_price_ars.unwrap_or(0.0) * remaining_qty)
        } else {
            0.0
        };

        if current_value_ars > 0.0 || remaining_cost_ars > 0.0 {
            positions.push(OpenInvestmentPosition {
                key,
                current_value_ars,
            });
        }
    }

    positions
}

async fn compute_open_position_state(
    pool: &SqlitePool,
    profile_id: &str,
    fallback_name: &str,
    ticker: Option<&str>,
) -> Result<(f64, f64), String> {
    let investments = list_investments(pool, profile_id).await?;
    let target_key = investment_key(ticker, fallback_name);
    let mut relevant: Vec<InvestmentEntry> = investments
        .into_iter()
        .filter(|entry| investment_key(entry.ticker.as_deref(), &entry.name) == target_key)
        .collect();

    relevant.sort_by(|a, b| {
        a.transaction_date.cmp(&b.transaction_date).then_with(|| {
            if a.transaction_kind == b.transaction_kind {
                std::cmp::Ordering::Equal
            } else if a.transaction_kind == "buy" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        })
    });

    let mut quantity = 0.0;
    let mut cost_basis_ars = 0.0;

    for entry in relevant {
        if entry.transaction_kind == "sell" {
            quantity = (quantity - entry.quantity.unwrap_or(0.0)).max(0.0);
            cost_basis_ars = (cost_basis_ars - entry.realized_cost_ars.unwrap_or(0.0)).max(0.0);
        } else {
            quantity += entry.quantity.unwrap_or(0.0);
            cost_basis_ars += entry.cash_amount_ars.unwrap_or(0.0);
        }
    }

    Ok((quantity, cost_basis_ars))
}

async fn would_break_position_sequence(
    pool: &SqlitePool,
    entry: &InvestmentEntry,
) -> Result<bool, String> {
    let mut relevant = list_investments(pool, &entry.profile_id)
        .await?
        .into_iter()
        .filter(|item| {
            investment_key(item.ticker.as_deref(), &item.name)
                == investment_key(entry.ticker.as_deref(), &entry.name)
                && item.id != entry.id
        })
        .collect::<Vec<_>>();

    relevant.sort_by(|a, b| {
        a.transaction_date.cmp(&b.transaction_date).then_with(|| {
            if a.transaction_kind == b.transaction_kind {
                std::cmp::Ordering::Equal
            } else if a.transaction_kind == "buy" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        })
    });

    let mut quantity = 0.0_f64;
    for item in relevant {
        if item.transaction_kind == "sell" {
            let sell_qty = item.quantity.unwrap_or(0.0);
            if quantity + 1e-9 < sell_qty {
                return Ok(true);
            }
            quantity -= sell_qty;
        } else {
            quantity += item.quantity.unwrap_or(0.0);
        }
    }

    Ok(false)
}

fn compute_cash_amount_ars(
    instrument_type: &str,
    quantity: Option<f64>,
    price_ars: Option<f64>,
    dolar_ccl: Option<f64>,
    amount_invested: f64,
    current_value: Option<f64>,
) -> Option<f64> {
    let qty = quantity.unwrap_or(0.0);
    let price = price_ars.unwrap_or(0.0);
    let ccl = dolar_ccl.unwrap_or(0.0);

    let result = match instrument_type {
        "plazo_fijo" => price,
        "fci" => qty * price,
        "bono" => {
            if ccl > 0.0 {
                qty * (price / 100.0) * ccl
            } else {
                0.0
            }
        }
        "crypto" => {
            if ccl > 0.0 {
                qty * price * ccl
            } else {
                0.0
            }
        }
        "otro" => price.max(current_value.unwrap_or(0.0)).max(amount_invested),
        _ => qty * price,
    };

    if result > 0.0 {
        Some(round2(result))
    } else {
        None
    }
}

fn investment_key(ticker: Option<&str>, name: &str) -> String {
    ticker.unwrap_or(name).trim().to_uppercase()
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}
