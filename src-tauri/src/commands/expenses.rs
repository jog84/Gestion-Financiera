use sqlx::SqlitePool;

use crate::services::cashflow::{
    create_expense as create_expense_entry, delete_expense as delete_expense_entry,
    list_expenses, update_expense as update_expense_entry, CreateExpensePayload, ExpenseEntry,
    UpdateExpensePayload,
};

#[tauri::command]
pub async fn get_expenses(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<ExpenseEntry>, String> {
    list_expenses(pool.inner(), &profile_id, year, month).await
}

#[tauri::command]
pub async fn create_expense(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateExpensePayload,
) -> Result<ExpenseEntry, String> {
    create_expense_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn delete_expense(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    delete_expense_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn update_expense(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: UpdateExpensePayload,
) -> Result<ExpenseEntry, String> {
    update_expense_entry(pool.inner(), &id, payload).await
}
