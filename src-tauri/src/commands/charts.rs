use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MonthlySummary {
    pub year: i64,
    pub month: i64,
    pub total_income: f64,
    pub total_expenses: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CategoryBreakdown {
    pub category_id: Option<String>,
    pub category_name: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct InstallmentCashflowPoint {
    pub year: i64,
    pub month: i64,
    pub month_label: String,
    pub total_due: f64,
    pub installment_count: i64,
}

const MONTH_NAMES: [&str; 12] = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

#[tauri::command]
pub async fn get_monthly_summary(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    months: i64,
) -> Result<Vec<MonthlySummary>, String> {
    let periods: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT id, year, month FROM periods WHERE profile_id = ?
         ORDER BY year DESC, month DESC LIMIT ?",
    )
    .bind(&profile_id)
    .bind(months)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (period_id, year, month) in periods {
        let (total_income,): (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount), 0.0) FROM income_entries WHERE profile_id = ? AND period_id = ?",
        )
        .bind(&profile_id)
        .bind(&period_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let (total_expenses,): (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount), 0.0) FROM expense_entries WHERE profile_id = ? AND period_id = ?",
        )
        .bind(&profile_id)
        .bind(&period_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        result.push(MonthlySummary {
            year,
            month,
            total_income,
            total_expenses,
        });
    }

    result.reverse();
    Ok(result)
}

#[tauri::command]
pub async fn get_expense_breakdown(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<CategoryBreakdown>, String> {
    sqlx::query_as::<_, CategoryBreakdown>(
        r#"SELECT
            cat.id AS category_id,
            COALESCE(cat.name, 'Sin categoría') AS category_name,
            SUM(ee.amount) AS total
           FROM expense_entries ee
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           JOIN periods p ON ee.period_id = p.id
           WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?
           GROUP BY cat.id, cat.name
           ORDER BY total DESC"#,
    )
    .bind(&profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installment_cashflow(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    months_ahead: i64,
) -> Result<Vec<InstallmentCashflowPoint>, String> {
    // Get all active installments (those that still have payments remaining)
    let installments: Vec<(String, f64, i64, String)> = sqlx::query_as(
        r#"SELECT id, total_amount, installment_count, start_date
           FROM installment_entries WHERE profile_id = ?
           ORDER BY start_date"#,
    )
    .bind(&profile_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    use chrono::{Datelike, NaiveDate, Utc};
    let now = Utc::now().date_naive();
    let start_year = now.year();
    let start_month = now.month() as i64;

    // Build a map of year-month -> (total, count)
    let mut monthly: std::collections::HashMap<(i64, i64), (f64, i64)> =
        std::collections::HashMap::new();

    for (_id, total_amount, installment_count, start_date_str) in installments {
        let start = match NaiveDate::parse_from_str(&start_date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let monthly_payment = total_amount / installment_count as f64;

        for i in 0..installment_count {
            // Calculate the month for this installment
            let total_months_offset = (start.month() as i64 - 1) + i;
            let inst_year = start.year() as i64 + total_months_offset / 12;
            let inst_month = (total_months_offset % 12) + 1;

            // Only include months within the lookahead window
            let months_from_now = (inst_year - start_year as i64) * 12 + (inst_month - start_month);
            if months_from_now < 0 || months_from_now > months_ahead {
                continue;
            }

            let entry = monthly.entry((inst_year, inst_month)).or_insert((0.0, 0));
            entry.0 += monthly_payment;
            entry.1 += 1;
        }
    }

    // Build output for next months_ahead months
    let mut result = Vec::new();
    for i in 0..=months_ahead {
        let total_offset = (start_month - 1) + i;
        let year = start_year as i64 + total_offset / 12;
        let month = (total_offset % 12) + 1;
        let (total_due, installment_count) =
            monthly.get(&(year, month)).copied().unwrap_or((0.0, 0));
        let month_label = format!("{}/{}", MONTH_NAMES[(month - 1) as usize], year % 100);
        result.push(InstallmentCashflowPoint {
            year,
            month,
            month_label,
            total_due,
            installment_count,
        });
    }

    Ok(result)
}
