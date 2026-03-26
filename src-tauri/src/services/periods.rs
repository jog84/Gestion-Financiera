use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub enum ProfileOwnedTable {
    AssetSnapshots,
    ExpenseEntries,
    IncomeEntries,
}

impl ProfileOwnedTable {
    fn select_profile_query(&self) -> &'static str {
        match self {
            Self::AssetSnapshots => "SELECT profile_id FROM asset_snapshots WHERE id = ?",
            Self::ExpenseEntries => "SELECT profile_id FROM expense_entries WHERE id = ?",
            Self::IncomeEntries => "SELECT profile_id FROM income_entries WHERE id = ?",
        }
    }
}

pub async fn get_profile_id_for_record(
    pool: &SqlitePool,
    table: ProfileOwnedTable,
    id: &str,
) -> Result<String, String> {
    let (profile_id,): (String,) = sqlx::query_as(table.select_profile_query())
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(profile_id)
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
