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
  const upper = ticker.toUpperCase();
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

function fNum(n: number) {
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
        action: `Reducir al 20% liberaría $${fNum(excessValue)}`,
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
          description: `Capital: $${fNum(pos.currentValue)}. Decidir: renovar o redirigir.`,
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
