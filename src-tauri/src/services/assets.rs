use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::services::periods::{get_or_create_period, get_profile_id_for_record, ProfileOwnedTable};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssetSnapshot {
    pub id: String,
    pub profile_id: String,
    pub period_id: String,
    pub name: String,
    pub category: Option<String>,
    pub value: f64,
    pub snapshot_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetPayload {
    pub profile_id: String,
    pub name: String,
    pub category: Option<String>,
    pub value: f64,
    pub snapshot_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssetPayload {
    pub name: String,
    pub category: Option<String>,
    pub value: f64,
    pub snapshot_date: String,
    pub notes: Option<String>,
}

pub async fn list_assets(pool: &SqlitePool, profile_id: &str) -> Result<Vec<AssetSnapshot>, String> {
    sqlx::query_as::<_, AssetSnapshot>(
        "SELECT id, profile_id, period_id, name, category, value, snapshot_date, notes
         FROM asset_snapshots WHERE profile_id = ? ORDER BY snapshot_date DESC",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_asset(
    pool: &SqlitePool,
    payload: CreateAssetPayload,
) -> Result<AssetSnapshot, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let period_id = get_or_create_period(pool, &payload.profile_id, &payload.snapshot_date).await?;

    sqlx::query(
        "INSERT INTO asset_snapshots (id, profile_id, period_id, name, category, value, snapshot_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&period_id)
    .bind(&payload.name)
    .bind(&payload.category)
    .bind(payload.value)
    .bind(&payload.snapshot_date)
    .bind(&payload.notes)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_asset_by_id(pool, &id).await
}

pub async fn update_asset(
    pool: &SqlitePool,
    id: &str,
    payload: UpdateAssetPayload,
) -> Result<AssetSnapshot, String> {
    let now = Utc::now().to_rfc3339();
    let profile_id = get_profile_id_for_record(pool, ProfileOwnedTable::AssetSnapshots, id).await?;
    let period_id = get_or_create_period(pool, &profile_id, &payload.snapshot_date).await?;

    sqlx::query(
        "UPDATE asset_snapshots SET name = ?, category = ?, value = ?, snapshot_date = ?, notes = ?, period_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&payload.name)
    .bind(&payload.category)
    .bind(payload.value)
    .bind(&payload.snapshot_date)
    .bind(&payload.notes)
    .bind(&period_id)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_asset_by_id(pool, id).await
}

pub async fn delete_asset(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM asset_snapshots WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn get_asset_by_id(pool: &SqlitePool, id: &str) -> Result<AssetSnapshot, String> {
    sqlx::query_as::<_, AssetSnapshot>(
        "SELECT id, profile_id, period_id, name, category, value, snapshot_date, notes
         FROM asset_snapshots WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
