use serde::Serialize;
use sqlx::SqlitePool;

// ─── Tipo público que se devuelve al frontend ─────────────────────────────────

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

// Fila raw de SQLite
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
    reasoning: String, // JSON string "[]"
    max_position_size_pct: f64,
    risk_reward_ratio: f64,
    generated_at: String,
    expires_at: String,
    is_stale: i64,
    execution_ready: i64,
    data_quality: String,
}

// Ruta fija al SQLite de Inversiones AR
const INVERSIONES_DB_PATH: &str = "E:/Proyectos/Inversiones/data/inversiones.db";

// ─── Command ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_inversiones_signals() -> Result<Vec<InversionesSignal>, String> {
    let db_url = format!("sqlite://{}?mode=ro", INVERSIONES_DB_PATH);

    let pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|_| "No se encontró la base de datos de Inversiones AR. Verificá que la app esté instalada.".to_string())?;

    let rows: Vec<SignalRow> = sqlx::query_as::<_, SignalRow>(
        r#"
        SELECT
            id, ticker, instrument_name, asset_class, signal_type,
            entry_price, entry_price_usd, stop_loss, stop_loss_percent,
            take_profit1, take_profit1_percent, take_profit2, take_profit2_percent,
            strength, confidence_score, reasoning, max_position_size_pct,
            risk_reward_ratio, generated_at, expires_at,
            is_stale, execution_ready, data_quality
        FROM signals
        WHERE active = 1
          AND signal_type IN ('COMPRA', 'VENTA')
        ORDER BY confidence_score DESC
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Error al leer señales: {}", e))?;

    pool.close().await;

    let signals = rows
        .into_iter()
        .map(|r| {
            let reasoning: Vec<String> =
                serde_json::from_str(&r.reasoning).unwrap_or_default();
            InversionesSignal {
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
            }
        })
        .collect();

    Ok(signals)
}
