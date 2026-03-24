use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
struct DbConfig {
    custom_db_path: Option<String>,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de datos: {}", e))?;
    Ok(app_dir.join("db_config.json"))
}

pub fn get_custom_db_path(app: &tauri::AppHandle) -> Option<String> {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return None,
    };
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(cfg) = serde_json::from_str::<DbConfig>(&content) {
                return cfg.custom_db_path;
            }
        }
    }
    None
}

pub fn save_custom_db_path(app: &tauri::AppHandle, new_path: Option<String>) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let cfg = DbConfig { custom_db_path: new_path };
    let content = serde_json::to_string(&cfg).map_err(|e| e.to_string())?;
    let path = config_path(app)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn default_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de datos: {}", e))?;
    fs::create_dir_all(&app_dir).map_err(|e| format!("no se pudo crear el directorio de datos: {}", e))?;
    Ok(app_dir.join("finanzas.db"))
}

pub async fn init_db(app: &tauri::AppHandle) -> Result<SqlitePool, String> {
    let db_path = match get_custom_db_path(app) {
        Some(p) => PathBuf::from(p),
        None => default_db_path(app)?,
    };

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("no se pudo crear la carpeta de la base de datos: {}", e))?;
    }

    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| format!("error al conectar con la base de datos: {}", e))?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("error al ejecutar migraciones: {}", e))?;

    Ok(pool)
}
