use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::Manager;

const DEFAULT_INVERSIONES_API_URL: &str = "http://localhost:3001";
const DB_FILE_NAME: &str = "inversiones.db";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct InversionesIntegrationConfig {
    db_path: Option<String>,
    api_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InversionesIntegrationSettings {
    pub db_path: Option<String>,
    pub api_url: Option<String>,
    pub resolved_db_path: Option<String>,
    pub resolved_api_url: String,
    pub candidate_db_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InversionesIntegrationTestResult {
    pub db_ok: bool,
    pub api_ok: bool,
    pub resolved_db_path: Option<String>,
    pub resolved_api_url: String,
    pub db_message: String,
    pub api_message: String,
    pub active_signals: Option<i64>,
    pub instruments: Option<i64>,
    pub api_status_code: Option<u16>,
    pub candidate_db_paths: Vec<String>,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de datos: {}", e))?;
    Ok(app_dir.join("inversiones_integration.json"))
}

fn read_config(app: &tauri::AppHandle) -> InversionesIntegrationConfig {
    let path = match config_path(app) {
        Ok(path) => path,
        Err(_) => return InversionesIntegrationConfig::default(),
    };

    if !path.exists() {
        return InversionesIntegrationConfig::default();
    }

    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<InversionesIntegrationConfig>(&content).ok())
        .unwrap_or_default()
}

fn save_config(
    app: &tauri::AppHandle,
    config: &InversionesIntegrationConfig,
) -> Result<(), String> {
    let path = config_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "No se pudo resolver la carpeta de configuración.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_api_url(value: Option<String>) -> Option<String> {
    normalize_optional_string(value).map(|raw| raw.trim_end_matches('/').to_string())
}

fn validate_db_path(path: Option<String>) -> Result<Option<String>, String> {
    let normalized = normalize_optional_string(path);
    let Some(path) = normalized.clone() else {
        return Ok(None);
    };

    let buf = PathBuf::from(&path);
    match buf.extension().and_then(|ext| ext.to_str()) {
        Some("db") => {}
        _ => return Err("La ruta de la base debe terminar en .db".to_string()),
    }

    if buf.is_dir() {
        return Err(
            "La ruta de la base apunta a una carpeta. Incluí el archivo inversiones.db."
                .to_string(),
        );
    }

    if let Some(parent) = buf.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!(
                "La carpeta configurada no existe: {}",
                parent.display()
            ));
        }
    }

    Ok(Some(path))
}

fn validate_api_url(url: Option<String>) -> Result<Option<String>, String> {
    let normalized = normalize_api_url(url);
    let Some(url) = normalized.clone() else {
        return Ok(None);
    };

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("La URL de Inversiones AR debe empezar con http:// o https://".to_string());
    }

    Ok(Some(url))
}

fn push_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if candidate.as_os_str().is_empty() || paths.iter().any(|existing| existing == &candidate) {
        return;
    }
    paths.push(candidate);
}

fn push_unique_string(values: &mut Vec<String>, candidate: String) {
    if candidate.trim().is_empty() || values.iter().any(|existing| existing == &candidate) {
        return;
    }
    values.push(candidate);
}

fn register_common_db_locations(base: &Path, paths: &mut Vec<PathBuf>) {
    let known_dirs = [
        "Inversiones",
        "Inversiones AR",
        "inversiones",
        "inversiones-ar",
        "inversiones_signals",
        "inversiones-signals",
        "Inversiones Signals",
        "com.inversiones.signals",
    ];

    for dir_name in known_dirs {
        let base_dir = base.join(dir_name);
        push_unique_path(paths, base_dir.join("data").join(DB_FILE_NAME));
        push_unique_path(
            paths,
            base_dir.join("resources").join("data").join(DB_FILE_NAME),
        );
        push_unique_path(paths, base_dir.join(DB_FILE_NAME));
    }

    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_dir() {
                continue;
            }

            let lower = entry.file_name().to_string_lossy().to_lowercase();
            if !lower.contains("inversion") {
                continue;
            }

            let dir = entry.path();
            push_unique_path(paths, dir.join("data").join(DB_FILE_NAME));
            push_unique_path(paths, dir.join("resources").join("data").join(DB_FILE_NAME));
            push_unique_path(paths, dir.join(DB_FILE_NAME));
        }
    }
}

fn candidate_db_paths(app: &tauri::AppHandle, override_db_path: Option<&str>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let config = read_config(app);

    if let Ok(explicit) = env::var("INVERSIONES_AR_DB_PATH") {
        if let Some(explicit) = normalize_optional_string(Some(explicit)) {
            push_unique_path(&mut paths, PathBuf::from(explicit));
        }
    }

    if let Some(override_db_path) = normalize_optional_string(override_db_path.map(str::to_string))
    {
        push_unique_path(&mut paths, PathBuf::from(override_db_path));
    }

    if let Some(saved) = normalize_optional_string(config.db_path) {
        push_unique_path(&mut paths, PathBuf::from(saved));
    }

    push_unique_path(
        &mut paths,
        PathBuf::from("E:/Proyectos/Inversiones/data/inversiones.db"),
    );

    if let Ok(current_dir) = env::current_dir() {
        push_unique_path(&mut paths, current_dir.join("data").join(DB_FILE_NAME));
        push_unique_path(
            &mut paths,
            current_dir
                .join("..")
                .join("Inversiones")
                .join("data")
                .join(DB_FILE_NAME),
        );
        push_unique_path(
            &mut paths,
            current_dir
                .join("..")
                .join("..")
                .join("Inversiones")
                .join("data")
                .join(DB_FILE_NAME),
        );
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            push_unique_path(&mut paths, exe_dir.join("data").join(DB_FILE_NAME));
            push_unique_path(
                &mut paths,
                exe_dir.join("resources").join("data").join(DB_FILE_NAME),
            );
            push_unique_path(
                &mut paths,
                exe_dir
                    .join("..")
                    .join("resources")
                    .join("data")
                    .join(DB_FILE_NAME),
            );
            push_unique_path(
                &mut paths,
                exe_dir
                    .join("..")
                    .join("Inversiones")
                    .join("data")
                    .join(DB_FILE_NAME),
            );
        }
    }

    for env_key in ["LOCALAPPDATA", "APPDATA"] {
        if let Some(base) = env::var_os(env_key).map(PathBuf::from) {
            register_common_db_locations(&base, &mut paths);
            register_common_db_locations(&base.join("Programs"), &mut paths);
        }
    }

    paths
}

fn resolve_db_path(
    app: &tauri::AppHandle,
    override_db_path: Option<&str>,
) -> Result<PathBuf, String> {
    let candidates = candidate_db_paths(app, override_db_path);

    candidates
        .iter()
        .find(|path| path.is_file())
        .cloned()
        .ok_or_else(|| {
            let searched = candidates
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join(" | ");
            format!(
                "No se encontró la base de datos de Inversiones AR. Revisá la ruta configurada o usá Autodetectar. Busqué en: {}",
                searched
            )
        })
}

fn candidate_api_urls(app: &tauri::AppHandle, override_api_url: Option<&str>) -> Vec<String> {
    let mut urls = Vec::new();
    let config = read_config(app);

    if let Some(override_url) = normalize_api_url(override_api_url.map(str::to_string)) {
        push_unique_string(&mut urls, override_url);
    }

    if let Ok(explicit) = env::var("INVERSIONES_AR_URL") {
        if let Some(explicit) = normalize_api_url(Some(explicit)) {
            push_unique_string(&mut urls, explicit);
        }
    }

    if let Some(saved) = normalize_api_url(config.api_url) {
        push_unique_string(&mut urls, saved);
    }

    push_unique_string(&mut urls, DEFAULT_INVERSIONES_API_URL.to_string());
    push_unique_string(&mut urls, "http://127.0.0.1:3001".to_string());

    urls
}

pub fn resolve_inversiones_api_base_url(app: &tauri::AppHandle) -> String {
    candidate_api_urls(app, None)
        .into_iter()
        .next()
        .unwrap_or_else(|| DEFAULT_INVERSIONES_API_URL.to_string())
}

fn sqlite_readonly_url(path: &Path) -> String {
    format!(
        "sqlite://{}?mode=ro",
        path.to_string_lossy().replace('\\', "/")
    )
}

pub async fn open_inversiones_db(app: &tauri::AppHandle) -> Result<SqlitePool, String> {
    let db_path = resolve_db_path(app, None)?;
    let db_url = sqlite_readonly_url(&db_path);
    SqlitePool::connect(&db_url).await.map_err(|e| {
        format!(
            "No se pudo abrir la base de datos de Inversiones AR en {}: {}",
            db_path.display(),
            e
        )
    })
}

fn settings_snapshot(app: &tauri::AppHandle) -> InversionesIntegrationSettings {
    let config = read_config(app);
    let candidate_db_paths = candidate_db_paths(app, None)
        .into_iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>();

    InversionesIntegrationSettings {
        db_path: normalize_optional_string(config.db_path),
        api_url: normalize_api_url(config.api_url),
        resolved_db_path: resolve_db_path(app, None)
            .ok()
            .map(|path| path.display().to_string()),
        resolved_api_url: resolve_inversiones_api_base_url(app),
        candidate_db_paths,
    }
}

async fn test_api_health(api_url: &str) -> Result<(Option<u16>, String), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(format!("{}/api/health", api_url))
        .send()
        .await
        .map_err(|e| format!("No se pudo conectar con {}: {}", api_url, e))?;

    let status = response.status();
    let code = Some(status.as_u16());
    if !status.is_success() {
        return Err(format!(
            "La API respondió {} en {}/api/health",
            status.as_u16(),
            api_url
        ));
    }

    Ok((code, format!("API disponible en {}", api_url)))
}

#[tauri::command]
pub async fn get_inversiones_integration_settings(
    app: tauri::AppHandle,
) -> Result<InversionesIntegrationSettings, String> {
    Ok(settings_snapshot(&app))
}

#[tauri::command]
pub async fn save_inversiones_integration_settings(
    app: tauri::AppHandle,
    db_path: Option<String>,
    api_url: Option<String>,
) -> Result<InversionesIntegrationSettings, String> {
    let config = InversionesIntegrationConfig {
        db_path: validate_db_path(db_path)?,
        api_url: validate_api_url(api_url)?,
    };

    save_config(&app, &config)?;
    Ok(settings_snapshot(&app))
}

#[tauri::command]
pub async fn reset_inversiones_integration_settings(
    app: tauri::AppHandle,
) -> Result<InversionesIntegrationSettings, String> {
    save_config(&app, &InversionesIntegrationConfig::default())?;
    Ok(settings_snapshot(&app))
}

#[tauri::command]
pub async fn autodetect_inversiones_integration(
    app: tauri::AppHandle,
) -> Result<InversionesIntegrationSettings, String> {
    let detected_db_path = resolve_db_path(&app, None)
        .ok()
        .map(|path| path.display().to_string());

    let mut detected_api_url = None;
    for candidate in candidate_api_urls(&app, None) {
        if test_api_health(&candidate).await.is_ok() {
            detected_api_url = Some(candidate);
            break;
        }
    }

    let config = InversionesIntegrationConfig {
        db_path: detected_db_path,
        api_url: detected_api_url,
    };

    save_config(&app, &config)?;
    Ok(settings_snapshot(&app))
}

#[tauri::command]
pub async fn test_inversiones_integration(
    app: tauri::AppHandle,
    db_path: Option<String>,
    api_url: Option<String>,
) -> Result<InversionesIntegrationTestResult, String> {
    let db_path = validate_db_path(db_path)?;
    let api_url = validate_api_url(api_url)?;
    let resolved_api_url = candidate_api_urls(&app, api_url.as_deref())
        .into_iter()
        .next()
        .unwrap_or_else(|| DEFAULT_INVERSIONES_API_URL.to_string());

    let mut result = InversionesIntegrationTestResult {
        db_ok: false,
        api_ok: false,
        resolved_db_path: None,
        resolved_api_url: resolved_api_url.clone(),
        db_message: "Base sin verificar.".to_string(),
        api_message: "API sin verificar.".to_string(),
        active_signals: None,
        instruments: None,
        api_status_code: None,
        candidate_db_paths: candidate_db_paths(&app, db_path.as_deref())
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
    };

    match resolve_db_path(&app, db_path.as_deref()) {
        Ok(path) => {
            result.resolved_db_path = Some(path.display().to_string());
            let db_url = sqlite_readonly_url(&path);
            match SqlitePool::connect(&db_url).await {
                Ok(pool) => {
                    let active_signals = sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM signals WHERE active = 1",
                    )
                    .fetch_one(&pool)
                    .await;
                    let instruments = sqlx::query_scalar::<_, i64>(
                        "SELECT COUNT(*) FROM instruments WHERE active = 1",
                    )
                    .fetch_one(&pool)
                    .await;

                    match (active_signals, instruments) {
                        (Ok(active_signals), Ok(instruments)) => {
                            result.db_ok = true;
                            result.active_signals = Some(active_signals);
                            result.instruments = Some(instruments);
                            result.db_message = format!("Base disponible en {}", path.display());
                        }
                        (Err(error), _) | (_, Err(error)) => {
                            result.db_message = format!(
                                "La base abrió, pero falló la lectura de tablas: {}",
                                error
                            );
                        }
                    }

                    pool.close().await;
                }
                Err(error) => {
                    result.db_message = format!(
                        "No se pudo abrir la base configurada en {}: {}",
                        path.display(),
                        error
                    );
                }
            }
        }
        Err(error) => {
            result.db_message = error;
        }
    }

    match test_api_health(&resolved_api_url).await {
        Ok((status_code, message)) => {
            result.api_ok = true;
            result.api_status_code = status_code;
            result.api_message = message;
        }
        Err(error) => {
            result.api_status_code = None;
            result.api_message = error;
        }
    }

    Ok(result)
}
