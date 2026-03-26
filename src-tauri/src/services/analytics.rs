use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub month: i64,
    pub year: i64,
}

#[derive(Debug, Serialize)]
pub struct FinancialOverview {
    pub year: i64,
    pub month: i64,
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub savings_rate: f64,
    pub total_assets: f64,
    pub liquid_assets: f64,
    pub investment_assets: f64,
    pub physical_assets: f64,
    pub monthly_fixed_expenses: f64,
    pub liquidity_months: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct RecentTransaction {
    pub id: String,
    pub kind: String,
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

const MONTH_NAMES: [&str; 12] = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

pub async fn get_dashboard_summary(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<DashboardSummary, String> {
    let (total_income, total_expenses) = get_month_totals(pool, profile_id, year, month).await?;

    Ok(DashboardSummary {
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
        month,
        year,
    })
}

pub async fn get_financial_overview(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<FinancialOverview, String> {
    let (total_income, total_expenses) = get_month_totals(pool, profile_id, year, month).await?;

    let asset_rows: Vec<(Option<String>, f64)> = sqlx::query_as(
        "SELECT category, value FROM asset_snapshots WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (accounts_total, accounts_liquid): (f64, f64) = sqlx::query_as(
        "SELECT
            COALESCE(SUM(CASE WHEN include_in_net_worth = 1 THEN current_balance ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN include_in_net_worth = 1 AND is_liquid = 1 THEN current_balance ELSE 0 END), 0.0)
         FROM financial_accounts
         WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (investment_assets,): (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(COALESCE(current_value, amount_invested)), 0.0)
         FROM investment_entries
         WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let liquid_assets = asset_rows
        .iter()
        .filter(|(category, _)| matches!(category.as_deref(), Some("efectivo")))
        .map(|(_, value)| *value)
        .sum::<f64>();

    let manual_investment_assets = asset_rows
        .iter()
        .filter(|(category, _)| matches!(category.as_deref(), Some("inversion") | Some("cripto")))
        .map(|(_, value)| *value)
        .sum::<f64>();

    let physical_assets = asset_rows
        .iter()
        .filter(|(category, _)| !matches!(category.as_deref(), Some("efectivo") | Some("inversion") | Some("cripto")))
        .map(|(_, value)| *value)
        .sum::<f64>();

    let monthly_fixed_expenses = sqlx::query_as::<_, (f64,)>(
        "SELECT COALESCE(SUM(amount), 0.0)
         FROM recurring_transactions
         WHERE profile_id = ? AND is_active = 1 AND kind = 'expense' AND frequency = 'monthly'",
    )
    .bind(profile_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .0;

    let total_assets = asset_rows.iter().map(|(_, value)| *value).sum::<f64>() + investment_assets + accounts_total;
    let total_investment_assets = investment_assets + manual_investment_assets;
    let savings_rate = if total_income > 0.0 {
        (total_income - total_expenses) / total_income * 100.0
    } else {
        0.0
    };
    let liquidity_base = if total_expenses > 0.0 {
        total_expenses
    } else if monthly_fixed_expenses > 0.0 {
        monthly_fixed_expenses
    } else {
        0.0
    };

    Ok(FinancialOverview {
        year,
        month,
        total_income,
        total_expenses,
        balance: total_income - total_expenses,
        savings_rate,
        total_assets,
        liquid_assets: liquid_assets + accounts_liquid,
        investment_assets: total_investment_assets,
        physical_assets,
        monthly_fixed_expenses,
        liquidity_months: if liquidity_base > 0.0 {
            Some(liquid_assets / liquidity_base)
        } else {
            None
        },
    })
}

pub async fn get_recent_transactions(
    pool: &SqlitePool,
    profile_id: &str,
    limit: i64,
) -> Result<Vec<RecentTransaction>, String> {
    let incomes: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ie.id, ie.amount, ie.transaction_date, ie.description, src.name
           FROM income_entries ie
           LEFT JOIN income_sources src ON ie.source_id = src.id
           WHERE ie.profile_id = ?
           ORDER BY ie.transaction_date DESC, ie.created_at DESC LIMIT ?"#,
    )
    .bind(profile_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let expenses: Vec<(String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"SELECT ee.id, ee.amount, ee.transaction_date, ee.description, cat.name
           FROM expense_entries ee
           LEFT JOIN expense_categories cat ON ee.category_id = cat.id
           WHERE ee.profile_id = ?
           ORDER BY ee.transaction_date DESC, ee.created_at DESC LIMIT ?"#,
    )
    .bind(profile_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut combined: Vec<RecentTransaction> = incomes
        .into_iter()
        .map(|(id, amount, date, desc, src)| RecentTransaction {
            id,
            kind: "income".to_string(),
            amount,
            transaction_date: date,
            description: desc,
            source_or_category: src,
        })
        .chain(expenses.into_iter().map(|(id, amount, date, desc, cat)| RecentTransaction {
            id,
            kind: "expense".to_string(),
            amount,
            transaction_date: date,
            description: desc,
            source_or_category: cat,
        }))
        .collect();

    combined.sort_by(|a, b| b.transaction_date.cmp(&a.transaction_date));
    combined.truncate(limit as usize);
    Ok(combined)
}

pub async fn get_annual_report(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
) -> Result<AnnualReport, String> {
    let mut rows = Vec::new();

    for month in 1i64..=12 {
        let (total_income, total_expenses) = get_month_totals(pool, profile_id, year, month).await?;
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

pub async fn get_yoy_comparison(
    pool: &SqlitePool,
    profile_id: &str,
    year_a: i64,
    year_b: i64,
) -> Result<YoyComparison, String> {
    let mut rows = Vec::new();
    for month in 1i64..=12 {
        let (income_a, expenses_a) = get_month_totals(pool, profile_id, year_a, month).await?;
        let (income_b, expenses_b) = get_month_totals(pool, profile_id, year_b, month).await?;
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

    Ok(YoyComparison {
        year_a,
        year_b,
        rows,
        total_income_a,
        total_expenses_a,
        total_income_b,
        total_expenses_b,
        income_diff: total_income_a - total_income_b,
        expenses_diff: total_expenses_a - total_expenses_b,
    })
}

async fn get_month_totals(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<(f64, f64), String> {
    let (total_income,): (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ie.amount), 0.0)
         FROM income_entries ie
         JOIN periods p ON ie.period_id = p.id
         WHERE ie.profile_id = ? AND p.year = ? AND p.month = ?",
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (total_expenses,): (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ee.amount), 0.0)
         FROM expense_entries ee
         JOIN periods p ON ee.period_id = p.id
         WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?",
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok((total_income, total_expenses))
}
