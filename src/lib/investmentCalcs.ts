import type { InvestmentEntry } from "@/types";
import { formatDate } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fNum(n: number, d = 2) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

/** Redondeo centesimal para evitar acumulación de errores de punto flotante */
function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ─── CalcResult ────────────────────────────────────────────────────────────────
export interface CalcResult {
  invertidoArs: number;
  actualArs: number;
  gananciaArs: number;
  gananciaPctArs: number;
  invertidoUsd: number;
  actualUsd: number;
  gananciaUsd: number;
  /** Retorno USD real: usa cclActual para el precio actual y dolar_ccl para el precio de compra */
  gananciaPctUsd: number;
  detalles: string;
}

// ─── calcRow ──────────────────────────────────────────────────────────────────
/**
 * Calcula el resultado financiero de una posición individual.
 * @param inv       - La inversión a calcular
 * @param cclActual - CCL actual (solo relevante para CEDEAR/accion). Si se omite,
 *                    se usa el dolar_ccl de compra → gananciaPctUsd === gananciaPctArs
 */
export function calcRow(inv: InvestmentEntry, cclActual?: number | null): CalcResult {
  if (inv.transaction_kind === "sell") {
    const realizedCostArs = inv.realized_cost_ars ?? inv.amount_invested ?? 0;
    const proceedsArs = inv.cash_amount_ars ?? inv.current_value ?? 0;
    const gainArs = inv.realized_gain_ars ?? (proceedsArs - realizedCostArs);
    const pctArs = realizedCostArs > 0 ? r2((gainArs / realizedCostArs) * 100) : 0;
    const ccl = cclActual && cclActual > 0 ? cclActual : (inv.dolar_ccl ?? 0);
    const toUsd = (ars: number) => ccl > 0 ? r2(ars / ccl) : 0;

    return {
      invertidoArs: realizedCostArs,
      actualArs: proceedsArs,
      gananciaArs: gainArs,
      gananciaPctArs: pctArs,
      invertidoUsd: toUsd(realizedCostArs),
      actualUsd: toUsd(proceedsArs),
      gananciaUsd: toUsd(gainArs),
      gananciaPctUsd: pctArs,
      detalles: `${fNum(inv.quantity ?? 0, 4)} vendidas${inv.account_name ? ` · A ${inv.account_name}` : ""}`,
    };
  }

  const type = inv.instrument_type ?? "cedear";
  const qty = inv.quantity ?? 0;
  const priceArs = inv.price_ars ?? 0;
  const cclCompra = inv.dolar_ccl ?? 0;
  const cclHoy = cclActual && cclActual > 0 ? cclActual : cclCompra;
  const currPriceArs = inv.current_price_ars ?? priceArs;
  const toUsd = (ars: number) => cclHoy > 0 ? r2(ars / cclHoy) : 0;

  if (type === "plazo_fijo") {
    const capital = priceArs; // monto depositado (guardado en price_ars)
    const tna100 = (inv.tna ?? 0) / 100;
    const plazoTotal = inv.plazo_dias ?? 0;
    // Días transcurridos desde la fecha de apertura del PF hasta hoy
    const fechaInicio = new Date(inv.transaction_date + "T00:00:00");
    const diasTranscurridos = Math.floor((Date.now() - fechaInicio.getTime()) / 86400000);
    // Si ya venció, usar plazo completo (interés ya cobrado)
    const diasEfectivos = Math.min(Math.max(diasTranscurridos, 0), plazoTotal);
    const interes = r2(capital * tna100 * (diasEfectivos / 365));
    const montoActual = r2(capital + interes);
    const pct = r2(capital > 0 ? (interes / capital) * 100 : 0);
    return {
      invertidoArs: capital, actualArs: montoActual,
      gananciaArs: interes, gananciaPctArs: pct,
      invertidoUsd: toUsd(capital), actualUsd: toUsd(montoActual),
      gananciaUsd: toUsd(interes), gananciaPctUsd: pct,
      detalles: `TNA ${inv.tna ?? 0}% · ${diasEfectivos}/${plazoTotal} días${
        inv.fecha_vencimiento ? ` · Vence ${formatDate(inv.fecha_vencimiento)}` : ""}`,
    };
  }

  if (type === "fci") {
    const vcpCompra = priceArs, vcpActual = currPriceArs;
    // FCI argentinos cotizan en ARS — NO dividir por CCL
    const invertidoArs = r2(qty * vcpCompra);
    const actualArs = r2(qty * vcpActual);
    const gananciaArs = r2(actualArs - invertidoArs);
    const pct = r2(invertidoArs > 0 ? (gananciaArs / invertidoArs) * 100 : 0);
    return {
      invertidoArs, actualArs, gananciaArs, gananciaPctArs: pct,
      invertidoUsd: toUsd(invertidoArs), actualUsd: toUsd(actualArs),
      gananciaUsd: toUsd(gananciaArs), gananciaPctUsd: pct,
      detalles: `${fNum(qty)} cuotapartes · VCP $${fNum(vcpCompra)}`,
    };
  }

  if (type === "bono") {
    const vn = qty;
    const precioCompra = priceArs / 100, precioActual = currPriceArs / 100;
    const invertidoUsd = r2(vn * precioCompra);
    const actualUsd = r2(vn * precioActual);
    const gananciaUsd = r2(actualUsd - invertidoUsd);
    const pct = r2(invertidoUsd > 0 ? (gananciaUsd / invertidoUsd) * 100 : 0);
    const toArs = (usd: number) => cclHoy > 0 ? r2(usd * cclHoy) : 0;
    return {
      invertidoArs: toArs(invertidoUsd), actualArs: toArs(actualUsd),
      gananciaArs: toArs(gananciaUsd), gananciaPctArs: pct,
      invertidoUsd, actualUsd, gananciaUsd, gananciaPctUsd: pct,
      detalles: `VN ${fNum(vn, 0)} · ${inv.ticker ?? inv.name} @ ${fNum(priceArs)}%${
        inv.fecha_vencimiento ? ` · Vence ${formatDate(inv.fecha_vencimiento)}` : ""}`,
    };
  }

  if (type === "crypto") {
    // price_ars se usa como precio en USD para crypto (convención del dominio)
    const precioUsd = priceArs, precioActUsd = currPriceArs;
    const invertidoUsd = r2(qty * precioUsd);
    const actualUsd = r2(qty * precioActUsd);
    const gananciaUsd = r2(actualUsd - invertidoUsd);
    const pct = r2(invertidoUsd > 0 ? (gananciaUsd / invertidoUsd) * 100 : 0);
    const toArsC = (usd: number) => cclHoy > 0 ? r2(usd * cclHoy) : 0;
    return {
      invertidoArs: toArsC(invertidoUsd), actualArs: toArsC(actualUsd),
      gananciaArs: toArsC(gananciaUsd), gananciaPctArs: pct,
      invertidoUsd, actualUsd, gananciaUsd, gananciaPctUsd: pct,
      detalles: `${fNum(qty, 4)} ${inv.ticker ?? inv.name} · Compra USD ${fNum(precioUsd)}`,
    };
  }

  if (type === "otro") {
    const invertidoArs = inv.amount_invested;
    const actualArs = inv.current_value ?? inv.amount_invested;
    const gananciaArs = r2(actualArs - invertidoArs);
    const pct = r2(invertidoArs > 0 ? (gananciaArs / invertidoArs) * 100 : 0);
    return {
      invertidoArs, actualArs, gananciaArs, gananciaPctArs: pct,
      invertidoUsd: invertidoArs, actualUsd: actualArs,
      gananciaUsd: gananciaArs, gananciaPctUsd: pct, detalles: "",
    };
  }

  // cedear / accion
  // Retorno ARS: basado en precio en ARS
  const gananciaArs = r2((currPriceArs - priceArs) * qty);
  const invertidoArs = r2(priceArs * qty);
  const pctArs = r2(invertidoArs > 0 ? (gananciaArs / invertidoArs) * 100 : 0);

  // Retorno USD real: usa CCL de compra para el costo y CCL actual para el valor presente
  const usdCostoUnitario  = cclCompra > 0 ? priceArs    / cclCompra : 0;
  const usdActualUnitario = cclHoy    > 0 ? currPriceArs / cclHoy   : 0;
  const invertidoUsd = r2(usdCostoUnitario  * qty);
  const actualUsd    = r2(usdActualUnitario * qty);
  const gananciaUsd  = r2(actualUsd - invertidoUsd);
  const pctUsd       = r2(invertidoUsd > 0 ? (gananciaUsd / invertidoUsd) * 100 : 0);

  return {
    invertidoArs, actualArs: r2(currPriceArs * qty),
    gananciaArs, gananciaPctArs: pctArs,
    invertidoUsd, actualUsd, gananciaUsd, gananciaPctUsd: pctUsd,
    detalles: qty > 0
      ? `${fNum(qty, 0)} u. · $${fNum(priceArs)}${cclCompra > 0 ? ` · CCL $${fNum(cclCompra, 0)}` : ""}${
          cclHoy !== cclCompra && cclHoy > 0 ? ` · CCL act. $${fNum(cclHoy, 0)}` : ""}`
      : "",
  };
}

// ─── calcWeightedReturn ────────────────────────────────────────────────────────
/** Retorno ponderado por capital invertido del portfolio completo */
export function calcWeightedReturn(
  positions: Array<{ invertidoArs: number; gananciaArs: number }>
): number {
  const totalInv = positions.reduce((s, p) => s + p.invertidoArs, 0);
  if (totalInv <= 0) return 0;
  const weightedSum = positions.reduce(
    (s, p) => s + (p.invertidoArs > 0 ? (p.gananciaArs / p.invertidoArs) * p.invertidoArs : 0),
    0
  );
  return r2((weightedSum / totalInv) * 100);
}

// ─── detectInstrumentType ─────────────────────────────────────────────────────
import type { InstrumentType } from "@/types";

export interface DetectionResult {
  type: InstrumentType;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const PLAZO_FIJO_RE = /\b(PF|PLAZO|FIJO|DEPOSITO|DEPÓSITO|PLAZO[\s_-]FIJO|TD)\b/i;

const FCI_RE = /^(FCI|PELLEGRINI|MARIVA|DELTA|PIONEER|COMPASS|MEGAINVER|BALANZ|SANTANDER|GALICIA|PATRIA|SCHRODERS|HSBC)\b/i;

const CRYPTO_SET = new Set([
  "BTC","ETH","SOL","USDT","USDC","BNB","ADA","XRP","DOT","AVAX",
  "MATIC","LINK","UNI","ATOM","LTC","DOGE","SHIB","NEAR","OP","ARB","WBTC","DAI",
]);

// AL=Bonares ley local, GD=Globales ley NY, TX=CER-linked,
// LECAP/LEDE/LECER=letras Tesoro, BOPREAL=BCRA, BPY=bono provincial
const BONO_RE = /^(AL\d{2}[CD]?|GD\d{2}[CD]?|TX\d{2}|AE\d{2}|LECAP\d*|LEDE\d*|LECER\d*|BOPREAL\d*|BPY\d+|DICA|DICP|PARP|PAR[A-Z]?)$/i;

// CEDEARs conocidos sin sufijo D (ETFs y acciones latam que cotizan directo)
const CEDEAR_NO_D = new Set([
  "MELI","GLOB","LOMA","VIST","MORI","LRCX",
  "SPY","QQQ","EWZ","IWM","GLD","SLV","USO","XLE","XLF","IAU","ARKK","VWO",
]);

// Panel líder BYMA
const BYMA_LIDER = new Set([
  "GGAL","YPFD","PAMP","BBAR","TECO2","TXAR","ALUA","CRES","SUPV","BMA","BYMA",
  "COME","CTIO","CVH","DGCU2","EDN","FRAN","GRIM","HARG","HAVA","INTR","IRSA",
  "LEDE","LOMA","LONG","METR","MIRG","MOLI","MORI","OEST","PATA","PBIO","POLL",
  "RIGO","ROSE","SAMI","SEMI","TGNO4","TGSU2","TRAN","VALO","VLLO",
]);

export function detectInstrumentType(input: string): DetectionResult {
  if (!input || input.trim().length === 0)
    return { type: "otro", confidence: "low", reason: "Ticker vacío" };

  const raw = input.trim();
  const upper = raw.toUpperCase();

  if (PLAZO_FIJO_RE.test(raw))
    return { type: "plazo_fijo", confidence: "high", reason: "Contiene palabra clave de plazo fijo" };

  if (FCI_RE.test(raw))
    return { type: "fci", confidence: "high", reason: "Prefijo de gestora de FCI reconocido" };

  if (CRYPTO_SET.has(upper))
    return { type: "crypto", confidence: "high", reason: "Ticker de criptomoneda conocido" };

  if (BONO_RE.test(upper))
    return { type: "bono", confidence: "high", reason: "Ticker de bono soberano/cuasi-soberano argentino" };

  // CEDEAR con sufijo D explícito (AAPLD, NVDAD, AMZND…)
  if (upper.endsWith("D") && upper.length >= 4) {
    const base = upper.slice(0, -1);
    if (base.length >= 3 && /^[A-Z0-9]+$/.test(base))
      return { type: "cedear", confidence: "high", reason: `Sufijo D indica CEDEAR (base: ${base})` };
  }

  if (CEDEAR_NO_D.has(upper))
    return { type: "cedear", confidence: "high", reason: "CEDEAR conocido sin sufijo D" };

  if (BYMA_LIDER.has(upper))
    return { type: "accion", confidence: "high", reason: "Ticker en panel líder BYMA" };

  // Heurística: 3–5 letras mayúsculas → posible CEDEAR o acción extranjera
  if (/^[A-Z]{3,5}$/.test(upper))
    return { type: "cedear", confidence: "medium", reason: "Ticker alfanumérico corto — posible CEDEAR o acción extranjera" };

  return { type: "otro", confidence: "low", reason: "No se pudo identificar el tipo automáticamente" };
}

// ─── Sector mapping ────────────────────────────────────────────────────────────
export const SECTOR_MAP: Record<string, string> = {
  // Tecnología
  NVDA: "Tecnología", AAPL: "Tecnología", MSFT: "Tecnología",
  GOOGL: "Tecnología", GOOG: "Tecnología", AMZN: "Tecnología",
  META: "Tecnología", TSLA: "Tecnología", AMD: "Tecnología",
  INTC: "Tecnología", ORCL: "Tecnología", CRM: "Tecnología",
  ADBE: "Tecnología", AVGO: "Tecnología", QCOM: "Tecnología",
  TXN: "Tecnología", NFLX: "Tecnología", SHOP: "Tecnología",
  SNOW: "Tecnología", UBER: "Tecnología", LYFT: "Tecnología",
  SPOT: "Tecnología", ZOOM: "Tecnología", PYPL: "Tecnología",
  SQ: "Tecnología",
  // Financiero
  BMA: "Financiero", GGAL: "Financiero", SUPV: "Financiero",
  BBAR: "Financiero", VALO: "Financiero", BRK: "Financiero",
  JPM: "Financiero", BAC: "Financiero", GS: "Financiero",
  MS: "Financiero", WFC: "Financiero", C: "Financiero",
  V: "Financiero", MA: "Financiero", AXP: "Financiero",
  // Energía
  VIST: "Energía", YPF: "Energía", XOM: "Energía",
  CVX: "Energía", COP: "Energía", BP: "Energía",
  TGS: "Energía", PRIO: "Energía", SHEL: "Energía",
  // Utilities / Infraestructura
  PAMP: "Utilities", EDN: "Utilities", TRAN: "Utilities",
  CEPU: "Utilities",
  // Consumo masivo
  WMT: "Consumo", COST: "Consumo", MCD: "Consumo",
  SBUX: "Consumo", KO: "Consumo", PEP: "Consumo", PG: "Consumo",
  // Salud
  JNJ: "Salud", PFE: "Salud", UNH: "Salud",
  ABBV: "Salud", MRK: "Salud", LLY: "Salud", ABT: "Salud",
  // Materiales / Minería
  GOLD: "Minería", NEM: "Minería", FCX: "Minería",
  // Agro
  ADM: "Agro", DE: "Agro", MOS: "Agro",
  // Telecomunicaciones
  T: "Telecom", VZ: "Telecom",
};

export function getSector(ticker: string | null | undefined, instrumentType: string): string {
  if (!ticker) {
    if (instrumentType === "plazo_fijo" || instrumentType === "bono") return "Renta Fija";
    if (instrumentType === "fci") return "Fondos";
    if (instrumentType === "crypto") return "Crypto";
    return "Otro";
  }
  let upper = ticker.toUpperCase();
  // Normalizar sufijo D de CEDEARs: AAPLD → AAPL, NVDAD → NVDA
  // Solo strip si el ticker base está en el mapa (evita falsos positivos como GOLD → GOL)
  if (upper.endsWith("D") && upper.length >= 4) {
    const base = upper.slice(0, -1);
    if (SECTOR_MAP[base]) upper = base;
  }
  return SECTOR_MAP[upper] ?? (
    instrumentType === "plazo_fijo" || instrumentType === "bono" ? "Renta Fija" :
    instrumentType === "fci" ? "Fondos" :
    instrumentType === "crypto" ? "Crypto" : "Otro"
  );
}

// ─── CAGR ──────────────────────────────────────────────────────────────────────
/**
 * Compound Annual Growth Rate.
 * Accounts for how long the money has been invested.
 */
export function calcCAGR(invested: number, currentValue: number, firstDate: Date): number {
  if (invested <= 0 || currentValue <= 0) return 0;
  const years = (Date.now() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0.04) return (currentValue - invested) / invested; // < ~2 semanas → retorno simple
  return Math.pow(currentValue / invested, 1 / years) - 1;
}

// ─── XIRR ──────────────────────────────────────────────────────────────────────
export interface CashFlow {
  date: Date;
  amount: number; // negative = outflow (purchase), positive = inflow (current value)
}

/**
 * Extended Internal Rate of Return (Newton-Raphson).
 * More accurate than CAGR because it weights each cash flow by its actual timing.
 */
export function calcXIRR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  const totalPositive = cashFlows.filter(cf => cf.amount > 0).reduce((s, cf) => s + cf.amount, 0);
  const totalNegative = cashFlows.filter(cf => cf.amount < 0).reduce((s, cf) => s + Math.abs(cf.amount), 0);
  if (totalPositive === 0 || totalNegative === 0) return null;

  const DAYS_PER_YEAR = 365.25;
  const t0 = cashFlows[0].date.getTime();
  const years = cashFlows.map(cf => (cf.date.getTime() - t0) / (DAYS_PER_YEAR * 86400000));

  let rate = 0.1;
  for (let iter = 0; iter < 300; iter++) {
    let npv = 0, dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const base = 1 + rate;
      if (base <= 0) { rate = 0.01; break; }
      const factor = Math.pow(base, years[i]);
      npv += cashFlows[i].amount / factor;
      if (Math.abs(factor * base) > 1e-12) {
        dnpv -= years[i] * cashFlows[i].amount / (factor * base);
      }
    }
    if (Math.abs(dnpv) < 1e-12) return null;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-7) {
      return isFinite(newRate) && newRate > -0.99 ? newRate : null;
    }
    rate = isFinite(newRate) && newRate > -0.99 ? newRate : 0.1;
  }
  return isFinite(rate) && rate > -0.99 ? rate : null;
}

// ─── Signals ───────────────────────────────────────────────────────────────────
export type SignalLevel = "danger" | "warning" | "ok";

export interface Signal {
  level: SignalLevel;
  label: string;
}

export function calcPositionSignals(
  weight: number,
  returnPct: number,
  sectorWeight: number,
  sector: string,
): Signal[] {
  const signals: Signal[] = [];
  if (weight > 0.30)
    signals.push({ level: "danger", label: `${(weight * 100).toFixed(0)}% portf.` });
  else if (weight > 0.20)
    signals.push({ level: "warning", label: `${(weight * 100).toFixed(0)}% portf.` });

  if (sectorWeight > 0.40 && sector !== "Otro" && sector !== "Renta Fija" && sector !== "Fondos")
    signals.push({ level: "warning", label: `Sector ${(sectorWeight * 100).toFixed(0)}%` });

  if (returnPct < -0.15)
    signals.push({ level: "danger", label: `${(returnPct * 100).toFixed(0)}% ret.` });

  return signals;
}

// ─── Smart insights ────────────────────────────────────────────────────────────
export type InsightLevel = "critical" | "warning" | "info" | "opportunity";

export interface SmartInsight {
  level: InsightLevel;
  title: string;
  description: string;
  action?: string;
}

export interface InsightPosition {
  key: string;
  type: string;
  sector: string;
  currentValue: number;
  totalInvested: number;
  returnPct: number;
  count: number;
  ppp?: number | null;
  maturityDate?: string | null;
}

function fInt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const LEVEL_ORDER: Record<InsightLevel, number> = { critical: 0, warning: 1, info: 2, opportunity: 3 };

export function generateSmartInsights(
  positions: InsightPosition[],
  totalValue: number,
  cashBalance: number,
): SmartInsight[] {
  const insights: SmartInsight[] = [];

  // 1. Concentración por posición
  for (const pos of positions) {
    const weight = totalValue > 0 ? pos.currentValue / totalValue : 0;
    if (weight > 0.30) {
      const excessValue = (weight - 0.20) * totalValue;
      insights.push({
        level: "critical",
        title: `${pos.key} representa el ${(weight * 100).toFixed(0)}% del portfolio`,
        description: "Una posición por encima del 30% concentra demasiado riesgo no diversificado.",
        action: `Reducir al 20% liberaría $${fInt(excessValue)}`,
      });
    } else if (weight > 0.20) {
      insights.push({
        level: "warning",
        title: `${pos.key} tiene peso elevado: ${(weight * 100).toFixed(0)}%`,
        description: "Considerar diversificar si supera el 25%.",
      });
    }
  }

  // 2. Concentración sectorial
  const bySector: Record<string, { value: number; tickers: string[] }> = {};
  for (const pos of positions) {
    if (!bySector[pos.sector]) bySector[pos.sector] = { value: 0, tickers: [] };
    bySector[pos.sector].value += pos.currentValue;
    bySector[pos.sector].tickers.push(pos.key);
  }
  for (const [sector, data] of Object.entries(bySector)) {
    if (["Otro", "Renta Fija", "Fondos", "Crypto"].includes(sector)) continue;
    const sectorWeight = totalValue > 0 ? data.value / totalValue : 0;
    if (sectorWeight > 0.40) {
      insights.push({
        level: "warning",
        title: `Sector ${sector}: ${(sectorWeight * 100).toFixed(0)}% del portfolio`,
        description: `Activos: ${data.tickers.join(", ")}. Alta correlación entre ellos.`,
      });
    }
  }

  // 3. Liquidez
  if (cashBalance > 0) {
    const totalWithCash = totalValue + cashBalance;
    const cashWeight = totalWithCash > 0 ? cashBalance / totalWithCash : 0;
    if (cashWeight < 0.05) {
      insights.push({
        level: "critical",
        title: `Liquidez crítica: ${(cashWeight * 100).toFixed(1)}%`,
        description: "Menos del 5% en efectivo. Sin margen para oportunidades ni emergencias.",
      });
    } else if (cashWeight < 0.10) {
      insights.push({
        level: "warning",
        title: `Liquidez baja: ${(cashWeight * 100).toFixed(1)}%`,
        description: "Recomendado mantener al menos 10% en activos líquidos.",
      });
    }
  }

  // 4. Pérdidas significativas
  for (const pos of positions) {
    if (pos.returnPct < -0.15) {
      insights.push({
        level: "warning",
        title: `${pos.key} acumula ${(pos.returnPct * 100).toFixed(0)}% de pérdida`,
        description: "Evaluar si la tesis de inversión sigue válida o considerar stop-loss.",
      });
    }
  }

  // 5. Vencimientos próximos
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const in15 = new Date(today.getTime() + 15 * 86400000);
  for (const pos of positions) {
    if (pos.maturityDate) {
      const venc = new Date(pos.maturityDate);
      if (venc >= today && venc <= in30) {
        insights.push({
          level: venc <= in15 ? "warning" : "info",
          title: `${pos.key} vence el ${venc.toLocaleDateString("es-AR")}`,
          description: `Capital: $${fInt(pos.currentValue)}. Decidir: renovar o redirigir.`,
        });
      }
    }
  }

  // 6. Múltiples compras (PPP info)
  for (const pos of positions) {
    if (pos.count > 1 && pos.ppp != null && pos.ppp > 0) {
      insights.push({
        level: "info",
        title: `${pos.key}: ${pos.count} compras promediadas`,
        description: `PPP consolidado: $${pos.ppp.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
    }
  }

  return insights.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
