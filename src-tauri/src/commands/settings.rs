use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProfileSettings {
    pub id: String,
    pub name: String,
    pub currency_code: String,
    pub locale: String,
}

#[tauri::command]
pub async fn get_default_profile(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<ProfileSettings, String> {
    sqlx::query_as::<_, ProfileSettings>(
        "SELECT id, name, currency_code, locale FROM user_profiles WHERE is_default = 1 OR id = 'default' LIMIT 1",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_profile(
    pool: tauri::State<'_, SqlitePool>,
    name: String,
    currency_code: String,
    locale: String,
) -> Result<ProfileSettings, String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE user_profiles SET name = ?, currency_code = ?, locale = ?, updated_at = ? WHERE is_default = 1 OR id = 'default'",
    )
    .bind(&name)
    .bind(&currency_code)
    .bind(&locale)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    get_default_profile(pool).await
}

// ── Shared folder / DB location commands ────────────────────────────────────

#[tauri::command]
pub async fn get_db_location(app: tauri::AppHandle) -> Result<String, String> {
    match crate::db::get_custom_db_path(&app) {
        Some(p) => Ok(p),
        None => Ok(crate::db::default_db_path(&app)?
            .to_string_lossy()
            .to_string()),
    }
}

#[tauri::command]
pub async fn set_db_location(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);

    // Must end in .db
    match p.extension().and_then(|e| e.to_str()) {
        Some("db") => {}
        _ => return Err("La ruta debe terminar en .db (ej: finanzas.db)".to_string()),
    }

    // Cannot be an existing directory
    if p.is_dir() {
        return Err("La ruta apunta a una carpeta. Incluí el nombre del archivo (ej: \\finanzas.db)".to_string());
    }

    // Parent directory must exist
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            return Err(format!("La carpeta no existe: {}", parent.display()));
        }
    }

    crate::db::save_custom_db_path(&app, Some(path))
}

#[tauri::command]
pub async fn reset_db_location(app: tauri::AppHandle) -> Result<(), String> {
    crate::db::save_custom_db_path(&app, None)
}

/// Copies the current open database to a new path using VACUUM INTO (safe with open pool)
#[tauri::command]
pub async fn copy_db_to_location(
    pool: tauri::State<'_, SqlitePool>,
    path: String,
) -> Result<(), String> {
    let dest = path.replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{dest}'"))
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
