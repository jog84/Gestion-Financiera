use chrono::{Duration, NaiveDate, Utc};
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct FinancialTransfer {
    pub id: String,
    pub profile_id: String,
    pub from_account_id: String,
    pub from_account_name: String,
    pub to_account_id: String,
    pub to_account_name: String,
    pub amount: f64,
    pub transfer_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFinancialTransferPayload {
    pub profile_id: String,
    pub from_account_id: String,
    pub to_account_id: String,
    pub amount: f64,
    pub transfer_date: String,
    pub description: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountLedgerEntry {
    pub id: String,
    pub account_id: String,
    pub account_name: String,
    pub entry_type: String,
    pub direction: String,
    pub amount: f64,
    pub entry_date: String,
    pub description: Option<String>,
    pub counterparty: Option<String>,
    pub origin: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountBalancePoint {
    pub date: String,
    pub balance: f64,
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
    let today = Utc::now().date_naive().to_string();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

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
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if payload.current_balance != 0.0 {
        create_balance_adjustment_tx(
            &mut tx,
            &payload.profile_id,
            &id,
            payload.current_balance,
            &today,
            "opening_balance",
            Some("Saldo inicial de la cuenta"),
        )
        .await?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    get_financial_account_by_id(pool, &id).await
}

pub async fn update_financial_account(
    pool: &SqlitePool,
    id: &str,
    payload: UpdateFinancialAccountPayload,
) -> Result<FinancialAccount, String> {
    let now = Utc::now().to_rfc3339();
    let previous: (String, f64) =
        sqlx::query_as("SELECT profile_id, current_balance FROM financial_accounts WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

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
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let delta = payload.current_balance - previous.1;
    if delta.abs() > f64::EPSILON {
        create_balance_adjustment_tx(
            &mut tx,
            &previous.0,
            id,
            delta,
            &Utc::now().date_naive().to_string(),
            "manual_adjustment",
            Some("Ajuste manual de saldo"),
        )
        .await?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

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

pub async fn get_cash_overview(
    pool: &SqlitePool,
    profile_id: &str,
) -> Result<CashOverview, String> {
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

pub async fn list_financial_transfers(
    pool: &SqlitePool,
    profile_id: &str,
    limit: i64,
) -> Result<Vec<FinancialTransfer>, String> {
    let safe_limit = limit.clamp(1, 200);

    sqlx::query_as::<_, FinancialTransfer>(
        r#"SELECT
            ft.id,
            ft.profile_id,
            ft.from_account_id,
            fa_from.name AS from_account_name,
            ft.to_account_id,
            fa_to.name AS to_account_name,
            ft.amount,
            ft.transfer_date,
            ft.description,
            ft.notes
        FROM financial_transfers ft
        INNER JOIN financial_accounts fa_from ON fa_from.id = ft.from_account_id
        INNER JOIN financial_accounts fa_to ON fa_to.id = ft.to_account_id
        WHERE ft.profile_id = ?
        ORDER BY ft.transfer_date DESC, ft.created_at DESC
        LIMIT ?"#,
    )
    .bind(profile_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn list_account_ledger(
    pool: &SqlitePool,
    profile_id: &str,
    account_id: &str,
    limit: i64,
) -> Result<Vec<AccountLedgerEntry>, String> {
    let safe_limit = limit.clamp(1, 200);
    let account_name = get_financial_account_by_id(pool, account_id).await?.name;

    let incomes: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, amount, transaction_date, description, origin
         FROM income_entries
         WHERE profile_id = ? AND account_id = ?
         ORDER BY transaction_date DESC, created_at DESC
         LIMIT ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let expenses: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, amount, transaction_date, description, origin
         FROM expense_entries
         WHERE profile_id = ? AND account_id = ?
         ORDER BY transaction_date DESC, created_at DESC
         LIMIT ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let outgoing: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ft.id, ft.amount, ft.transfer_date, ft.description, fa.name
           FROM financial_transfers ft
           INNER JOIN financial_accounts fa ON fa.id = ft.to_account_id
           WHERE ft.profile_id = ? AND ft.from_account_id = ?
           ORDER BY ft.transfer_date DESC, ft.created_at DESC
           LIMIT ?"#,
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let incoming: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ft.id, ft.amount, ft.transfer_date, ft.description, fa.name
           FROM financial_transfers ft
           INNER JOIN financial_accounts fa ON fa.id = ft.from_account_id
           WHERE ft.profile_id = ? AND ft.to_account_id = ?
           ORDER BY ft.transfer_date DESC, ft.created_at DESC
           LIMIT ?"#,
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let adjustments: Vec<(String, f64, String, Option<String>, String)> = sqlx::query_as(
        "SELECT id, amount, adjustment_date, notes, reason
         FROM financial_account_balance_adjustments
         WHERE profile_id = ? AND account_id = ?
         ORDER BY adjustment_date DESC, created_at DESC
         LIMIT ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(safe_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut entries: Vec<AccountLedgerEntry> =
        incomes
            .into_iter()
            .map(
                |(id, amount, entry_date, description, origin)| AccountLedgerEntry {
                    id,
                    account_id: account_id.to_string(),
                    account_name: account_name.clone(),
                    entry_type: "income".to_string(),
                    direction: "in".to_string(),
                    amount,
                    entry_date,
                    description,
                    counterparty: None,
                    origin,
                },
            )
            .chain(
                expenses
                    .into_iter()
                    .map(
                        |(id, amount, entry_date, description, origin)| AccountLedgerEntry {
                            id,
                            account_id: account_id.to_string(),
                            account_name: account_name.clone(),
                            entry_type: "expense".to_string(),
                            direction: "out".to_string(),
                            amount,
                            entry_date,
                            description,
                            counterparty: None,
                            origin,
                        },
                    ),
            )
            .chain(outgoing.into_iter().map(
                |(id, amount, entry_date, description, counterparty)| AccountLedgerEntry {
                    id,
                    account_id: account_id.to_string(),
                    account_name: account_name.clone(),
                    entry_type: "transfer".to_string(),
                    direction: "out".to_string(),
                    amount,
                    entry_date,
                    description,
                    counterparty,
                    origin: Some("transfer".to_string()),
                },
            ))
            .chain(incoming.into_iter().map(
                |(id, amount, entry_date, description, counterparty)| AccountLedgerEntry {
                    id,
                    account_id: account_id.to_string(),
                    account_name: account_name.clone(),
                    entry_type: "transfer".to_string(),
                    direction: "in".to_string(),
                    amount,
                    entry_date,
                    description,
                    counterparty,
                    origin: Some("transfer".to_string()),
                },
            ))
            .chain(
                adjustments
                    .into_iter()
                    .map(
                        |(id, amount, entry_date, _notes, reason)| AccountLedgerEntry {
                            id,
                            account_id: account_id.to_string(),
                            account_name: account_name.clone(),
                            entry_type: "adjustment".to_string(),
                            direction: if amount >= 0.0 {
                                "in".to_string()
                            } else {
                                "out".to_string()
                            },
                            amount: amount.abs(),
                            entry_date,
                            description: Some(match reason.as_str() {
                                "opening_balance" => "Saldo inicial".to_string(),
                                "manual_adjustment" => "Ajuste manual".to_string(),
                                _ => "Ajuste".to_string(),
                            }),
                            counterparty: None,
                            origin: Some(reason),
                        },
                    ),
            )
            .collect();

    entries.sort_by(|a, b| {
        b.entry_date
            .cmp(&a.entry_date)
            .then_with(|| b.id.cmp(&a.id))
    });
    entries.truncate(safe_limit as usize);
    Ok(entries)
}

pub async fn get_account_balance_history(
    pool: &SqlitePool,
    profile_id: &str,
    account_id: &str,
    days: i64,
) -> Result<Vec<AccountBalancePoint>, String> {
    let safe_days = days.clamp(7, 365);
    let account = get_financial_account_by_id(pool, account_id).await?;
    if account.profile_id != profile_id {
        return Err("La cuenta no pertenece al perfil activo".to_string());
    }

    let end_date = Utc::now().date_naive();
    let start_date = end_date - Duration::days(safe_days - 1);
    let start = start_date.to_string();

    let income_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT transaction_date, amount
         FROM income_entries
         WHERE profile_id = ? AND account_id = ? AND transaction_date >= ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(&start)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let expense_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT transaction_date, amount
         FROM expense_entries
         WHERE profile_id = ? AND account_id = ? AND transaction_date >= ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(&start)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let transfer_in_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT transfer_date, amount
         FROM financial_transfers
         WHERE profile_id = ? AND to_account_id = ? AND transfer_date >= ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(&start)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let transfer_out_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT transfer_date, amount
         FROM financial_transfers
         WHERE profile_id = ? AND from_account_id = ? AND transfer_date >= ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(&start)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let adjustment_rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT adjustment_date, amount
         FROM financial_account_balance_adjustments
         WHERE profile_id = ? AND account_id = ? AND adjustment_date >= ?",
    )
    .bind(profile_id)
    .bind(account_id)
    .bind(&start)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut deltas = std::collections::BTreeMap::<NaiveDate, f64>::new();
    for (date, amount) in income_rows {
        add_delta(&mut deltas, &date, amount);
    }
    for (date, amount) in expense_rows {
        add_delta(&mut deltas, &date, -amount);
    }
    for (date, amount) in transfer_in_rows {
        add_delta(&mut deltas, &date, amount);
    }
    for (date, amount) in transfer_out_rows {
        add_delta(&mut deltas, &date, -amount);
    }
    for (date, amount) in adjustment_rows {
        add_delta(&mut deltas, &date, amount);
    }

    let mut points = Vec::new();
    let mut cursor = end_date;
    let mut balance = account.current_balance;

    loop {
        points.push(AccountBalancePoint {
            date: cursor.to_string(),
            balance,
        });

        if cursor == start_date {
            break;
        }

        let today_delta = deltas.get(&cursor).copied().unwrap_or_default();
        balance -= today_delta;
        cursor -= Duration::days(1);
    }

    points.reverse();
    Ok(points)
}

pub async fn create_financial_transfer(
    pool: &SqlitePool,
    payload: CreateFinancialTransferPayload,
) -> Result<FinancialTransfer, String> {
    if payload.from_account_id == payload.to_account_id {
        return Err("La cuenta origen y destino no pueden ser la misma".to_string());
    }

    if payload.amount <= 0.0 {
        return Err("El monto de la transferencia debe ser mayor a cero".to_string());
    }

    let accounts: Vec<(String, String, String, f64)> = sqlx::query_as(
        "SELECT id, profile_id, currency_code, current_balance FROM financial_accounts WHERE id IN (?, ?)",
    )
    .bind(&payload.from_account_id)
    .bind(&payload.to_account_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if accounts.len() != 2 {
        return Err("No se encontraron ambas cuentas para la transferencia".to_string());
    }

    let from_account = accounts
        .iter()
        .find(|(id, _, _, _)| id == &payload.from_account_id)
        .ok_or_else(|| "No se encontro la cuenta origen".to_string())?;
    let to_account = accounts
        .iter()
        .find(|(id, _, _, _)| id == &payload.to_account_id)
        .ok_or_else(|| "No se encontro la cuenta destino".to_string())?;

    if from_account.1 != payload.profile_id || to_account.1 != payload.profile_id {
        return Err("Las cuentas no pertenecen al perfil activo".to_string());
    }

    if from_account.2 != to_account.2 {
        return Err(
            "Por ahora solo se permiten transferencias entre cuentas de la misma moneda"
                .to_string(),
        );
    }

    if from_account.3 < payload.amount {
        return Err(
            "La cuenta origen no tiene saldo suficiente para esta transferencia".to_string(),
        );
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO financial_transfers
         (id, profile_id, from_account_id, to_account_id, amount, transfer_date, description, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.from_account_id)
    .bind(&payload.to_account_id)
    .bind(payload.amount)
    .bind(&payload.transfer_date)
    .bind(&payload.description)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    apply_account_balance_delta_tx(&mut tx, &payload.from_account_id, -payload.amount).await?;
    apply_account_balance_delta_tx(&mut tx, &payload.to_account_id, payload.amount).await?;

    tx.commit().await.map_err(|e| e.to_string())?;

    get_financial_transfer_by_id(pool, &id).await
}

pub async fn delete_financial_transfer(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let transfer: (String, String, f64) = sqlx::query_as(
        "SELECT from_account_id, to_account_id, amount FROM financial_transfers WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM financial_transfers WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    apply_account_balance_delta_tx(&mut tx, &transfer.0, transfer.2).await?;
    apply_account_balance_delta_tx(&mut tx, &transfer.1, -transfer.2).await?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
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

async fn apply_account_balance_delta_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    account_id: &str,
    delta: f64,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE financial_accounts
         SET current_balance = current_balance + ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(delta)
    .bind(Utc::now().to_rfc3339())
    .bind(account_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

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

async fn get_financial_transfer_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<FinancialTransfer, String> {
    sqlx::query_as::<_, FinancialTransfer>(
        r#"SELECT
            ft.id,
            ft.profile_id,
            ft.from_account_id,
            fa_from.name AS from_account_name,
            ft.to_account_id,
            fa_to.name AS to_account_name,
            ft.amount,
            ft.transfer_date,
            ft.description,
            ft.notes
        FROM financial_transfers ft
        INNER JOIN financial_accounts fa_from ON fa_from.id = ft.from_account_id
        INNER JOIN financial_accounts fa_to ON fa_to.id = ft.to_account_id
        WHERE ft.id = ?"#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}

async fn create_balance_adjustment_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    profile_id: &str,
    account_id: &str,
    amount: f64,
    adjustment_date: &str,
    reason: &str,
    notes: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO financial_account_balance_adjustments
         (id, profile_id, account_id, amount, adjustment_date, reason, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(profile_id)
    .bind(account_id)
    .bind(amount)
    .bind(adjustment_date)
    .bind(reason)
    .bind(notes)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn add_delta(deltas: &mut std::collections::BTreeMap<NaiveDate, f64>, date: &str, amount: f64) {
    if let Ok(parsed) = NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        let entry = deltas.entry(parsed).or_insert(0.0);
        *entry += amount;
    }
}
