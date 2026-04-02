use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

// Ruta fija al SQLite de Inversiones AR
const INVERSIONES_DB_PATH: &str = "E:/Proyectos/Inversiones/data/inversiones.db";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct InversionesSignal {
    pub id: String,
    pub ticker: String,
    pub instrument_name: String,
    pub asset_class: String,
    pub signal_type: String,
    pub entry_price: f64,
    pub entry_price_usd: Option<f64>,
    pub stop_loss: f64,
    pub stop_loss_percent: f64,
    pub take_profit1: f64,
    pub take_profit1_percent: f64,
    pub take_profit2: f64,
    pub take_profit2_percent: f64,
    pub strength: i64,
    pub confidence_score: f64,
    pub reasoning: Vec<String>,
    pub max_position_size_pct: f64,
    pub risk_reward_ratio: f64,
    pub generated_at: String,
    pub expires_at: String,
    pub is_stale: bool,
    pub execution_ready: bool,
    pub data_quality: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TickerTechnicals {
    pub rsi14: Option<f64>,
    pub macd: Option<f64>,
    pub macd_signal: Option<f64>,
    pub macd_histogram: Option<f64>,
    pub bb_upper: Option<f64>,
    pub bb_middle: Option<f64>,
    pub bb_lower: Option<f64>,
    pub ema20: Option<f64>,
    pub ema50: Option<f64>,
    pub ema200: Option<f64>,
    pub atr14: Option<f64>,
    pub adx14: Option<f64>,
    pub plus_di: Option<f64>,
    pub minus_di: Option<f64>,
    pub support_level: Option<f64>,
    pub resistance_level: Option<f64>,
    pub rsi_divergence: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PriceBar {
    pub timestamp: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct TickerAnalysis {
    pub ticker: String,
    pub instrument_name: String,
    pub asset_class: String,
    pub current_price: Option<f64>,
    pub signal: Option<InversionesSignal>,
    pub technicals: Option<TickerTechnicals>,
    pub price_history: Vec<PriceBar>,
    pub macro_snapshot: Option<serde_json::Value>,
}

// ─── Filas raw de SQLite ──────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct SignalRow {
    id: String,
    ticker: String,
    instrument_name: String,
    asset_class: String,
    signal_type: String,
    entry_price: f64,
    entry_price_usd: Option<f64>,
    stop_loss: f64,
    stop_loss_percent: f64,
    take_profit1: f64,
    take_profit1_percent: f64,
    take_profit2: f64,
    take_profit2_percent: f64,
    strength: i64,
    confidence_score: f64,
    reasoning: String,
    max_position_size_pct: f64,
    risk_reward_ratio: f64,
    generated_at: String,
    expires_at: String,
    is_stale: i64,
    execution_ready: i64,
    data_quality: String,
    macro_snapshot: Option<String>,
}

#[derive(sqlx::FromRow)]
struct TechRow {
    rsi14: Option<f64>,
    macd: Option<f64>,
    macd_signal: Option<f64>,
    macd_histogram: Option<f64>,
    bb_upper: Option<f64>,
    bb_middle: Option<f64>,
    bb_lower: Option<f64>,
    ema20: Option<f64>,
    ema50: Option<f64>,
    ema200: Option<f64>,
    atr14: Option<f64>,
    adx14: Option<f64>,
    plus_di: Option<f64>,
    minus_di: Option<f64>,
    support_level: Option<f64>,
    resistance_level: Option<f64>,
    rsi_divergence: Option<String>,
    timestamp: String,
}

#[derive(sqlx::FromRow)]
struct PriceRow {
    timestamp: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
}

#[derive(sqlx::FromRow)]
struct InstrumentRow {
    ticker: String,
    name: String,
    asset_class: String,
}

// ─── Helper ───────────────────────────────────────────────────────────────────

fn row_to_signal(r: SignalRow) -> (InversionesSignal, Option<serde_json::Value>) {
    let reasoning: Vec<String> = serde_json::from_str(&r.reasoning).unwrap_or_default();
    let macro_snap: Option<serde_json::Value> = r
        .macro_snapshot
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());
    let signal = InversionesSignal {
        id: r.id,
        ticker: r.ticker,
        instrument_name: r.instrument_name,
        asset_class: r.asset_class,
        signal_type: r.signal_type,
        entry_price: r.entry_price,
        entry_price_usd: r.entry_price_usd,
        stop_loss: r.stop_loss,
        stop_loss_percent: r.stop_loss_percent,
        take_profit1: r.take_profit1,
        take_profit1_percent: r.take_profit1_percent,
        take_profit2: r.take_profit2,
        take_profit2_percent: r.take_profit2_percent,
        strength: r.strength,
        confidence_score: r.confidence_score,
        reasoning,
        max_position_size_pct: r.max_position_size_pct,
        risk_reward_ratio: r.risk_reward_ratio,
        generated_at: r.generated_at,
        expires_at: r.expires_at,
        is_stale: r.is_stale != 0,
        execution_ready: r.execution_ready != 0,
        data_quality: r.data_quality,
    };
    (signal, macro_snap)
}

async fn open_db() -> Result<SqlitePool, String> {
    let db_url = format!("sqlite://{}?mode=ro", INVERSIONES_DB_PATH);
    SqlitePool::connect(&db_url)
        .await
        .map_err(|_| "No se encontró la base de datos de Inversiones AR.".to_string())
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_inversiones_signals() -> Result<Vec<InversionesSignal>, String> {
    let pool = open_db().await?;

    let rows: Vec<SignalRow> = sqlx::query_as::<_, SignalRow>(
        r#"
        SELECT id, ticker, instrument_name, asset_class, signal_type,
               entry_price, entry_price_usd, stop_loss, stop_loss_percent,
               take_profit1, take_profit1_percent, take_profit2, take_profit2_percent,
               strength, confidence_score, reasoning, max_position_size_pct,
               risk_reward_ratio, generated_at, expires_at,
               is_stale, execution_ready, data_quality, macro_snapshot
        FROM signals
        WHERE active = 1 AND signal_type IN ('COMPRA', 'VENTA')
        ORDER BY confidence_score DESC
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Error al leer señales: {}", e))?;

    pool.close().await;
    Ok(rows.into_iter().map(|r| row_to_signal(r).0).collect())
}

#[tauri::command]
pub async fn fetch_ticker_analysis(ticker: String) -> Result<TickerAnalysis, String> {
    let pool = open_db().await?;
    let t = ticker.to_uppercase();

    // Instrumento base
    let instr: Option<InstrumentRow> = sqlx::query_as::<_, InstrumentRow>(
        "SELECT ticker, name, asset_class FROM instruments WHERE ticker = ? AND active = 1",
    )
    .bind(&t)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let (instrument_name, asset_class) = instr
        .map(|i| (i.name, i.asset_class))
        .unwrap_or_else(|| (t.clone(), "DESCONOCIDO".to_string()));

    // Precio actual (última barra)
    let current_price: Option<f64> = sqlx::query_scalar::<_, f64>(
        "SELECT close FROM price_history WHERE ticker = ? ORDER BY timestamp DESC LIMIT 1",
    )
    .bind(&t)
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    // Señal activa
    let signal_row: Option<SignalRow> = sqlx::query_as::<_, SignalRow>(
        r#"
        SELECT id, ticker, instrument_name, asset_class, signal_type,
               entry_price, entry_price_usd, stop_loss, stop_loss_percent,
               take_profit1, take_profit1_percent, take_profit2, take_profit2_percent,
               strength, confidence_score, reasoning, max_position_size_pct,
               risk_reward_ratio, generated_at, expires_at,
               is_stale, execution_ready, data_quality, macro_snapshot
        FROM signals
        WHERE ticker = ? AND active = 1
        ORDER BY generated_at DESC LIMIT 1
        "#,
    )
    .bind(&t)
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    let (signal, macro_snapshot) = match signal_row {
        Some(r) => {
            let (s, m) = row_to_signal(r);
            (Some(s), m)
        }
        None => (None, None),
    };

    // Indicadores técnicos
    let tech_row: Option<TechRow> = sqlx::query_as::<_, TechRow>(
        r#"
        SELECT rsi14, macd, macd_signal, macd_histogram,
               bb_upper, bb_middle, bb_lower,
               ema20, ema50, ema200, atr14, adx14, plus_di, minus_di,
               support_level, resistance_level, rsi_divergence, timestamp
        FROM technical_indicators
        WHERE ticker = ?
        ORDER BY timestamp DESC LIMIT 1
        "#,
    )
    .bind(&t)
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    let technicals = tech_row.map(|r| TickerTechnicals {
        rsi14: r.rsi14,
        macd: r.macd,
        macd_signal: r.macd_signal,
        macd_histogram: r.macd_histogram,
        bb_upper: r.bb_upper,
        bb_middle: r.bb_middle,
        bb_lower: r.bb_lower,
        ema20: r.ema20,
        ema50: r.ema50,
        ema200: r.ema200,
        atr14: r.atr14,
        adx14: r.adx14,
        plus_di: r.plus_di,
        minus_di: r.minus_di,
        support_level: r.support_level,
        resistance_level: r.resistance_level,
        rsi_divergence: r.rsi_divergence,
        timestamp: r.timestamp,
    });

    // Historial de precios (últimas 90 barras)
    let price_rows: Vec<PriceRow> = sqlx::query_as::<_, PriceRow>(
        r#"
        SELECT timestamp, open, high, low, close, volume
        FROM price_history
        WHERE ticker = ? AND is_mock = 0
        ORDER BY timestamp DESC LIMIT 90
        "#,
    )
    .bind(&t)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let mut price_history: Vec<PriceBar> = price_rows
        .into_iter()
        .map(|r| PriceBar {
            timestamp: r.timestamp,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            volume: r.volume,
        })
        .collect();
    price_history.reverse(); // orden cronológico

    pool.close().await;

    Ok(TickerAnalysis {
        ticker: t,
        instrument_name,
        asset_class,
        current_price,
        signal,
        technicals,
        price_history,
        macro_snapshot,
    })
}

// ─── Agregar ticker a Inversiones AR via HTTP ─────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct AddTickerResult {
    pub ticker: String,
    pub has_price: bool,
    pub bars_count: i64,
    pub has_technicals: bool,
    pub has_signal: bool,
}

#[derive(Debug, Deserialize)]
struct AddTickerApiResponse {
    success: bool,
    data: Option<AddTickerApiData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddTickerApiData {
    ticker: String,
    has_price: Option<bool>,
    bars_count: Option<i64>,
    has_technicals: Option<bool>,
    has_signal: Option<bool>,
}

#[tauri::command]
pub async fn add_ticker_to_inversiones(
    ticker: String,
    asset_class: String,
) -> Result<AddTickerResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "ticker": ticker.to_uppercase().trim(),
        "assetClass": asset_class,
        "name": ticker.to_uppercase().trim(),
    });

    let resp = client
        .post("http://localhost:3001/api/instruments/add")
        .json(&body)
        .send()
        .await
        .map_err(|_| "Inversiones AR no está corriendo. Iniciá la app primero.".to_string())?;

    let parsed: AddTickerApiResponse = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta: {}", e))?;

    if !parsed.success {
        return Err(parsed.error.unwrap_or_else(|| "Error desconocido".to_string()));
    }

    let d = parsed.data.ok_or("Respuesta vacía")?;
    Ok(AddTickerResult {
        ticker: d.ticker,
        has_price: d.has_price.unwrap_or(false),
        bars_count: d.bars_count.unwrap_or(0),
        has_technicals: d.has_technicals.unwrap_or(false),
        has_signal: d.has_signal.unwrap_or(false),
    })
}

// ─── Buscar tickers existentes en Inversiones AR ──────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InversionesInstrument {
    pub ticker: String,
    pub name: String,
    pub asset_class: String,
}

#[tauri::command]
pub async fn search_inversiones_instruments(query: String) -> Result<Vec<InversionesInstrument>, String> {
    let pool = open_db().await?;
    let pattern = format!("%{}%", query.to_uppercase());

    let rows: Vec<InversionesInstrument> = sqlx::query_as::<_, InversionesInstrument>(
        r#"
        SELECT ticker, name, asset_class
        FROM instruments
        WHERE active = 1 AND (ticker LIKE ? OR UPPER(name) LIKE ?)
        ORDER BY ticker ASC LIMIT 20
        "#,
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    pool.close().await;
    Ok(rows)
}
