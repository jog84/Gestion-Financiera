import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { InvestmentEntry, InstrumentType } from "@/types";
import {
  calcRow,
  calcPositionSignals,
  detectInstrumentType,
  getSector,
  type Signal,
} from "@/lib/investmentCalcs";

export type Currency = "ARS" | "USD";
export type SortDir = "asc" | "desc";
export type SortKey = "fecha" | "tipo" | "nombre" | "invertido" | "actual" | "ganancia" | "pct" | "peso";

export type TickerDetection = {
  type: InstrumentType;
  confidence: "high" | "medium" | "low";
  reason: string;
  switched: boolean;
};

export type InvestmentFormState = {
  ticker: string;
  name: string;
  account_id: string;
  quantity: string;
  price_ars: string;
  dolar_ccl: string;
  current_price_ars: string;
  transaction_date: string;
  notes: string;
  tna: string;
  plazo_dias: string;
  fecha_vencimiento: string;
  // CEDEAR ratio support
  precio_usd: string;
  cedear_ratio: string;
};

export interface EnhancedPosition {
  key: string;
  type: InstrumentType;
  typeLabel: string;
  typeColor: string;
  name: string;
  ticker: string | null;
  sector: string;
  ppp: number | null;
  currentPriceArs: number | null;
  totalQty: number;
  invertidoArs: number;
  actualArs: number;
  gananciaArs: number;
  invertidoUsd: number;
  actualUsd: number;
  gananciaUsd: number;
  realizedGainArs: number;
  realizedGainUsd: number;
  weightPct: number;
  count: number;
  entries: InvestmentEntry[];
  maturityDate: string | null;
  signals: Signal[];
  sectorWeight: number;
}

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  cedear: "CEDEAR",
  accion: "Acción",
  plazo_fijo: "Plazo Fijo",
  bono: "Bono",
  fci: "FCI",
  crypto: "Cripto",
  otro: "Otro",
};

export const INSTRUMENT_COLORS_HEX: Record<InstrumentType, string> = {
  cedear: "#4361ee",
  accion: "#7c3aed",
  plazo_fijo: "#06d6a0",
  bono: "#fb8500",
  fci: "#0891b2",
  crypto: "#f59e0b",
  otro: "#6b7280",
};

export const INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  cedear: "var(--primary)",
  accion: "#7c3aed",
  plazo_fijo: "var(--success)",
  bono: "var(--warning)",
  fci: "#0891b2",
  crypto: "#f59e0b",
  otro: "var(--text-3)",
};

export const INVESTMENTS_TH: CSSProperties = {
  padding: "8px 14px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
  whiteSpace: "nowrap",
  userSelect: "none",
};

export const INVESTMENTS_TD: CSSProperties = {
  padding: "9px 14px",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  color: "var(--text-2)",
  whiteSpace: "nowrap",
};

export const createEmptyInvestmentForm = (): InvestmentFormState => ({
  ticker: "",
  name: "",
  account_id: "",
  quantity: "",
  price_ars: "",
  dolar_ccl: "",
  current_price_ars: "",
  transaction_date: new Date().toISOString().split("T")[0],
  notes: "",
  tna: "",
  plazo_dias: "",
  fecha_vencimiento: "",
  precio_usd: "",
  cedear_ratio: "1",
});

export function fNum(n: number, d = 2) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

export function fPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function effectiveType(
  ticker: string | null | undefined,
  storedType: InstrumentType | null | undefined,
): InstrumentType {
  const base = storedType ?? "cedear";
  if (base !== "cedear" || !ticker) return base;
  const detected = detectInstrumentType(ticker);
  return detected.confidence === "high" ? detected.type : base;
}

export function buildPositions(
  invs: InvestmentEntry[],
  currentCcl?: number | null,
): EnhancedPosition[] {
  const map = new Map<string, { type: InstrumentType; name: string; ticker: string | null; entries: InvestmentEntry[] }>();

  for (const inv of invs) {
    const key = (inv.ticker ?? inv.name).toUpperCase();
    const type = effectiveType(inv.ticker, inv.instrument_type);
    const existing = map.get(key);
    if (existing) existing.entries.push(inv);
    else map.set(key, { type, name: inv.name, ticker: inv.ticker, entries: [inv] });
  }

  const basePositions = Array.from(map.entries()).map(([key, { type, name, ticker, entries }]) => {
    let openQty = 0;
    let remainingCostArs = 0;
    let currentPriceArs: number | null = null;
    let investedArs = 0;
    let actualArs = 0;
    let realizedGainArs = 0;
    let maturityDate: string | null = null;
    let currentCclValue: number | null = currentCcl ?? null;

    const orderedEntries = [...entries].sort((a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    for (const inv of orderedEntries) {
      if (inv.transaction_kind === "sell") {
        openQty = Math.max(0, openQty - (inv.quantity ?? 0));
        remainingCostArs = Math.max(0, remainingCostArs - (inv.realized_cost_ars ?? 0));
        realizedGainArs += inv.realized_gain_ars ?? 0;
      } else {
        const cashArs = inv.cash_amount_ars ?? 0;
        openQty += inv.quantity ?? 0;
        remainingCostArs += cashArs;
        if (inv.current_price_ars) currentPriceArs = inv.current_price_ars;
        if (!currentCclValue && inv.dolar_ccl) currentCclValue = inv.dolar_ccl;
      }

      if (inv.fecha_vencimiento) maturityDate = inv.fecha_vencimiento;
    }

    const ppp = (type === "cedear" || type === "accion" || type === "fci" || type === "crypto" || type === "bono") && openQty > 0
      ? remainingCostArs / openQty
      : null;
    investedArs = remainingCostArs;
    actualArs = type === "plazo_fijo" || type === "otro"
      ? orderedEntries.filter((entry) => entry.transaction_kind !== "sell").reduce((sum, entry) => sum + calcRow(entry, currentCcl).actualArs, 0)
      : (currentPriceArs && openQty > 0 ? currentPriceArs * openQty : investedArs);
    const investedUsd = currentCclValue && currentCclValue > 0 ? investedArs / currentCclValue : investedArs;
    const actualUsd = currentCclValue && currentCclValue > 0 ? actualArs / currentCclValue : actualArs;
    const realizedGainUsd = currentCclValue && currentCclValue > 0 ? realizedGainArs / currentCclValue : realizedGainArs;
    const sector = getSector(ticker, type);

    return {
      key,
      type,
      typeLabel: INSTRUMENT_LABELS[type],
      typeColor: INSTRUMENT_COLORS_HEX[type],
      name,
      ticker,
      sector,
      ppp,
      currentPriceArs,
      totalQty: openQty,
      invertidoArs: investedArs,
      actualArs,
      gananciaArs: actualArs - investedArs,
      invertidoUsd: investedUsd,
      actualUsd,
      gananciaUsd: actualUsd - investedUsd,
      realizedGainArs,
      realizedGainUsd,
      weightPct: 0,
      count: entries.length,
      entries,
      maturityDate,
      signals: [],
      sectorWeight: 0,
    };
  }).filter((position) => position.actualArs > 0 || position.invertidoArs > 0);

  const totalPortfolioArs = basePositions.reduce((sum, position) => sum + position.actualArs, 0);
  const sectorTotals = basePositions.reduce<Record<string, number>>((acc, position) => {
    acc[position.sector] = (acc[position.sector] ?? 0) + position.actualArs;
    return acc;
  }, {});

  return basePositions.map((position) => {
    const weightPct = totalPortfolioArs > 0 ? (position.actualArs / totalPortfolioArs) * 100 : 0;
    const sectorWeight = totalPortfolioArs > 0 && sectorTotals[position.sector]
      ? sectorTotals[position.sector] / totalPortfolioArs
      : 0;
    const returnPct = position.invertidoArs > 0 ? (position.actualArs - position.invertidoArs) / position.invertidoArs : 0;

    return {
      ...position,
      weightPct,
      sectorWeight,
      signals: calcPositionSignals(weightPct / 100, returnPct, sectorWeight, position.sector),
    };
  }).sort((a, b) => b.actualArs - a.actualArs);
}

export function sortPositions(list: EnhancedPosition[], key: SortKey | null, dir: SortDir, currency: Currency) {
  if (!key) return list;
  const isArs = currency === "ARS";

  return [...list].sort((a, b) => {
    let va = 0;
    let vb = 0;

    if (key === "nombre") return dir === "asc" ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
    if (key === "tipo") return dir === "asc" ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type);
    if (key === "invertido") { va = isArs ? a.invertidoArs : a.invertidoUsd; vb = isArs ? b.invertidoArs : b.invertidoUsd; }
    if (key === "actual") { va = isArs ? a.actualArs : a.actualUsd; vb = isArs ? b.actualArs : b.actualUsd; }
    if (key === "ganancia") { va = isArs ? a.gananciaArs : a.gananciaUsd; vb = isArs ? b.gananciaArs : b.gananciaUsd; }
    if (key === "pct") {
      va = a.invertidoArs > 0 ? a.gananciaArs / a.invertidoArs : 0;
      vb = b.invertidoArs > 0 ? b.gananciaArs / b.invertidoArs : 0;
    }
    if (key === "peso") { va = a.weightPct; vb = b.weightPct; }

    return dir === "asc" ? va - vb : vb - va;
  });
}

export function sortTransactions(
  list: InvestmentEntry[],
  key: SortKey | null,
  dir: SortDir,
  currency: Currency,
  currentCcl?: number | null,
) {
  if (!key) return list;

  return [...list].sort((a, b) => {
    const ra = calcRow(a, currentCcl);
    const rb = calcRow(b, currentCcl);
    const isArs = currency === "ARS";
    let va = 0;
    let vb = 0;

    if (key === "fecha") { va = new Date(a.transaction_date).getTime(); vb = new Date(b.transaction_date).getTime(); }
    else if (key === "tipo") return dir === "asc"
      ? (a.instrument_type ?? "").localeCompare(b.instrument_type ?? "")
      : (b.instrument_type ?? "").localeCompare(a.instrument_type ?? "");
    else if (key === "nombre") return dir === "asc"
      ? (a.ticker ?? a.name).localeCompare(b.ticker ?? b.name)
      : (b.ticker ?? b.name).localeCompare(a.ticker ?? a.name);
    else if (key === "invertido") { va = isArs ? ra.invertidoArs : ra.invertidoUsd; vb = isArs ? rb.invertidoArs : rb.invertidoUsd; }
    else if (key === "actual") { va = isArs ? ra.actualArs : ra.actualUsd; vb = isArs ? rb.actualArs : rb.actualUsd; }
    else if (key === "ganancia") { va = isArs ? ra.gananciaArs : ra.gananciaUsd; vb = isArs ? rb.gananciaArs : rb.gananciaUsd; }
    else if (key === "pct") { va = isArs ? ra.gananciaPctArs : ra.gananciaPctUsd; vb = isArs ? rb.gananciaPctArs : rb.gananciaPctUsd; }

    return dir === "asc" ? va - vb : vb - va;
  });
}

export function SortTH({
  label,
  col,
  sortCol,
  sortDir,
  onSort,
  right,
}: {
  label: string;
  col: SortKey;
  sortCol: SortKey | null;
  sortDir: SortDir;
  onSort: (c: SortKey) => void;
  right?: boolean;
}) {
  const active = sortCol === col;

  return (
    <th style={{ ...INVESTMENTS_TH, textAlign: right ? "right" : "left", cursor: "pointer" }} onClick={() => onSort(col)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {label}
        {active
          ? sortDir === "asc"
            ? <ArrowUp size={10} style={{ color: "var(--primary)" }} />
            : <ArrowDown size={10} style={{ color: "var(--primary)" }} />
          : <ArrowUpDown size={10} style={{ opacity: 0.35 }} />}
      </span>
    </th>
  );
}

export function TypeBadge({ type }: { type: InstrumentType }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: `${INSTRUMENT_COLORS[type]}22`,
        color: INSTRUMENT_COLORS[type],
      }}
    >
      {INSTRUMENT_LABELS[type]}
    </span>
  );
}

export function SignalBadges({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return <span style={{ color: "var(--text-3)", fontSize: "11px" }}>—</span>;

  return (
    <span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {signals.map((signal, index) => (
        <span
          key={index}
          style={{
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 600,
            background: signal.level === "danger"
              ? "color-mix(in srgb, var(--danger) 15%, transparent)"
              : "color-mix(in srgb, var(--warning) 15%, transparent)",
            color: signal.level === "danger" ? "var(--danger)" : "var(--warning)",
          }}
        >
          {signal.label}
        </span>
      ))}
    </span>
  );
}

export function makeTickerChangeHandler({
  instrType,
  setInstrType,
  setForm,
  setTickerDetection,
}: {
  instrType: InstrumentType;
  setInstrType: Dispatch<SetStateAction<InstrumentType>>;
  setForm: Dispatch<SetStateAction<InvestmentFormState>>;
  setTickerDetection: Dispatch<SetStateAction<TickerDetection | null>>;
}) {
  return (value: string, notify: (message: string) => void) => {
    const upper = value.toUpperCase();
    setForm((previous) => ({ ...previous, ticker: upper }));

    if (upper.length < 2) {
      setTickerDetection(null);
      return;
    }

    const detected = detectInstrumentType(upper);
    const switched = detected.confidence !== "low" && detected.type !== instrType;

    if (switched) {
      setInstrType(detected.type);
      notify(`Tipo detectado: ${INSTRUMENT_LABELS[detected.type]}`);
    }

    setTickerDetection({
      type: detected.type,
      confidence: detected.confidence,
      reason: detected.reason,
      switched,
    });
  };
}

export function renderDetectionChip({
  tickerDetection,
  formTicker,
  instrType,
}: {
  tickerDetection: TickerDetection | null;
  formTicker: string;
  instrType: InstrumentType;
}) {
  if (!tickerDetection || tickerDetection.confidence === "low" || !formTicker) return null;

  const isMatch = tickerDetection.type === instrType;
  const color = tickerDetection.confidence === "high"
    ? (isMatch ? "var(--success)" : "var(--primary)")
    : "var(--text-3)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "-6px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "10px",
          fontWeight: 600,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))`,
          borderRadius: "5px",
          padding: "2px 8px",
          color,
        }}
      >
        {tickerDetection.switched ? "⚡ Cambiado a:" : "✓"} {INSTRUMENT_LABELS[tickerDetection.type]}
      </span>
      <span style={{ fontSize: "10px", color: "var(--text-3)" }}>{tickerDetection.reason}</span>
    </div>
  );
}

export function investmentsTabStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 16px",
    fontSize: "12px",
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    borderRadius: "6px",
    background: active ? "var(--primary)" : "transparent",
    color: active ? "#fff" : "var(--text-3)",
    transition: "all 0.15s",
  };
}

export function withInstrumentName(entry: InvestmentEntry) {
  return entry.ticker ?? entry.name;
}

export function p(input: string) {
  return parseFloat(input.replace(",", ".")) || 0;
}

export function maybe(children: ReactNode) {
  return children;
}
