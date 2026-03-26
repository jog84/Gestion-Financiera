use sqlx::SqlitePool;

use crate::services::sources::{
    create_expense_category as create_expense_category_entry,
    create_income_source as create_income_source_entry,
    delete_expense_category as delete_expense_category_entry,
    delete_income_source as delete_income_source_entry,
    list_expense_categories, list_income_sources, update_expense_category as update_expense_category_entry,
    update_income_source as update_income_source_entry, ExpenseCategory, IncomeSource,
};

#[tauri::command]
pub async fn get_income_sources(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<IncomeSource>, String> {
    list_income_sources(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_income_source(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    create_income_source_entry(pool.inner(), &profile_id, &name, color, icon).await
}

#[tauri::command]
pub async fn update_income_source(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<IncomeSource, String> {
    update_income_source_entry(pool.inner(), &id, &name, color, icon).await
}

#[tauri::command]
pub async fn delete_income_source(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_income_source_entry(pool.inner(), &id).await
}

#[tauri::command]
pub async fn get_expense_categories(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<Vec<ExpenseCategory>, String> {
    list_expense_categories(pool.inner(), &profile_id).await
}

#[tauri::command]
pub async fn create_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    create_expense_category_entry(pool.inner(), &profile_id, &name, color, icon).await
}

#[tauri::command]
pub async fn update_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<ExpenseCategory, String> {
    update_expense_category_entry(pool.inner(), &id, &name, color, icon).await
}

#[tauri::command]
pub async fn delete_expense_category(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    delete_expense_category_entry(pool.inner(), &id).await
}
