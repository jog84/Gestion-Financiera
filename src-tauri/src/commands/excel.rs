use std::{collections::HashMap, io::Cursor};

use base64::{engine::general_purpose, Engine as _};
use calamine::{open_workbook_auto_from_rs, Data, DataType, Reader};
use chrono::{Local, NaiveDate};
use rust_xlsxwriter::{Format, Workbook, XlsxError};
use serde::Serialize;

const DATE_FMT: &str = "dd/mm/yyyy";
const CURRENCY_FMT: &str = "$ #,##0.00";
const PERCENT_FMT: &str = "0.00%";

#[derive(Clone, Copy)]
enum ExcelKind {
    Incomes,
    Expenses,
    Installments,
    Investments,
    Assets,
    Goals,
}

impl ExcelKind {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "incomes" => Ok(Self::Incomes),
            "expenses" => Ok(Self::Expenses),
            "installments" => Ok(Self::Installments),
            "investments" => Ok(Self::Investments),
            "assets" => Ok(Self::Assets),
            "goals" => Ok(Self::Goals),
            other => Err(format!("Tipo de Excel no soportado: {other}")),
        }
    }

    fn filename(self) -> &'static str {
        match self {
            Self::Incomes => "plantilla_ingresos.xlsx",
            Self::Expenses => "plantilla_gastos.xlsx",
            Self::Installments => "plantilla_cuotas.xlsx",
            Self::Investments => "plantilla_inversiones.xlsx",
            Self::Assets => "plantilla_patrimonio.xlsx",
            Self::Goals => "plantilla_objetivos.xlsx",
        }
    }
}

#[derive(Serialize)]
struct ImportedIncome {
    transaction_date: String,
    description: String,
    source_name: String,
    amount: f64,
    notes: String,
}

#[derive(Serialize)]
struct ImportedExpense {
    transaction_date: String,
    description: String,
    category_name: String,
    vendor: String,
    payment_method: String,
    amount: f64,
    notes: String,
}

#[derive(Serialize)]
struct ImportedInstallment {
    description: String,
    provider_name: String,
    total_amount: f64,
    installment_count: i64,
    start_date: String,
    notes: String,
}

#[derive(Serialize)]
struct ImportedInvestment {
    transaction_date: String,
    name: String,
    ticker: String,
    amount_invested: f64,
    current_value: f64,
    notes: String,
    quantity: Option<f64>,
    price_ars: Option<f64>,
    dolar_ccl: Option<f64>,
    current_price_ars: Option<f64>,
}

#[derive(Serialize)]
struct ImportedAsset {
    snapshot_date: String,
    name: String,
    category: String,
    value: f64,
    notes: String,
}

#[derive(Serialize)]
struct ImportedGoal {
    name: String,
    target_amount: f64,
    current_amount: f64,
    target_date: String,
    status: String,
    notes: String,
}

fn xlsx_error(error: XlsxError) -> String {
    format!("Error generando Excel: {error}")
}

fn decode_base64(base64_data: &str) -> Result<Vec<u8>, String> {
    general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Error decodificando archivo Excel: {e}"))
}

async fn save_excel_bytes(filename: &str, bytes: Vec<u8>) -> Result<String, String> {
    let fname = filename.to_owned();
    let path = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_file_name(&fname)
            .add_filter("Excel", &["xlsx"])
            .save_file()
    })
    .await
    .map_err(|e| format!("Error abriendo diálogo: {e}"))?;

    match path {
        Some(path) => {
            std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
            Ok(path.to_string_lossy().to_string())
        }
        None => Err("cancelled".to_string()),
    }
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn date_format() -> Format {
    Format::new().set_num_format(DATE_FMT)
}

fn currency_format() -> Format {
    Format::new().set_num_format(CURRENCY_FMT)
}

fn percent_format() -> Format {
    Format::new().set_num_format(PERCENT_FMT)
}

fn write_headers(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    headers: &[&str],
) -> Result<(), XlsxError> {
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string(0, col as u16, *header)?;
    }
    Ok(())
}

fn set_columns(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    columns: &[(u16, f64, bool)],
) -> Result<(), XlsxError> {
    for (index, width, hidden) in columns {
        worksheet.set_column_width(*index, *width)?;
        if *hidden {
            worksheet.set_column_hidden(*index)?;
        }
    }
    Ok(())
}

fn build_template(kind: ExcelKind) -> Result<Vec<u8>, String> {
    let mut workbook = Workbook::new();
    let date_fmt = date_format();
    let currency_fmt = currency_format();
    let percent_fmt = percent_format();

    match kind {
        ExcelKind::Incomes => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Ingresos")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &["ID", "Fecha", "Descripcion", "Fuente", "Monto", "Notas"],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 14.0, false),
                    (2, 32.0, false),
                    (3, 22.0, false),
                    (4, 18.0, false),
                    (5, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(1, 1, today(), &date_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 2, "Sueldo mensual")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 3, "Trabajo")
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 4, 150000.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 5, "Opcional")
                .map_err(xlsx_error)?;
        }
        ExcelKind::Expenses => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Gastos")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &[
                    "ID",
                    "Fecha",
                    "Descripcion",
                    "Categoria",
                    "Proveedor",
                    "Metodo_Pago",
                    "Monto",
                    "Notas",
                ],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 14.0, false),
                    (2, 30.0, false),
                    (3, 22.0, false),
                    (4, 20.0, false),
                    (5, 16.0, false),
                    (6, 18.0, false),
                    (7, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(1, 1, today(), &date_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 2, "Supermercado")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 3, "Alimentacion")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 4, "Carrefour")
                .map_err(xlsx_error)?;
            worksheet.write_string(1, 5, "debito").map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 6, 8500.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 7, "Opcional")
                .map_err(xlsx_error)?;
        }
        ExcelKind::Installments => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Cuotas")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &[
                    "ID",
                    "Descripcion",
                    "Proveedor",
                    "Monto_Total",
                    "Cuotas",
                    "Cuota_Mensual",
                    "Fecha_Inicio",
                    "Notas",
                ],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 30.0, false),
                    (2, 20.0, false),
                    (3, 16.0, false),
                    (4, 10.0, false),
                    (5, 18.0, false),
                    (6, 14.0, false),
                    (7, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 1, "Smart TV 55\"")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 2, "Frávega")
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 3, 240000.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet.write_number(1, 4, 12.0).map_err(xlsx_error)?;
            worksheet
                .write_formula_with_format(1, 5, "=D2/E2", &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(1, 6, today(), &date_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 7, "Opcional")
                .map_err(xlsx_error)?;
        }
        ExcelKind::Investments => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Inversiones")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &[
                    "ID",
                    "Fecha",
                    "CEDEAR",
                    "Nombre",
                    "Cantidad",
                    "Precio_ARS",
                    "Dolar_CCL",
                    "Precio_Actual_ARS",
                    "Notas",
                ],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 14.0, false),
                    (2, 10.0, false),
                    (3, 24.0, false),
                    (4, 10.0, false),
                    (5, 18.0, false),
                    (6, 14.0, false),
                    (7, 20.0, false),
                    (8, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(1, 1, today(), &date_fmt)
                .map_err(xlsx_error)?;
            worksheet.write_string(1, 2, "VIST").map_err(xlsx_error)?;
            worksheet
                .write_string(1, 3, "Vista Energy")
                .map_err(xlsx_error)?;
            worksheet.write_number(1, 4, 24.0).map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 5, 24129.52, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 6, 1526.8, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 7, 31340.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 8, "Opcional")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(3, 0, "Los cálculos (USD Costo, Ganancia, etc.) los hace la app automáticamente al importar.")
                .map_err(xlsx_error)?;
        }
        ExcelKind::Assets => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Patrimonio")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &["ID", "Fecha", "Nombre", "Categoria", "Valor", "Notas"],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 14.0, false),
                    (2, 30.0, false),
                    (3, 20.0, false),
                    (4, 18.0, false),
                    (5, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(1, 1, today(), &date_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 2, "Departamento")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 3, "inmueble")
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 4, 15000000.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 5, "Opcional")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(3, 0, "Categorías válidas: efectivo | inmueble | vehiculo | inversion | cripto | otro")
                .map_err(xlsx_error)?;
        }
        ExcelKind::Goals => {
            let worksheet = workbook
                .add_worksheet()
                .set_name("Objetivos")
                .map_err(xlsx_error)?;
            write_headers(
                worksheet,
                &[
                    "ID",
                    "Nombre",
                    "Monto_Objetivo",
                    "Monto_Actual",
                    "Porcentaje",
                    "Fecha_Meta",
                    "Estado",
                    "Notas",
                ],
            )
            .map_err(xlsx_error)?;
            set_columns(
                worksheet,
                &[
                    (0, 0.1, true),
                    (1, 28.0, false),
                    (2, 18.0, false),
                    (3, 16.0, false),
                    (4, 14.0, false),
                    (5, 14.0, false),
                    (6, 12.0, false),
                    (7, 30.0, false),
                ],
            )
            .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 0, "EJEMPLO")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(1, 1, "Viaje a Europa")
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 2, 500000.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_number_with_format(1, 3, 125000.0, &currency_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_formula_with_format(1, 4, "=D2/C2", &percent_fmt)
                .map_err(xlsx_error)?;
            worksheet
                .write_date_with_format(
                    1,
                    5,
                    NaiveDate::from_ymd_opt(2026, 12, 31).unwrap(),
                    &date_fmt,
                )
                .map_err(xlsx_error)?;
            worksheet.write_string(1, 6, "active").map_err(xlsx_error)?;
            worksheet
                .write_string(1, 7, "Opcional")
                .map_err(xlsx_error)?;
            worksheet
                .write_string(3, 0, "Estado válidos: active | completed")
                .map_err(xlsx_error)?;
        }
    }

    workbook.save_to_buffer().map_err(xlsx_error)
}

fn first_sheet(bytes: Vec<u8>) -> Result<(HashMap<String, usize>, Vec<Vec<Data>>), String> {
    let mut workbook = open_workbook_auto_from_rs(Cursor::new(bytes))
        .map_err(|e| format!("Error abriendo archivo Excel: {e}"))?;
    let range = workbook
        .worksheet_range_at(0)
        .ok_or_else(|| "El archivo no contiene hojas".to_string())?
        .map_err(|e| format!("Error leyendo la primera hoja: {e}"))?;

    let mut rows = range.rows();
    let headers = rows
        .next()
        .ok_or_else(|| "El archivo está vacío o no tiene encabezados".to_string())?;

    let mut index = HashMap::new();
    for (pos, cell) in headers.iter().enumerate() {
        let header = cell_text(Some(cell)).trim().to_string();
        if !header.is_empty() {
            index.insert(header, pos);
        }
    }

    let data_rows = rows.map(|row| row.to_vec()).collect();
    Ok((index, data_rows))
}

fn get_cell<'a>(
    row: &'a [Data],
    headers: &HashMap<String, usize>,
    keys: &[&str],
) -> Option<&'a Data> {
    keys.iter()
        .find_map(|key| headers.get(*key).and_then(|index| row.get(*index)))
}

fn cell_text(cell: Option<&Data>) -> String {
    match cell {
        Some(value) => {
            if let Some(date) = value.as_date() {
                return date.format("%Y-%m-%d").to_string();
            }
            if let Some(datetime) = value.as_datetime() {
                return datetime.date().format("%Y-%m-%d").to_string();
            }
            value
                .as_string()
                .unwrap_or_else(|| value.to_string())
                .trim()
                .to_string()
        }
        None => String::new(),
    }
}

fn parse_date_value(cell: Option<&Data>) -> String {
    let raw = cell_text(cell);
    if raw.is_empty() {
        return String::new();
    }

    let trimmed = raw.trim();
    if let Ok(date) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return date.format("%Y-%m-%d").to_string();
    }
    if let Ok(date) = NaiveDate::parse_from_str(trimmed, "%d/%m/%Y") {
        return date.format("%Y-%m-%d").to_string();
    }
    trimmed.to_string()
}

fn parse_numeric_value(cell: Option<&Data>) -> f64 {
    if let Some(value) = cell {
        if let Some(number) = value.as_f64() {
            return number;
        }
        let normalized = cell_text(Some(value))
            .replace('$', "")
            .replace(',', "")
            .split_whitespace()
            .collect::<String>();
        return normalized.parse::<f64>().unwrap_or(0.0);
    }
    0.0
}

fn is_data_row(row: &[Data], headers: &HashMap<String, usize>, amount_key: &str) -> bool {
    let id = cell_text(get_cell(row, headers, &["ID"])).to_uppercase();
    if id == "EJEMPLO" || id == "ID" {
        return false;
    }
    if cell_text(get_cell(row, headers, &[amount_key])).to_uppercase() == "TOTAL" {
        return false;
    }
    parse_numeric_value(get_cell(row, headers, &[amount_key])) != 0.0
}

fn parse_incomes(headers: &HashMap<String, usize>, rows: &[Vec<Data>]) -> Vec<ImportedIncome> {
    rows.iter()
        .filter(|row| is_data_row(row, headers, "Monto"))
        .map(|row| ImportedIncome {
            transaction_date: parse_date_value(get_cell(row, headers, &["Fecha"])),
            description: cell_text(get_cell(row, headers, &["Descripcion"])),
            source_name: cell_text(get_cell(row, headers, &["Fuente"])),
            amount: parse_numeric_value(get_cell(row, headers, &["Monto"])),
            notes: cell_text(get_cell(row, headers, &["Notas"])),
        })
        .filter(|row| !row.transaction_date.is_empty() && row.amount > 0.0)
        .collect()
}

fn parse_expenses(headers: &HashMap<String, usize>, rows: &[Vec<Data>]) -> Vec<ImportedExpense> {
    rows.iter()
        .filter(|row| is_data_row(row, headers, "Monto"))
        .map(|row| ImportedExpense {
            transaction_date: parse_date_value(get_cell(row, headers, &["Fecha"])),
            description: cell_text(get_cell(row, headers, &["Descripcion"])),
            category_name: cell_text(get_cell(row, headers, &["Categoria"])),
            vendor: cell_text(get_cell(row, headers, &["Proveedor"])),
            payment_method: cell_text(get_cell(row, headers, &["Metodo_Pago"])),
            amount: parse_numeric_value(get_cell(row, headers, &["Monto"])),
            notes: cell_text(get_cell(row, headers, &["Notas"])),
        })
        .filter(|row| !row.transaction_date.is_empty() && row.amount > 0.0)
        .collect()
}

fn parse_installments(
    headers: &HashMap<String, usize>,
    rows: &[Vec<Data>],
) -> Vec<ImportedInstallment> {
    rows.iter()
        .filter(|row| is_data_row(row, headers, "Monto_Total"))
        .map(|row| ImportedInstallment {
            description: cell_text(get_cell(row, headers, &["Descripcion"])),
            provider_name: cell_text(get_cell(row, headers, &["Proveedor"])),
            total_amount: parse_numeric_value(get_cell(row, headers, &["Monto_Total"])),
            installment_count: parse_numeric_value(get_cell(row, headers, &["Cuotas"])).round()
                as i64,
            start_date: parse_date_value(get_cell(row, headers, &["Fecha_Inicio"])),
            notes: cell_text(get_cell(row, headers, &["Notas"])),
        })
        .filter(|row| {
            !row.description.is_empty() && row.total_amount > 0.0 && !row.start_date.is_empty()
        })
        .map(|mut row| {
            if row.installment_count <= 0 {
                row.installment_count = 1;
            }
            row
        })
        .collect()
}

fn parse_investments(
    headers: &HashMap<String, usize>,
    rows: &[Vec<Data>],
) -> Vec<ImportedInvestment> {
    rows.iter()
        .filter_map(|row| {
            let id = cell_text(get_cell(row, headers, &["ID"])).to_uppercase();
            if id == "EJEMPLO" || id == "ID" {
                return None;
            }
            let ticker = cell_text(get_cell(row, headers, &["CEDEAR", "Ticker"]));
            if ticker.trim().is_empty() {
                return None;
            }
            let name = {
                let raw = cell_text(get_cell(row, headers, &["Nombre"]));
                if raw.is_empty() {
                    ticker.clone()
                } else {
                    raw
                }
            };
            let quantity = parse_numeric_value(get_cell(row, headers, &["Cantidad"]));
            let price_ars = parse_numeric_value(get_cell(row, headers, &["Precio_ARS"]));
            let dolar_ccl = parse_numeric_value(get_cell(row, headers, &["Dolar_CCL"]));
            let current_price_ars =
                parse_numeric_value(get_cell(row, headers, &["Precio_Actual_ARS"]));
            let amount_invested = if dolar_ccl > 0.0 {
                (price_ars * quantity) / dolar_ccl
            } else {
                0.0
            };
            let current_value = if dolar_ccl > 0.0 && current_price_ars > 0.0 {
                (current_price_ars * quantity) / dolar_ccl
            } else {
                amount_invested
            };
            Some(ImportedInvestment {
                transaction_date: parse_date_value(get_cell(row, headers, &["Fecha"])),
                name,
                ticker,
                amount_invested,
                current_value,
                notes: cell_text(get_cell(row, headers, &["Notas"])),
                quantity: (quantity > 0.0).then_some(quantity),
                price_ars: (price_ars > 0.0).then_some(price_ars),
                dolar_ccl: (dolar_ccl > 0.0).then_some(dolar_ccl),
                current_price_ars: (current_price_ars > 0.0).then_some(current_price_ars),
            })
        })
        .filter(|row| !row.transaction_date.is_empty() && row.amount_invested > 0.0)
        .collect()
}

fn parse_assets(headers: &HashMap<String, usize>, rows: &[Vec<Data>]) -> Vec<ImportedAsset> {
    rows.iter()
        .filter(|row| is_data_row(row, headers, "Valor"))
        .map(|row| ImportedAsset {
            snapshot_date: parse_date_value(get_cell(row, headers, &["Fecha"])),
            name: cell_text(get_cell(row, headers, &["Nombre"])),
            category: cell_text(get_cell(row, headers, &["Categoria"])),
            value: parse_numeric_value(get_cell(row, headers, &["Valor"])),
            notes: cell_text(get_cell(row, headers, &["Notas"])),
        })
        .filter(|row| !row.name.is_empty() && !row.snapshot_date.is_empty() && row.value > 0.0)
        .collect()
}

fn parse_goals(headers: &HashMap<String, usize>, rows: &[Vec<Data>]) -> Vec<ImportedGoal> {
    rows.iter()
        .filter(|row| is_data_row(row, headers, "Monto_Objetivo"))
        .map(|row| ImportedGoal {
            name: cell_text(get_cell(row, headers, &["Nombre"])),
            target_amount: parse_numeric_value(get_cell(row, headers, &["Monto_Objetivo"])),
            current_amount: parse_numeric_value(get_cell(row, headers, &["Monto_Actual"])),
            target_date: parse_date_value(get_cell(row, headers, &["Fecha_Meta"])),
            status: {
                let status = cell_text(get_cell(row, headers, &["Estado"]));
                if status.is_empty() {
                    "active".to_string()
                } else {
                    status
                }
            },
            notes: cell_text(get_cell(row, headers, &["Notas"])),
        })
        .filter(|row| !row.name.is_empty() && row.target_amount > 0.0)
        .collect()
}

#[tauri::command]
pub async fn export_excel_template(template_kind: String) -> Result<String, String> {
    let kind = ExcelKind::parse(&template_kind)?;
    let bytes = build_template(kind)?;
    save_excel_bytes(kind.filename(), bytes).await
}

#[tauri::command]
pub async fn import_excel_rows(
    import_kind: String,
    base64_data: String,
) -> Result<serde_json::Value, String> {
    let kind = ExcelKind::parse(&import_kind)?;
    let bytes = decode_base64(&base64_data)?;
    let (headers, rows) = first_sheet(bytes)?;

    let value = match kind {
        ExcelKind::Incomes => serde_json::to_value(parse_incomes(&headers, &rows)),
        ExcelKind::Expenses => serde_json::to_value(parse_expenses(&headers, &rows)),
        ExcelKind::Installments => serde_json::to_value(parse_installments(&headers, &rows)),
        ExcelKind::Investments => serde_json::to_value(parse_investments(&headers, &rows)),
        ExcelKind::Assets => serde_json::to_value(parse_assets(&headers, &rows)),
        ExcelKind::Goals => serde_json::to_value(parse_goals(&headers, &rows)),
    }
    .map_err(|e| format!("Error serializando filas importadas: {e}"))?;

    Ok(value)
}
