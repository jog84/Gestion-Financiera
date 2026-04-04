use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Alert {
    pub id: String,
    pub profile_id: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    pub ref_id: Option<String>,
    pub ref_type: Option<String>,
    pub is_read: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAlertPayload {
    pub profile_id: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    pub ref_id: Option<String>,
    pub ref_type: Option<String>,
}

#[tauri::command]
pub async fn get_alerts(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    unread_only: bool,
) -> Result<Vec<Alert>, String> {
    let query = if unread_only {
        "SELECT id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at FROM alerts WHERE profile_id = ? AND is_read = 0 ORDER BY created_at DESC"
    } else {
        "SELECT id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at FROM alerts WHERE profile_id = ? ORDER BY created_at DESC LIMIT 50"
    };
    sqlx::query_as::<_, Alert>(query)
        .bind(&profile_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_alert(
    pool: tauri::State<'_, SqlitePool>,
    payload: CreateAlertPayload,
) -> Result<Alert, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO alerts (id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    )
    .bind(&id)
    .bind(&payload.profile_id)
    .bind(&payload.kind)
    .bind(&payload.title)
    .bind(&payload.body)
    .bind(&payload.ref_id)
    .bind(&payload.ref_type)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, Alert>(
        "SELECT id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at FROM alerts WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_alert_read(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("UPDATE alerts SET is_read = 1 WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn mark_all_alerts_read(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
) -> Result<(), String> {
    sqlx::query("UPDATE alerts SET is_read = 1 WHERE profile_id = ?")
        .bind(&profile_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_alert(pool: tauri::State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM alerts WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_budget_alerts(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<Alert>, String> {
    // Get all budgets with spending
    let budgets: Vec<(String, String, Option<String>, f64)> = sqlx::query_as(
        r#"SELECT cb.id, cb.category_id, ec.name, cb.budget_amount
           FROM category_budgets cb
           LEFT JOIN expense_categories ec ON cb.category_id = ec.id
           WHERE cb.profile_id = ? AND cb.year = ? AND cb.month = ?"#,
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let mut created = Vec::new();
    let month_start = format!("{}-{:02}-01", year, month);

    for (budget_id, category_id, category_name, budget_amount) in budgets {
        let (spent,): (f64,) = sqlx::query_as(
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

        let pct = if budget_amount > 0.0 {
            spent / budget_amount * 100.0
        } else {
            0.0
        };
        let cat_label = category_name.as_deref().unwrap_or("Sin categoría");

        let kind = if pct >= 100.0 {
            "budget_exceeded"
        } else if pct >= 80.0 {
            "budget_warning"
        } else {
            continue;
        };

        // Check if we already have this alert this month
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM alerts WHERE profile_id = ? AND kind = ? AND ref_id = ? AND created_at >= ?",
        )
        .bind(&profile_id)
        .bind(kind)
        .bind(&budget_id)
        .bind(&month_start)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        if existing.is_some() {
            continue;
        }

        let (title, body) = if kind == "budget_exceeded" {
            (
                format!("Presupuesto excedido: {}", cat_label),
                format!(
                    "Gastaste ${:.0} de un presupuesto de ${:.0} ({:.0}%)",
                    spent, budget_amount, pct
                ),
            )
        } else {
            (
                format!("Presupuesto al {:.0}%: {}", pct, cat_label),
                format!(
                    "Gastaste ${:.0} de ${:.0} — quedan ${:.0}",
                    spent,
                    budget_amount,
                    budget_amount - spent
                ),
            )
        };

        let alert_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO alerts (id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 'budget', 0, ?)",
        )
        .bind(&alert_id)
        .bind(&profile_id)
        .bind(kind)
        .bind(&title)
        .bind(&body)
        .bind(&budget_id)
        .bind(&now)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let alert = sqlx::query_as::<_, Alert>(
            "SELECT id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at FROM alerts WHERE id = ?",
        )
        .bind(&alert_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        created.push(alert);
    }

    Ok(created)
}
