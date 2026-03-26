use sqlx::SqlitePool;

use crate::services::recurring::{
    apply_due_recurring as apply_due_recurring_entries,
    create_recurring_transaction as create_recurring_transaction_entry,
    delete_recurring_transaction as delete_recurring_transaction_entry,
    list_recurring_transactions, toggle_recurring_active as toggle_recurring_active_entry,
    update_recurring_transaction as update_recurring_transaction_entry, AppliedRecurring,
    CreateRecurringPayload, RecurringTransaction,
};

#[tauri::command]
pub async fn get_recurring_transactions(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<RecurringTransaction>, String> {
    list_recurring_transactions(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_recurring_transaction(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateRecurringPayload,
) -> Result<RecurringTransaction, String> {
    create_recurring_transaction_entry(pool.inner(), payload).await
}

#[tauri::command]
pub async fn update_recurring_transaction(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    payload: CreateRecurringPayload,
) -> Result<RecurringTransaction, String> {
    update_recurring_transaction_entry(pool.inner(), &id, payload).await
}

#[tauri::command]
pub async fn toggle_recurring_active(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    toggle_recurring_active_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn delete_recurring_transaction(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_recurring_transaction_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn apply_due_recurring(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    reference_date: String,
) -> Result<Vec<AppliedRecurring>, String> {
    apply_due_recurring_entries(pool.inner(), &profile_id, &reference_date).await
}
