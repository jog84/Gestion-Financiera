use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize)]
pub struct RecentTransaction {
    pub id: String,
    pub kind: String, // "income" | "expense"
    pub amount: f64,
    pub transaction_date: String,
    pub description: Option<String>,
    pub source_or_category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnnualRow {
    pub month: i64,
    pub month_name: String,
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
}

#[derive(Debug, Serialize)]
pub struct AnnualReport {
    pub rows: Vec<AnnualRow>,
    pub total_income: f64,
    pub total_expenses: f64,
    pub total_balance: f64,
}

const MONTH_NAMES: [&str; 12] = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

#[derive(Debug, Serialize)]
pub struct YoyRow {
    pub month: i64,
    pub month_name: String,
    pub income_a: f64,
    pub expenses_a: f64,
    pub income_b: f64,
    pub expenses_b: f64,
}

#[derive(Debug, Serialize)]
pub struct YoyComparison {
    pub year_a: i64,
    pub year_b: i64,
    pub rows: Vec<YoyRow>,
    pub total_income_a: f64,
    pub total_expenses_a: f64,
    pub total_income_b: f64,
    pub total_expenses_b: f64,
    pub income_diff: f64,
    pub expenses_diff: f64,
}

#[tauri::command]
pub async fn get_recent_transactions(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    limit: i64,
) -> Result<Vec<RecentTransaction>, String> {
    // Union of recent incomes and expenses
    let incomes: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ie.id, ie.amount, ie.transaction_date, ie.description, src.name
           FROM income_entries ie
           LEFT JOIN income_sources src ON ie.source_id = src.id
           WHERE ie.profile_id = ?
           ORDER BY ie.transaction_date DESC, ie.created_at DESC LIMIT ?"#,
    )
    .bind(&profile_id)
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let expenses: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ee.id, ee.amount, ee.transaction_date, ee.description, cat.name
           FROM expense_entries ee
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           WHERE ee.profile_id = ?
           ORDER BY ee.transaction_date DESC, ee.created_at DESC LIMIT ?"#,
    )
    .bind(&profile_id)
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut combined: Vec<RecentTransaction> = incomes
        .into_iter()
        .map(|(id, amount, date, desc, src)| RecentTransaction {
            id, kind: "income".to_string(), amount, transaction_date: date, description: desc, source_or_category: src,
        })
        .chain(expenses.into_iter().map(|(id, amount, date, desc, cat)| RecentTransaction {
            id, kind: "expense".to_string(), amount, transaction_date: date, description: desc, source_or_category: cat,
        }))
        .collect();

    combined.sort_by(|a, b| b.transaction_date.cmp(&a.transaction_date));
    combined.truncate(limit as usize);
    Ok(combined)
}

#[tauri::command]
pub async fn get_annual_report(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
) -> Result<AnnualReport, String> {
    let mut rows = Vec::new();

    for month in 1i64..=12 {
        let period: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM periods WHERE profile_id = ? AND year = ? AND month = ?",
        )
        .bind(&profile_id)
        .bind(year)
        .bind(month)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let (total_income, total_expenses) = if let Some((period_id,)) = period {
            let (inc,): (f64,) = sqlx::query_as(
                "SELECT COALESCE(SUM(amount),0.0) FROM income_entries WHERE profile_id = ? AND period_id = ?",
            ).bind(&profile_id).bind(&period_id).fetch_one(pool.inner()).await.map_err(|e| e.to_string())?;

            let (exp,): (f64,) = sqlx::query_as(
                "SELECT COALESCE(SUM(amount),0.0) FROM expense_entries WHERE profile_id = ? AND period_id = ?",
            ).bind(&profile_id).bind(&period_id).fetch_one(pool.inner()).await.map_err(|e| e.to_string())?;

            (inc, exp)
        } else {
            (0.0, 0.0)
        };

        rows.push(AnnualRow {
            month,
            month_name: MONTH_NAMES[(month - 1) as usize].to_string(),
            total_income,
            total_expenses,
            balance: total_income - total_expenses,
        });
    }

    let total_income = rows.iter().map(|r| r.total_income).sum();
    let total_expenses = rows.iter().map(|r| r.total_expenses).sum();

    Ok(AnnualReport {
        rows,
        total_income,
        total_expenses,
        total_balance: total_income - total_expenses,
    })
}

async fn get_month_totals(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<(f64, f64), String> {
    let period: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM periods WHERE profile_id = ? AND year = ? AND month = ?",
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((period_id,)) = period {
        let (inc,): (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount),0.0) FROM income_entries WHERE profile_id = ? AND period_id = ?",
        ).bind(profile_id).bind(&period_id).fetch_one(pool).await.map_err(|e| e.to_string())?;
        let (exp,): (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount),0.0) FROM expense_entries WHERE profile_id = ? AND period_id = ?",
        ).bind(profile_id).bind(&period_id).fetch_one(pool).await.map_err(|e| e.to_string())?;
        Ok((inc, exp))
    } else {
        Ok((0.0, 0.0))
    }
}

#[tauri::command]
pub async fn get_yoy_comparison(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year_a: i64,
    year_b: i64,
) -> Result<YoyComparison, String> {
    let mut rows = Vec::new();
    for month in 1i64..=12 {
        let (income_a, expenses_a) = get_month_totals(pool.inner(), &profile_id, year_a, month).await?;
        let (income_b, expenses_b) = get_month_totals(pool.inner(), &profile_id, year_b, month).await?;
        rows.push(YoyRow {
            month,
            month_name: MONTH_NAMES[(month - 1) as usize].to_string(),
            income_a,
            expenses_a,
            income_b,
            expenses_b,
        });
    }

    let total_income_a: f64 = rows.iter().map(|r| r.income_a).sum();
    let total_expenses_a: f64 = rows.iter().map(|r| r.expenses_a).sum();
    let total_income_b: f64 = rows.iter().map(|r| r.income_b).sum();
    let total_expenses_b: f64 = rows.iter().map(|r| r.expenses_b).sum();
    let income_diff = total_income_a - total_income_b;
    let expenses_diff = total_expenses_a - total_expenses_b;

    Ok(YoyComparison { year_a, year_b, rows, total_income_a, total_expenses_a, total_income_b, total_expenses_b, income_diff, expenses_diff })
}
