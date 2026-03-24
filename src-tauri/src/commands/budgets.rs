use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CategoryBudget {
    pub id: String,
    pub profile_id: String,
    pub category_id: String,
    pub category_name: Option<String>,
    pub year: i64,
    pub month: i64,
    pub budget_amount: f64,
    pub spent_amount: f64,
    pub pct_used: f64,
}

#[tauri::command]
pub async fn get_budgets(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<CategoryBudget>, String> {
    let rows: Vec<(String, String, Option<String>, i64, i64, f64)> = sqlx::query_as(
        r#"SELECT cb.id, cb.category_id, ec.name, cb.year, cb.month, cb.budget_amount
           FROM category_budgets cb
           LEFT JOIN expense_categories ec ON cb.category_id = ec.id
           WHERE cb.profile_id = ? AND cb.year = ? AND cb.month = ?
           ORDER BY ec.name"#,
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (id, category_id, category_name, y, m, budget_amount) in rows {
        let (spent_amount,): (f64,) = sqlx::query_as(
            r#"SELECT COALESCE(SUM(ee.amount), 0.0)
               FROM expense_entries ee
               JOIN periods p ON ee.period_id = p.id
               WHERE ee.profile_id = ? AND ee.category_id = ? AND p.year = ? AND p.month = ?"#,
        )
        .bind(&profile_id)
        .bind(&category_id)
        .bind(y)
        .bind(m)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let pct_used = if budget_amount > 0.0 { (spent_amount / budget_amount) * 100.0 } else { 0.0 };

        result.push(CategoryBudget {
            id,
            profile_id: profile_id.clone(),
            category_id,
            category_name,
            year: y,
            month: m,
            budget_amount,
            spent_amount,
            pct_used,
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn upsert_budget(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    category_id: String,
    year: i64,
    month: i64,
    budget_amount: f64,
) -> Result<CategoryBudget, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"INSERT INTO category_budgets (id, profile_id, category_id, year, month, budget_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(profile_id, category_id, year, month) DO UPDATE SET budget_amount = excluded.budget_amount, updated_at = excluded.updated_at"#,
    )
    .bind(&id)
    .bind(&profile_id)
    .bind(&category_id)
    .bind(year)
    .bind(month)
    .bind(budget_amount)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (actual_id,): (String,) = sqlx::query_as(
        "SELECT id FROM category_budgets WHERE profile_id = ? AND category_id = ? AND year = ? AND month = ?",
    )
    .bind(&profile_id)
    .bind(&category_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let category_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM expense_categories WHERE id = ?",
    )
    .bind(&category_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .flatten();

    let (spent_amount,): (f64,) = sqlx::query_as(
        r#"SELECT COALESCE(SUM(ee.amount), 0.0)
           FROM expense_entries ee
           JOIN periods p ON ee.period_id = p.id
           WHERE ee.profile_id = ? AND ee.category_id = ? AND p.year = ? AND p.month = ?"#,
    )
    .bind(&profile_id)
    .bind(&category_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let pct_used = if budget_amount > 0.0 { (spent_amount / budget_amount) * 100.0 } else { 0.0 };

    Ok(CategoryBudget {
        id: actual_id,
        profile_id,
        category_id,
        category_name,
        year,
        month,
        budget_amount,
        spent_amount,
        pct_used,
    })
}

#[tauri::command]
pub async fn delete_budget(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM category_budgets WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
