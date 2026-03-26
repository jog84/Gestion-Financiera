use sqlx::SqlitePool;

use crate::services::assets::{
    create_asset as create_asset_snapshot, delete_asset as delete_asset_snapshot,
    list_assets, update_asset as update_asset_snapshot, AssetSnapshot, CreateAssetPayload,
    UpdateAssetPayload,
};

#[tauri::command]
pub async fn get_assets(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<AssetSnapshot>, String> {
    list_assets(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_asset(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateAssetPayload,
) -> Result<AssetSnapshot, String> {
    create_asset_snapshot(pool.inner(), payload).await
}

#[tauri::command]
pub async fn delete_asset(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_asset_snapshot(pool.inner(), &id).await
}

#[tauri::command]
pub async fn update_asset(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateAssetPayload,
) -> Result<AssetSnapshot, String> {
    update_asset_snapshot(pool.inner(), &id, payload).await
}
