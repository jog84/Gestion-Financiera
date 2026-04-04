use crate::services::investments::compute_open_positions;
use chrono::Utc;
use serde::Serialize;
use sqlx::SqlitePool;
use uuid::Uuid;

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

#[derive(Debug, Serialize)]
pub struct FinancialInsight {
    pub id: String,
    pub kind: String,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub action_label: Option<String>,
    pub action_route: Option<String>,
    pub metric_value: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct FinancialRecommendation {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub impact_label: String,
    pub impact_value: f64,
    pub action_label: Option<String>,
    pub action_route: Option<String>,
}

const MONTH_NAMES: [&str; 12] = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
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

    let asset_rows: Vec<(Option<String>, f64)> =
        sqlx::query_as("SELECT category, value FROM asset_snapshots WHERE profile_id = ?")
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

    let investment_assets = compute_open_positions(pool, profile_id)
        .await?
        .iter()
        .map(|position| position.current_value_ars)
        .sum::<f64>();

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
        .filter(|(category, _)| {
            !matches!(
                category.as_deref(),
                Some("efectivo") | Some("inversion") | Some("cripto")
            )
        })
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

    let total_assets = asset_rows.iter().map(|(_, value)| *value).sum::<f64>()
        + investment_assets
        + accounts_total;
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

pub async fn get_financial_insights(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialInsight>, String> {
    let overview = get_financial_overview(pool, profile_id, year, month).await?;
    let insights = build_financial_insights(pool, profile_id, year, month, &overview).await?;
    Ok(insights)
}

pub async fn check_financial_alerts(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialInsight>, String> {
    let overview = get_financial_overview(pool, profile_id, year, month).await?;
    let insights = build_financial_insights(pool, profile_id, year, month, &overview).await?;
    let month_key = format!("{year:04}-{month:02}");
    let now = Utc::now().to_rfc3339();

    for insight in &insights {
        if !matches!(
            insight.kind.as_str(),
            "low_liquidity" | "negative_cashflow" | "portfolio_concentration"
        ) {
            continue;
        }

        let ref_id = format!("{}:{month_key}", insight.kind);
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM alerts WHERE profile_id = ? AND kind = ? AND ref_id = ?",
        )
        .bind(profile_id)
        .bind(&insight.kind)
        .bind(&ref_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

        if existing.is_some() {
            continue;
        }

        sqlx::query(
            "INSERT INTO alerts (id, profile_id, kind, title, body, ref_id, ref_type, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'financial_insight', 0, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(profile_id)
        .bind(&insight.kind)
        .bind(&insight.title)
        .bind(&insight.body)
        .bind(&ref_id)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(insights)
}

pub async fn get_financial_recommendations(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
) -> Result<Vec<FinancialRecommendation>, String> {
    let overview = get_financial_overview(pool, profile_id, year, month).await?;
    build_financial_recommendations(pool, profile_id, year, month, &overview).await
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
        .chain(
            expenses
                .into_iter()
                .map(|(id, amount, date, desc, cat)| RecentTransaction {
                    id,
                    kind: "expense".to_string(),
                    amount,
                    transaction_date: date,
                    description: desc,
                    source_or_category: cat,
                }),
        )
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
        let (total_income, total_expenses) =
            get_month_totals(pool, profile_id, year, month).await?;
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

async fn build_financial_insights(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
    overview: &FinancialOverview,
) -> Result<Vec<FinancialInsight>, String> {
    let mut insights = Vec::new();

    if let Some(liquidity_months) = overview.liquidity_months {
        if liquidity_months < 3.0 {
            let severity = if liquidity_months < 1.0 {
                "high"
            } else {
                "medium"
            };
            insights.push(FinancialInsight {
                id: "low_liquidity".to_string(),
                kind: "low_liquidity".to_string(),
                severity: severity.to_string(),
                title: "Colchón de liquidez bajo".to_string(),
                body: format!(
                    "Tu liquidez cubre {:.1} meses de gastos fijos. El objetivo mínimo recomendable es 3 meses.",
                    liquidity_months
                ),
                action_label: Some("Revisar cuentas".to_string()),
                action_route: Some("/accounts".to_string()),
                metric_value: Some(liquidity_months),
            });
        }
    }

    if overview.balance < 0.0 {
        insights.push(FinancialInsight {
            id: "negative_cashflow".to_string(),
            kind: "negative_cashflow".to_string(),
            severity: if overview.savings_rate < -10.0 {
                "high"
            } else {
                "medium"
            }
            .to_string(),
            title: "Mes con cashflow negativo".to_string(),
            body: format!(
                "Tus gastos superan a tus ingresos por {} en {:02}/{}.",
                format_currencyish(overview.balance.abs()),
                month,
                year
            ),
            action_label: Some("Ver gastos".to_string()),
            action_route: Some("/expenses".to_string()),
            metric_value: Some(overview.balance),
        });
    }

    if overview.total_income > 0.0 && overview.monthly_fixed_expenses / overview.total_income >= 0.7
    {
        let fixed_ratio = overview.monthly_fixed_expenses / overview.total_income * 100.0;
        insights.push(FinancialInsight {
            id: "fixed_expense_pressure".to_string(),
            kind: "fixed_expense_pressure".to_string(),
            severity: if fixed_ratio >= 85.0 { "high" } else { "medium" }.to_string(),
            title: "Carga fija muy alta".to_string(),
            body: format!(
                "Tus gastos fijos consumen {:.0}% de tus ingresos del mes. Hay poco margen para ahorro o inversión.",
                fixed_ratio
            ),
            action_label: Some("Analizar presupuesto".to_string()),
            action_route: Some("/reports".to_string()),
            metric_value: Some(fixed_ratio),
        });
    }

    let positions: Vec<(String, f64)> = compute_open_positions(pool, profile_id)
        .await?
        .into_iter()
        .map(|position| (position.key, position.current_value_ars))
        .collect();

    let total_invested_value: f64 = positions.iter().map(|(_, value)| *value).sum();
    if total_invested_value > 0.0 {
        let mut by_name = std::collections::BTreeMap::<String, f64>::new();
        for (name, value) in positions {
            let entry = by_name.entry(name).or_insert(0.0);
            *entry += value;
        }

        if let Some((name, value)) = by_name
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        {
            let concentration = value / total_invested_value * 100.0;
            if concentration >= 50.0 {
                insights.push(FinancialInsight {
                    id: "portfolio_concentration".to_string(),
                    kind: "portfolio_concentration".to_string(),
                    severity: if concentration >= 65.0 { "high" } else { "medium" }.to_string(),
                    title: "Portfolio demasiado concentrado".to_string(),
                    body: format!(
                        "{} representa {:.0}% del capital invertido. Considera diversificar para bajar riesgo específico.",
                        name,
                        concentration
                    ),
                    action_label: Some("Revisar inversiones".to_string()),
                    action_route: Some("/investments".to_string()),
                    metric_value: Some(concentration),
                });
            }
        }
    }

    Ok(insights)
}

async fn build_financial_recommendations(
    pool: &SqlitePool,
    profile_id: &str,
    year: i64,
    month: i64,
    overview: &FinancialOverview,
) -> Result<Vec<FinancialRecommendation>, String> {
    let mut recommendations = Vec::new();

    let top_expense_categories: Vec<(String, f64)> = sqlx::query_as(
        r#"SELECT COALESCE(ec.name, 'Sin categoría') AS category_name, COALESCE(SUM(ee.amount), 0.0) AS total
           FROM expense_entries ee
           JOIN periods p ON ee.period_id = p.id
           LEFT JOIN expense_categories ec ON ee.category_id = ec.id
           WHERE ee.profile_id = ? AND p.year = ? AND p.month = ?
           GROUP BY COALESCE(ec.name, 'Sin categoría')
           ORDER BY total DESC
           LIMIT 1"#,
    )
    .bind(profile_id)
    .bind(year)
    .bind(month)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((category_name, total)) = top_expense_categories.first() {
        let suggested_cut = total * 0.15;
        if suggested_cut > 0.0 {
            recommendations.push(FinancialRecommendation {
                id: "expense_cut".to_string(),
                title: format!("Ajustar {}", category_name),
                summary: format!(
                    "{} fue tu categoría más pesada del mes. Un recorte del 15% liberaría flujo sin tocar toda la estructura de gasto.",
                    category_name
                ),
                impact_label: "Ahorro potencial mensual".to_string(),
                impact_value: suggested_cut,
                action_label: Some("Revisar gastos".to_string()),
                action_route: Some("/expenses".to_string()),
            });
        }
    }

    if overview.total_income > 0.0 {
        let target_savings = overview.total_income * 0.20;
        let current_savings = (overview.total_income - overview.total_expenses).max(0.0);
        let gap = (target_savings - current_savings).max(0.0);
        if gap > 0.0 {
            recommendations.push(FinancialRecommendation {
                id: "savings_target".to_string(),
                title: "Cerrar brecha de ahorro".to_string(),
                summary: format!(
                    "Para llegar a una tasa de ahorro del 20%, te conviene reservar {} adicionales este mes.",
                    format_currencyish(gap)
                ),
                impact_label: "Aporte sugerido".to_string(),
                impact_value: gap,
                action_label: Some("Ver dashboard".to_string()),
                action_route: Some("/".to_string()),
            });
        }
    }

    let positions: Vec<(String, f64)> = compute_open_positions(pool, profile_id)
        .await?
        .into_iter()
        .map(|position| (position.key, position.current_value_ars))
        .collect();

    let total_portfolio: f64 = positions.iter().map(|(_, value)| *value).sum();
    if total_portfolio > 0.0 {
        let mut by_name = std::collections::BTreeMap::<String, f64>::new();
        for (name, value) in positions {
            let entry = by_name.entry(name).or_insert(0.0);
            *entry += value;
        }

        if let Some((largest_name, largest_value)) = by_name
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        {
            let concentration = largest_value / total_portfolio;
            let target_weight = 0.35;
            if concentration > target_weight {
                let rebalance_amount = largest_value - total_portfolio * target_weight;
                recommendations.push(FinancialRecommendation {
                    id: "rebalance_position".to_string(),
                    title: format!("Rebalancear {}", largest_name),
                    summary: format!(
                        "{} pesa {:.0}% del portfolio. Bajarla hacia 35% reduce dependencia de un solo activo.",
                        largest_name,
                        concentration * 100.0
                    ),
                    impact_label: "Monto a reasignar".to_string(),
                    impact_value: rebalance_amount.max(0.0),
                    action_label: Some("Ir a inversiones".to_string()),
                    action_route: Some("/investments".to_string()),
                });
            }
        }
    }

    Ok(recommendations)
}

fn format_currencyish(value: f64) -> String {
    format!("${:.0}", value)
}
