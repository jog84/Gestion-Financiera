use chrono::Utc;
use futures::future::join_all;
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

fn normalize_tickers(tickers: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();

    tickers
        .into_iter()
        .filter_map(|ticker| {
            let normalized = ticker.trim().to_uppercase();
            if normalized.is_empty() || !seen.insert(normalized.clone()) {
                None
            } else {
                Some(normalized)
            }
        })
        .collect()
}

fn yahoo_symbol(ticker: &str) -> String {
    if ticker.contains('.') {
        ticker.to_string()
    } else {
        format!("{}.BA", ticker)
    }
}

async fn fetch_single_price(
    client: &reqwest::Client,
    ticker: String,
) -> Result<PriceResult, String> {
    let symbol = yahoo_symbol(&ticker);
    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=1d",
        symbol
    );

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("{ticker}: no se pudo conectar a Yahoo Finance: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "{ticker}: Yahoo Finance respondió {}",
            resp.status()
        ));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("{ticker}: error leyendo respuesta: {e}"))?;

    let data: ChartResponse = serde_json::from_str(&text)
        .map_err(|e| format!("{ticker}: error procesando datos: {e}"))?;

    let meta = data
        .chart
        .result
        .and_then(|mut results| results.drain(..).next())
        .map(|result| result.meta)
        .ok_or_else(|| format!("{ticker}: Yahoo Finance no devolvió cotización"))?;

    Ok(PriceResult {
        ticker: meta.symbol.replace(".BA", ""),
        price_ars: meta.regular_market_price,
        currency: meta.currency.unwrap_or_else(|| "ARS".to_string()),
        market_state: meta.exchange_name.unwrap_or_else(|| "BUE".to_string()),
    })
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Fetch current ARS prices from Yahoo Finance for a list of CEDEAR tickers.
/// Uses the /v8/finance/chart endpoint (one request per ticker, concurrent).
#[tauri::command]
pub async fn fetch_prices(tickers: Vec<String>) -> Result<Vec<PriceResult>, String> {
    let normalized = normalize_tickers(tickers);

    if normalized.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let responses = join_all(
        normalized
            .into_iter()
            .map(|ticker| fetch_single_price(&client, ticker)),
    )
    .await;

    let mut results: Vec<PriceResult> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    for response in responses {
        match response {
            Ok(price) => results.push(price),
            Err(error) => errors.push(error),
        }
    }

    if results.is_empty() {
        return Err(format!(
            "No se pudieron obtener precios para ningún ticker. {}",
            errors.join(" | ")
        ));
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
                 WHERE profile_id = ? AND transaction_kind = 'buy' AND (ticker = ? OR name = ?)",
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
                 WHERE profile_id = ? AND transaction_kind = 'buy' AND (ticker = ? OR name = ?)",
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
