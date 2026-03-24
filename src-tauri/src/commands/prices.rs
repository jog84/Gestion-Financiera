use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

// ─── Yahoo Finance chart endpoint response ────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ChartResponse {
    chart: ChartBody,
}

#[derive(Debug, Deserialize)]
struct ChartBody {
    result: Option<Vec<ChartResult>>,
}

#[derive(Debug, Deserialize)]
struct ChartResult {
    meta: ChartMeta,
}

#[derive(Debug, Deserialize)]
struct ChartMeta {
    symbol: String,
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: f64,
    currency: Option<String>,
    #[serde(rename = "exchangeName")]
    exchange_name: Option<String>,
}

// ─── dolarapi.com response ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DolarResponse {
    venta: f64,
}

// ─── Public types returned to frontend ───────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PriceResult {
    pub ticker: String,
    pub price_ars: f64,
    pub currency: String,
    pub market_state: String,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Fetch current ARS prices from Yahoo Finance for a list of CEDEAR tickers.
/// Uses the /v8/finance/chart endpoint (one request per ticker, concurrent).
#[tauri::command]
pub async fn fetch_prices(tickers: Vec<String>) -> Result<Vec<PriceResult>, String> {
    if tickers.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut results: Vec<PriceResult> = Vec::new();

    for ticker in &tickers {
        let symbol = if ticker.contains('.') {
            ticker.clone()
        } else {
            format!("{}.BA", ticker)
        };

        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=1d",
            symbol
        );

        let resp = client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("No se pudo conectar a Yahoo Finance: {e}"))?;

        let text = resp
            .text()
            .await
            .map_err(|e| format!("Error leyendo respuesta para {ticker}: {e}"))?;

        let data: ChartResponse = serde_json::from_str(&text)
            .map_err(|e| format!("Error procesando datos de {ticker}: {e}"))?;

        if let Some(chart_results) = data.chart.result {
            if let Some(first) = chart_results.into_iter().next() {
                let meta = first.meta;
                results.push(PriceResult {
                    ticker:       meta.symbol.replace(".BA", ""),
                    price_ars:    meta.regular_market_price,
                    currency:     meta.currency.unwrap_or_else(|| "ARS".to_string()),
                    market_state: meta.exchange_name.unwrap_or_else(|| "BUE".to_string()),
                });
            }
        }
    }

    Ok(results)
}

/// Fetch current Dólar CCL rate from dolarapi.com (free, no key needed).
#[tauri::command]
pub async fn fetch_ccl() -> Result<f64, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://dolarapi.com/v1/dolares/contadoconliqui")
        .send()
        .await
        .map_err(|e| format!("No se pudo obtener el dólar CCL: {e}"))?;

    let data: DolarResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al leer tipo de cambio CCL: {e}"))?;

    Ok(data.venta)
}

/// Update current_price_ars (and optionally current_ccl) for all investment rows matching each ticker.
#[tauri::command]
pub async fn update_prices_by_ticker(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    updates: Vec<PriceUpdate>,
    current_ccl: Option<f64>,
) -> Result<u32, String> {
    let now = Utc::now().to_rfc3339();
    let mut count: u32 = 0;

    for u in &updates {
        let rows = match current_ccl {
            Some(ccl) if ccl > 0.0 => sqlx::query(
                "UPDATE investment_entries
                 SET current_price_ars = ?,
                     current_value = CASE
                       WHEN quantity IS NOT NULL
                       THEN (? * quantity) / ?
                       ELSE current_value
                     END,
                     updated_at = ?
                 WHERE profile_id = ? AND (ticker = ? OR name = ?)",
            )
            .bind(u.price_ars)
            .bind(u.price_ars)
            .bind(ccl)
            .bind(&now)
            .bind(&profile_id)
            .bind(&u.ticker)
            .bind(&u.ticker)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?,

            _ => sqlx::query(
                "UPDATE investment_entries
                 SET current_price_ars = ?,
                     current_value = CASE
                       WHEN quantity IS NOT NULL AND dolar_ccl IS NOT NULL AND dolar_ccl > 0
                       THEN (? * quantity) / dolar_ccl
                       ELSE current_value
                     END,
                     updated_at = ?
                 WHERE profile_id = ? AND (ticker = ? OR name = ?)",
            )
            .bind(u.price_ars)
            .bind(u.price_ars)
            .bind(&now)
            .bind(&profile_id)
            .bind(&u.ticker)
            .bind(&u.ticker)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?,
        };

        count += rows.rows_affected() as u32;
    }

    Ok(count)
}

#[derive(Debug, Deserialize)]
pub struct PriceUpdate {
    pub ticker: String,
    pub price_ars: f64,
}
