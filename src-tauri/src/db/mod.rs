use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Default)]
struct DbConfig {
    custom_db_path: Option<String>,
}

const AUTO_BACKUP_PREFIX: &str = "finanzas_auto_";
const MANUAL_BACKUP_PREFIX: &str = "finanzas_manual_";
const AUTO_BACKUP_KEEP_COUNT: usize = 14;
const MANUAL_BACKUP_KEEP_COUNT: usize = 10;

#[derive(Debug, Clone, Serialize)]
pub struct DbBackupInfo {
    pub file_name: String,
    pub full_path: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub kind: String,
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
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let cfg = DbConfig {
        custom_db_path: new_path,
    };
    let content = serde_json::to_string(&cfg).map_err(|e| e.to_string())?;
    let path = config_path(app)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn default_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de datos: {}", e))?;
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("no se pudo crear el directorio de datos: {}", e))?;
    Ok(app_dir.join("finanzas.db"))
}

pub fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de backups: {}", e))?;
    let dir = app_dir.join("backups");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("no se pudo crear la carpeta de backups: {}", e))?;
    Ok(dir)
}

fn backup_kind(file_name: &str) -> Option<&'static str> {
    if file_name.starts_with(AUTO_BACKUP_PREFIX) {
        Some("auto")
    } else if file_name.starts_with(MANUAL_BACKUP_PREFIX) {
        Some("manual")
    } else {
        None
    }
}

fn backup_prefix(kind: &str) -> &'static str {
    match kind {
        "manual" => MANUAL_BACKUP_PREFIX,
        _ => AUTO_BACKUP_PREFIX,
    }
}

fn escape_sqlite_path(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

fn metadata_to_backup_info(path: PathBuf) -> Option<DbBackupInfo> {
    let metadata = fs::metadata(&path).ok()?;
    if !metadata.is_file() {
        return None;
    }

    let file_name = path.file_name()?.to_string_lossy().to_string();
    let kind = backup_kind(&file_name)?.to_string();
    let created_at = metadata
        .modified()
        .ok()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();

    Some(DbBackupInfo {
        file_name,
        full_path: path.to_string_lossy().to_string(),
        created_at,
        size_bytes: metadata.len(),
        kind,
    })
}

pub fn list_db_backups(app: &tauri::AppHandle) -> Result<Vec<DbBackupInfo>, String> {
    let dir = backup_dir(app)?;
    let mut backups = fs::read_dir(dir)
        .map_err(|e| format!("no se pudo leer la carpeta de backups: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| metadata_to_backup_info(entry.path()))
        .collect::<Vec<_>>();

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

fn cleanup_old_backups(app: &tauri::AppHandle) {
    let Ok(backups) = list_db_backups(app) else {
        return;
    };

    let auto_backups = backups
        .iter()
        .filter(|backup| backup.kind == "auto")
        .skip(AUTO_BACKUP_KEEP_COUNT)
        .map(|backup| backup.full_path.clone())
        .collect::<Vec<_>>();

    let manual_backups = backups
        .iter()
        .filter(|backup| backup.kind == "manual")
        .skip(MANUAL_BACKUP_KEEP_COUNT)
        .map(|backup| backup.full_path.clone())
        .collect::<Vec<_>>();

    for path in auto_backups.into_iter().chain(manual_backups) {
        if let Err(error) = fs::remove_file(&path) {
            eprintln!("No se pudo eliminar backup viejo {}: {}", path, error);
        }
    }
}

pub async fn create_db_backup(
    pool: &SqlitePool,
    app: &tauri::AppHandle,
    kind: &str,
) -> Result<DbBackupInfo, String> {
    let dir = backup_dir(app)?;
    let now = Utc::now();
    let file_name = format!("{}{}.db", backup_prefix(kind), now.format("%Y%m%d_%H%M%S"));
    let full_path = dir.join(file_name);
    let escaped = escape_sqlite_path(&full_path);

    sqlx::query(&format!("VACUUM INTO '{}'", escaped))
        .execute(pool)
        .await
        .map_err(|e| format!("no se pudo generar el backup: {}", e))?;

    cleanup_old_backups(app);

    metadata_to_backup_info(full_path)
        .ok_or_else(|| "el backup se creó pero no se pudo leer su metadata".to_string())
}

pub async fn ensure_daily_automatic_backup(pool: &SqlitePool, app: &tauri::AppHandle) {
    let today_prefix = format!("{}{}", AUTO_BACKUP_PREFIX, Utc::now().format("%Y%m%d"));

    let already_exists = list_db_backups(app)
        .map(|backups| {
            backups
                .iter()
                .any(|backup| backup.file_name.starts_with(&today_prefix))
        })
        .unwrap_or(false);

    if already_exists {
        return;
    }

    if let Err(error) = create_db_backup(pool, app, "auto").await {
        eprintln!("No se pudo generar el backup automático diario: {}", error);
    }
}

async fn connect_and_migrate(db_path: &PathBuf) -> Result<SqlitePool, String> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("no se pudo crear la carpeta de la base de datos: {}", e))?;
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

pub async fn init_db(app: &tauri::AppHandle) -> Result<SqlitePool, String> {
    if let Some(custom_path) = get_custom_db_path(app) {
        let custom_db_path = PathBuf::from(&custom_path);
        match connect_and_migrate(&custom_db_path).await {
            Ok(pool) => {
                ensure_daily_automatic_backup(&pool, app).await;
                return Ok(pool);
            }
            Err(error) => {
                eprintln!(
                    "No se pudo abrir la base configurada en {}. Se vuelve a la base local por defecto. Motivo: {}",
                    custom_db_path.display(),
                    error
                );
                if let Err(clear_error) = save_custom_db_path(app, None) {
                    eprintln!(
                        "No se pudo limpiar la ruta personalizada inválida: {}",
                        clear_error
                    );
                }
            }
        }
    }

    let default_path = default_db_path(app)?;
    let pool = connect_and_migrate(&default_path).await?;
    ensure_daily_automatic_backup(&pool, app).await;
    Ok(pool)
}
