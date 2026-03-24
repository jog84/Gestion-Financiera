/**
 * excel.ts — Plantillas Excel para carga e importación de datos
 *
 * PLANTILLA: genera un .xlsx vacío con encabezados formateados + 1 fila de ejemplo.
 *   - La fila de ejemplo tiene ID="EJEMPLO" y se omite al importar.
 *   - Columnas calculadas (Cuota_Mensual, Ganancia, Porcentaje) incluyen la fórmula
 *     para que al agregar filas el usuario pueda arrastrarla.
 *
 * IMPORTAR: lee el archivo, ignora la fila de ejemplo y las filas sin datos válidos,
 *   devuelve filas tipadas listas para guardar.
 *
 * Fechas:  DD/MM/YYYY (como fecha nativa de Excel)
 * Montos:  número puro con formato $ #,##0.00
 * ID:      oculto — sólo se usa internamente para identificar la fila de ejemplo
 */

import * as XLSX from "xlsx";
import { invoke } from "@tauri-apps/api/core";

// ─── Constantes de formato ───────────────────────────────────────────────────

const DATE_FMT     = "DD/MM/YYYY";
const CURRENCY_FMT = "$ #,##0.00";
const PERCENT_FMT  = "0.00%";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** ISO YYYY-MM-DD → número serial de Excel */
function dateToExcel(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const date  = new Date(y, m - 1, d);
  const epoch = new Date(1899, 11, 30);
  return Math.round((date.getTime() - epoch.getTime()) / 86400000);
}

/** Celda de encabezado */
function hdr(v: string): XLSX.CellObject { return { v, t: "s" }; }

/** Guarda el workbook usando el diálogo nativo de Tauri */
async function download(wb: XLSX.WorkBook, filename: string) {
  // type:"base64" evita corrupción de datos binarios al pasar por JSON/IPC
  const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
  await invoke("save_excel_file", { filename, base64Data });
}

/**
 * Aplica anchos de columna y formatos numéricos.
 * fmts: { colIndex: formatString } — se aplica a todas las filas de datos (fila 2 en adelante)
 * dataRows: cantidad de filas con datos (para aplicar el formato)
 */
function styleSheet(
  ws: XLSX.WorkSheet,
  cols: { wch: number; hidden?: boolean }[],
  fmts: Record<number, string>,
  dataRows: number,
) {
  ws["!cols"] = cols;
  for (const [ci, fmt] of Object.entries(fmts)) {
    for (let r = 1; r <= dataRows; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: Number(ci) });
      if (ws[addr]) ws[addr].z = fmt;
      else ws[addr] = { v: "", t: "s", z: fmt };
    }
  }
}

/** Parse a cell value back to ISO YYYY-MM-DD */
function parseDate(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  if (typeof val === "string") {
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  }
  return "";
}

/** Parse a cell value as number (strips $, commas, spaces) */
function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val.replace(/[$,\s]/g, "")) || 0;
  return 0;
}

/** Filtra las filas que no son de datos reales (ejemplo, encabezado repetido, totales) */
function isDataRow(r: Record<string, unknown>, amountKey: string): boolean {
  const id = String(r["ID"] ?? "").toUpperCase();
  if (id === "EJEMPLO" || id === "ID") return false;
  if (String(r[amountKey] ?? "").toUpperCase() === "TOTAL") return false;
  return parseNum(r[amountKey]) !== 0;
}

// ─── INGRESOS ────────────────────────────────────────────────────────────────

export async function exportIncomesTemplate() {
  const wb   = XLSX.utils.book_new();
  const today = dateToExcel(new Date().toISOString().split("T")[0]);
  const rows: XLSX.CellObject[][] = [
    ["ID", "Fecha", "Descripcion", "Fuente", "Monto", "Notas"].map(hdr),
    // Fila de ejemplo (se omite al importar)
    [
      { v: "EJEMPLO",    t: "s" },
      { v: today,        t: "n", z: DATE_FMT },
      { v: "Sueldo mensual", t: "s" },
      { v: "Trabajo",    t: "s" },
      { v: 150000,       t: "n", z: CURRENCY_FMT },
      { v: "Opcional",   t: "s" },
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  styleSheet(
    ws,
    [{ wch: 0, hidden: true }, { wch: 14 }, { wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 30 }],
    { 1: DATE_FMT, 4: CURRENCY_FMT },
    1,
  );
  XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
  download(wb, "plantilla_ingresos.xlsx");
}

export interface ImportedIncome {
  transaction_date: string;
  description: string;
  source_name: string;
  amount: number;
  notes: string;
}

export async function importIncomes(file: File): Promise<ImportedIncome[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => isDataRow(r, "Monto"))
    .map((r) => ({
      transaction_date: parseDate(r["Fecha"]),
      description:      String(r["Descripcion"] ?? ""),
      source_name:      String(r["Fuente"]       ?? ""),
      amount:           parseNum(r["Monto"]),
      notes:            String(r["Notas"]         ?? ""),
    }))
    .filter((r) => r.transaction_date && r.amount > 0);
}

// ─── GASTOS ──────────────────────────────────────────────────────────────────

export async function exportExpensesTemplate() {
  const wb    = XLSX.utils.book_new();
  const today = dateToExcel(new Date().toISOString().split("T")[0]);
  const rows: XLSX.CellObject[][] = [
    ["ID", "Fecha", "Descripcion", "Categoria", "Proveedor", "Metodo_Pago", "Monto", "Notas"].map(hdr),
    [
      { v: "EJEMPLO",         t: "s" },
      { v: today,             t: "n", z: DATE_FMT },
      { v: "Supermercado",    t: "s" },
      { v: "Alimentacion",    t: "s" },
      { v: "Carrefour",       t: "s" },
      { v: "debito",          t: "s" },
      { v: 8500,              t: "n", z: CURRENCY_FMT },
      { v: "Opcional",        t: "s" },
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  styleSheet(
    ws,
    [{ wch: 0, hidden: true }, { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 30 }],
    { 1: DATE_FMT, 6: CURRENCY_FMT },
    1,
  );
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");
  download(wb, "plantilla_gastos.xlsx");
}

export interface ImportedExpense {
  transaction_date: string;
  description: string;
  category_name: string;
  vendor: string;
  payment_method: string;
  amount: number;
  notes: string;
}

export async function importExpenses(file: File): Promise<ImportedExpense[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => isDataRow(r, "Monto"))
    .map((r) => ({
      transaction_date: parseDate(r["Fecha"]),
      description:      String(r["Descripcion"]  ?? ""),
      category_name:    String(r["Categoria"]     ?? ""),
      vendor:           String(r["Proveedor"]     ?? ""),
      payment_method:   String(r["Metodo_Pago"]   ?? ""),
      amount:           parseNum(r["Monto"]),
      notes:            String(r["Notas"]          ?? ""),
    }))
    .filter((r) => r.transaction_date && r.amount > 0);
}

// ─── CUOTAS ──────────────────────────────────────────────────────────────────

export async function exportInstallmentsTemplate() {
  const wb    = XLSX.utils.book_new();
  const today = dateToExcel(new Date().toISOString().split("T")[0]);
  // Fila de ejemplo en la fila 2 (índice 1), la fórmula apunta a D2/E2
  const rows: XLSX.CellObject[][] = [
    ["ID", "Descripcion", "Proveedor", "Monto_Total", "Cuotas", "Cuota_Mensual", "Fecha_Inicio", "Notas"].map(hdr),
    [
      { v: "EJEMPLO",      t: "s" },
      { v: "Smart TV 55\"", t: "s" },
      { v: "Frávega",       t: "s" },
      { v: 240000,          t: "n", z: CURRENCY_FMT },
      { v: 12,              t: "n" },
      { v: 0, f: "D2/E2",  t: "n", z: CURRENCY_FMT },
      { v: today,           t: "n", z: DATE_FMT },
      { v: "Opcional",      t: "s" },
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  styleSheet(
    ws,
    [{ wch: 0, hidden: true }, { wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 30 }],
    { 3: CURRENCY_FMT, 5: CURRENCY_FMT, 6: DATE_FMT },
    1,
  );
  XLSX.utils.book_append_sheet(wb, ws, "Cuotas");
  download(wb, "plantilla_cuotas.xlsx");
}

export interface ImportedInstallment {
  description: string;
  provider_name: string;
  total_amount: number;
  installment_count: number;
  start_date: string;
  notes: string;
}

export async function importInstallments(file: File): Promise<ImportedInstallment[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => isDataRow(r, "Monto_Total"))
    .map((r) => ({
      description:       String(r["Descripcion"]  ?? ""),
      provider_name:     String(r["Proveedor"]    ?? ""),
      total_amount:      parseNum(r["Monto_Total"]),
      installment_count: Math.round(parseNum(r["Cuotas"])) || 1,
      start_date:        parseDate(r["Fecha_Inicio"]),
      notes:             String(r["Notas"]         ?? ""),
    }))
    .filter((r) => r.description && r.total_amount > 0 && r.start_date);
}

// ─── INVERSIONES ─────────────────────────────────────────────────────────────

// Columnas de entrada: A=ID B=Fecha C=CEDEAR D=Nombre E=Cantidad
//                     F=Precio_ARS G=Dolar_CCL H=Precio_Actual_ARS I=Notas
// Los cálculos (USD_Costo, USD_Actual, Ganancia, etc.) los hace la app al importar.
export async function exportInvestmentsTemplate() {
  const wb    = XLSX.utils.book_new();
  const today = dateToExcel(new Date().toISOString().split("T")[0]);

  const headers = [
    "ID", "Fecha", "CEDEAR", "Nombre", "Cantidad",
    "Precio_ARS", "Dolar_CCL", "Precio_Actual_ARS", "Notas",
  ].map(hdr);

  // Fila de ejemplo — solo datos que ingresa el usuario
  const example: XLSX.CellObject[] = [
    { v: "EJEMPLO",   t: "s" },                   // A: ID (oculto)
    { v: today,       t: "n", z: DATE_FMT },      // B: Fecha
    { v: "VIST",      t: "s" },                   // C: CEDEAR/Ticker
    { v: "Vista Energy", t: "s" },                // D: Nombre (opcional)
    { v: 24,          t: "n" },                   // E: Cantidad
    { v: 24129.52,    t: "n", z: "$ #,##0.00" }, // F: Precio_ARS (al momento de compra)
    { v: 1526.80,     t: "n", z: "$ #,##0.00" }, // G: Dolar_CCL (al momento de compra)
    { v: 31340,       t: "n", z: "$ #,##0.00" }, // H: Precio_Actual_ARS (dejar vacío si se actualiza después)
    { v: "Opcional",  t: "s" },                   // I: Notas
  ];

  const rows: XLSX.CellObject[][] = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);

  styleSheet(
    ws,
    [
      { wch: 0, hidden: true }, // A: ID (oculto)
      { wch: 14 },              // B: Fecha
      { wch: 10 },              // C: CEDEAR
      { wch: 24 },              // D: Nombre
      { wch: 10 },              // E: Cantidad
      { wch: 18 },              // F: Precio_ARS
      { wch: 14 },              // G: Dolar_CCL
      { wch: 20 },              // H: Precio_Actual_ARS
      { wch: 30 },              // I: Notas
    ],
    { 1: DATE_FMT, 5: "$ #,##0.00", 6: "$ #,##0.00", 7: "$ #,##0.00" },
    1,
  );

  // Nota aclaratoria
  ws["A4"] = { v: "Los cálculos (USD Costo, Ganancia, etc.) los hace la app automáticamente al importar.", t: "s" };

  XLSX.utils.book_append_sheet(wb, ws, "Inversiones");
  download(wb, "plantilla_inversiones.xlsx");
}

export interface ImportedInvestment {
  transaction_date: string;
  name: string;
  ticker: string;
  amount_invested: number;
  current_value: number;
  notes: string;
  quantity?: number;
  price_ars?: number;
  dolar_ccl?: number;
  current_price_ars?: number;
}

export async function importInvestments(file: File): Promise<ImportedInvestment[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => {
      const id = String(r["ID"] ?? "").toUpperCase();
      if (id === "EJEMPLO" || id === "ID") return false;
      return String(r["CEDEAR"] || r["Ticker"] || "").trim() !== "";
    })
    .map((r) => {
      const ticker    = String(r["CEDEAR"] || r["Ticker"] || "").trim();
      const nombre    = String(r["Nombre"] || ticker);
      const qty       = parseNum(r["Cantidad"]);
      const priceArs  = parseNum(r["Precio_ARS"]);
      const ccl       = parseNum(r["Dolar_CCL"]);
      const currPrArs = parseNum(r["Precio_Actual_ARS"]);
      // La app calcula: USD_Costo = (Precio_ARS * Cantidad) / Dolar_CCL
      const amtInvested = ccl > 0 ? (priceArs * qty) / ccl : 0;
      const currValue   = ccl > 0 && currPrArs > 0 ? (currPrArs * qty) / ccl : amtInvested;
      return {
        transaction_date:  parseDate(r["Fecha"]),
        name:              nombre,
        ticker,
        amount_invested:   amtInvested,
        current_value:     currValue,
        notes:             String(r["Notas"] ?? ""),
        quantity:          qty || undefined,
        price_ars:         priceArs || undefined,
        dolar_ccl:         ccl || undefined,
        current_price_ars: currPrArs || undefined,
      };
    })
    .filter((r) => r.ticker && r.transaction_date && r.amount_invested > 0);
}

// ─── PATRIMONIO ───────────────────────────────────────────────────────────────

export async function exportAssetsTemplate() {
  const wb    = XLSX.utils.book_new();
  const today = dateToExcel(new Date().toISOString().split("T")[0]);
  const rows: XLSX.CellObject[][] = [
    ["ID", "Fecha", "Nombre", "Categoria", "Valor", "Notas"].map(hdr),
    [
      { v: "EJEMPLO",         t: "s" },
      { v: today,             t: "n", z: DATE_FMT },
      { v: "Departamento",    t: "s" },
      { v: "inmueble",        t: "s" },
      { v: 15000000,          t: "n", z: CURRENCY_FMT },
      { v: "Opcional",        t: "s" },
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  styleSheet(
    ws,
    [{ wch: 0, hidden: true }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 30 }],
    { 1: DATE_FMT, 4: CURRENCY_FMT },
    1,
  );
  // Nota de categorías válidas
  ws["A4"] = { v: "Categorías válidas: efectivo | inmueble | vehiculo | inversion | cripto | otro", t: "s" };
  XLSX.utils.book_append_sheet(wb, ws, "Patrimonio");
  download(wb, "plantilla_patrimonio.xlsx");
}

export interface ImportedAsset {
  snapshot_date: string;
  name: string;
  category: string;
  value: number;
  notes: string;
}

export async function importAssets(file: File): Promise<ImportedAsset[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => isDataRow(r, "Valor"))
    .map((r) => ({
      snapshot_date: parseDate(r["Fecha"]),
      name:          String(r["Nombre"]    ?? ""),
      category:      String(r["Categoria"] ?? ""),
      value:         parseNum(r["Valor"]),
      notes:         String(r["Notas"]      ?? ""),
    }))
    .filter((r) => r.name && r.snapshot_date && r.value > 0);
}

// ─── OBJETIVOS ────────────────────────────────────────────────────────────────

export async function exportGoalsTemplate() {
  const wb   = XLSX.utils.book_new();
  const meta = dateToExcel("2026-12-31");
  const rows: XLSX.CellObject[][] = [
    ["ID", "Nombre", "Monto_Objetivo", "Monto_Actual", "Porcentaje", "Fecha_Meta", "Estado", "Notas"].map(hdr),
    [
      { v: "EJEMPLO",           t: "s" },
      { v: "Viaje a Europa",    t: "s" },
      { v: 500000,              t: "n", z: CURRENCY_FMT },
      { v: 125000,              t: "n", z: CURRENCY_FMT },
      { v: 0, f: "D2/C2",      t: "n", z: PERCENT_FMT },
      { v: meta,                t: "n", z: DATE_FMT },
      { v: "active",            t: "s" },
      { v: "Opcional",          t: "s" },
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  styleSheet(
    ws,
    [{ wch: 0, hidden: true }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 }],
    { 2: CURRENCY_FMT, 3: CURRENCY_FMT, 4: PERCENT_FMT, 5: DATE_FMT },
    1,
  );
  // Nota estados válidos
  ws["A4"] = { v: "Estado válidos: active | completed", t: "s" };
  XLSX.utils.book_append_sheet(wb, ws, "Objetivos");
  download(wb, "plantilla_objetivos.xlsx");
}

export interface ImportedGoal {
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  status: string;
  notes: string;
}

export async function importGoals(file: File): Promise<ImportedGoal[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .filter((r) => isDataRow(r, "Monto_Objetivo"))
    .map((r) => ({
      name:           String(r["Nombre"]         ?? ""),
      target_amount:  parseNum(r["Monto_Objetivo"]),
      current_amount: parseNum(r["Monto_Actual"]) || 0,
      target_date:    parseDate(r["Fecha_Meta"]),
      status:         String(r["Estado"]          ?? "active"),
      notes:          String(r["Notas"]            ?? ""),
    }))
    .filter((r) => r.name && r.target_amount > 0);
}
