use base64::{engine::general_purpose, Engine as _};

/// Recibe el archivo Excel codificado en base64, muestra un diálogo "Guardar como"
/// y escribe el archivo en la ruta elegida por el usuario.
#[tauri::command]
pub async fn save_excel_file(filename: String, base64_data: String) -> Result<String, String> {
    // Decodificar base64 → bytes
    let bytes = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Error decodificando base64: {e}"))?;

    // rfd::FileDialog es sincrónico — debe correr en un hilo de bloqueo,
    // no en el hilo async de tokio (de lo contrario no aparece en Windows)
    let fname = filename.clone();
    let path = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_file_name(&fname)
            .add_filter("Excel", &["xlsx"])
            .save_file()
    })
    .await
    .map_err(|e| format!("Error abriendo diálogo: {e}"))?;

    match path {
        Some(p) => {
            std::fs::write(&p, bytes).map_err(|e| e.to_string())?;
            Ok(p.to_string_lossy().to_string())
        }
        None => Err("cancelled".to_string()),
    }
}
