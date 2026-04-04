use sqlx::SqlitePool;

use crate::services::cashflow::{
    create_income as create_income_entry, delete_income as delete_income_entry, list_incomes,
    update_income as update_income_entry, CreateIncomePayload, IncomeEntry, UpdateIncomePayload,
};

#[tauri::command]
pub async fn get_incomes(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<IncomeEntry>, String> {
    list_incomes(pool.inner(), &profile_id, year, month).await
}

#[tauri::command]
pub async fn create_income(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateIncomePayload,
) -> Result<IncomeEntry, String> {
    create_income_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn delete_income(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    delete_income_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn update_income(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateIncomePayload,
) -> Result<IncomeEntry, String> {
    update_income_entry(pool.inner(), &id, payload).await
}
