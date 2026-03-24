import { useState, useRef, useEffect, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Briefcase, Download, Upload,
  RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, DollarSign,
  ChevronRight, Target, BarChart2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getInvestments, createInvestment, deleteInvestment,
  fetchPrices, fetchCcl, updatePricesByTicker, updateInvestmentValue,
  savePortfolioSnapshot, getPortfolioSnapshots, getDashboardSummary,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportInvestmentsTemplate, importInvestments } from "@/lib/excel";
import { toast } from "sonner";
import type { InvestmentEntry, InstrumentType } from "@/types";

import {
  calcRow, getSector, calcCAGR, calcXIRR, calcPositionSignals,
  generateSmartInsights, detectInstrumentType,
  type CashFlow, type Signal,
} from "@/lib/investmentCalcs";
import { PortfolioKPIBar } from "@/components/investments/PortfolioKPIBar";
import { PortfolioChart } from "@/components/investments/PortfolioChart";
import { AllocationCharts } from "@/components/investments/AllocationCharts";
import { InsightsPanel } from "@/components/investments/InsightsPanel";
import { RebalanceModal } from "@/components/investments/RebalanceModal";
import { QK } from "@/lib/queryKeys";

const PROFILE_ID = "default";

// ─── Instrument config ────────────────────────────────────────────────────────
const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  cedear: "CEDEAR", accion: "Acción", plazo_fijo: "Plazo Fijo",
  bono: "Bono", fci: "FCI", crypto: "Cripto", otro: "Otro",
};

const INSTRUMENT_COLORS_HEX: Record<InstrumentType, string> = {
  cedear: "#4361ee", accion: "#7c3aed", plazo_fijo: "#06d6a0",
  bono: "#fb8500", fci: "#0891b2", crypto: "#f59e0b", otro: "#6b7280",
};

const INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  cedear: "var(--primary)", accion: "#7c3aed", plazo_fijo: "var(--success)",
  bono: "var(--warning)", fci: "#0891b2", crypto: "#f59e0b", otro: "var(--text-3)",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  padding: "8px 14px", fontSize: "10px", fontWeight: 600,
  color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase",
  textAlign: "left", whiteSpace: "nowrap", userSelect: "none",
};
const TD: React.CSSProperties = {
  padding: "9px 14px", fontSize: "12px",
  fontFamily: "var(--font-mono)", color: "var(--text-2)", whiteSpace: "nowrap",
};

type Currency = "ARS" | "USD";
type SortDir = "asc" | "desc";
type SortKey = "fecha" | "tipo" | "nombre" | "invertido" | "actual" | "ganancia" | "pct" | "peso";

// ─── Formatting ───────────────────────────────────────────────────────────────
function fNum(n: number, d = 2) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}
function fPct(n: number) { return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }

// ─── Enhanced Position ────────────────────────────────────────────────────────
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
  invertidoArs: number; actualArs: number; gananciaArs: number;
  invertidoUsd: number; actualUsd: number; gananciaUsd: number;
  weightPct: number; // 0-100, based on actualArs vs total actualArs
  count: number;
  entries: InvestmentEntry[];
  maturityDate: string | null;
  signals: Signal[];
  sectorWeight: number; // 0-1
}

function buildPositions(
  invs: InvestmentEntry[],
  totalPortfolioArs: number,
  sectorTotals: Record<string, number>,
  currentCcl?: number | null,
): EnhancedPosition[] {
  const map = new Map<string, { type: InstrumentType; name: string; ticker: string | null; entries: InvestmentEntry[] }>();
  for (const inv of invs) {
    const key = (inv.ticker ?? inv.name).toUpperCase();
    const ex = map.get(key);
    if (ex) ex.entries.push(inv);
    else map.set(key, { type: inv.instrument_type ?? "cedear", name: inv.name, ticker: inv.ticker, entries: [inv] });
  }

  return Array.from(map.entries()).map(([key, { type, name, ticker, entries }]) => {
    let totalQty = 0, sumQtyPrice = 0, currentPriceArs: number | null = null;
    let invertidoArs = 0, actualArs = 0, invertidoUsd = 0, actualUsd = 0;
    let maturityDate: string | null = null;

    for (const inv of entries) {
      const c = calcRow(inv, currentCcl);
      invertidoArs += c.invertidoArs; actualArs += c.actualArs;
      invertidoUsd += c.invertidoUsd; actualUsd += c.actualUsd;
      if (inv.quantity && inv.price_ars) {
        totalQty += inv.quantity;
        sumQtyPrice += inv.quantity * inv.price_ars;
        if (inv.current_price_ars) currentPriceArs = inv.current_price_ars;
      }
      if (inv.fecha_vencimiento) maturityDate = inv.fecha_vencimiento;
    }

    const ppp = (type === "cedear" || type === "accion" || type === "fci") && totalQty > 0
      ? sumQtyPrice / totalQty : null;
    const weightPct = totalPortfolioArs > 0 ? (actualArs / totalPortfolioArs) * 100 : 0;
    const sector = getSector(ticker, type);
    const sectorWeight = totalPortfolioArs > 0 && sectorTotals[sector]
      ? sectorTotals[sector] / totalPortfolioArs : 0;
    const returnPct = invertidoArs > 0 ? (actualArs - invertidoArs) / invertidoArs : 0;
    const signals = calcPositionSignals(weightPct / 100, returnPct, sectorWeight, sector);

    return {
      key, type, typeLabel: INSTRUMENT_LABELS[type],
      typeColor: INSTRUMENT_COLORS_HEX[type],
      name, ticker, sector, ppp, currentPriceArs, totalQty,
      invertidoArs, actualArs, gananciaArs: actualArs - invertidoArs,
      invertidoUsd, actualUsd, gananciaUsd: actualUsd - invertidoUsd,
      weightPct, count: entries.length, entries,
      maturityDate, signals, sectorWeight,
    };
  }).sort((a, b) => b.actualArs - a.actualArs);
}

// ─── Sort ─────────────────────────────────────────────────────────────────────
function sortPositions(list: EnhancedPosition[], key: SortKey | null, dir: SortDir, currency: Currency) {
  if (!key) return list;
  const isArs = currency === "ARS";
  return [...list].sort((a, b) => {
    let va = 0, vb = 0;
    if (key === "nombre") return dir === "asc"
      ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
    if (key === "tipo") return dir === "asc"
      ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type);
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

function sortTransactions(list: InvestmentEntry[], key: SortKey | null, dir: SortDir, currency: Currency, currentCcl?: number | null) {
  if (!key) return list;
  return [...list].sort((a, b) => {
    const ra = calcRow(a, currentCcl), rb = calcRow(b, currentCcl);
    const isArs = currency === "ARS";
    let va = 0, vb = 0;
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

function SortTH({ label, col, sortCol, sortDir, onSort, right }: {
  label: string; col: SortKey; sortCol: SortKey | null; sortDir: SortDir;
  onSort: (c: SortKey) => void; right?: boolean;
}) {
  const active = sortCol === col;
  return (
    <th style={{ ...TH, textAlign: right ? "right" : "left", cursor: "pointer" }} onClick={() => onSort(col)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        {label}
        {active
          ? sortDir === "asc" ? <ArrowUp size={10} style={{ color: "var(--primary)" }} /> : <ArrowDown size={10} style={{ color: "var(--primary)" }} />
          : <ArrowUpDown size={10} style={{ opacity: 0.35 }} />}
      </span>
    </th>
  );
}

function TypeBadge({ type }: { type: InstrumentType }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 7px", borderRadius: "4px", fontSize: "10px",
      fontWeight: 700, letterSpacing: "0.05em",
      background: INSTRUMENT_COLORS[type] + "22",
      color: INSTRUMENT_COLORS[type],
    }}>
      {INSTRUMENT_LABELS[type]}
    </span>
  );
}

function SignalBadges({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return <span style={{ color: "var(--text-3)", fontSize: "11px" }}>—</span>;
  return (
    <span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {signals.map((s, i) => (
        <span key={i} style={{
          fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: 600,
          background: s.level === "danger"
            ? "color-mix(in srgb, var(--danger) 15%, transparent)"
            : "color-mix(in srgb, var(--warning) 15%, transparent)",
          color: s.level === "danger" ? "var(--danger)" : "var(--warning)",
        }}>
          {s.label}
        </span>
      ))}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Investments() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"resumen" | "transacciones">("resumen");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [filterText, setFilterText] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortKey | null>("actual");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentCcl, setCurrentCcl] = useState<number | null>(null);
  const [instrType, setInstrType] = useState<InstrumentType>("cedear");
  const [expandedPos, setExpandedPos] = useState<string | null>(null);

  const emptyForm = {
    ticker: "", name: "", quantity: "", price_ars: "", dolar_ccl: "",
    current_price_ars: "", transaction_date: new Date().toISOString().split("T")[0],
    notes: "", tna: "", plazo_dias: "", fecha_vencimiento: "",
  };
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: investments = [], isLoading } = useQuery({
    queryKey: QK.investments(),
    queryFn: () => getInvestments(PROFILE_ID),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: QK.portfolioSnapshots(),
    queryFn: () => getPortfolioSnapshots(PROFILE_ID),
  });

  useEffect(() => { fetchCcl().then(setCurrentCcl).catch(() => {}); }, []);

  const { data: dashSummary } = useQuery({
    queryKey: QK.dashboard(new Date().getFullYear(), new Date().getMonth() + 1),
    queryFn: () => getDashboardSummary(PROFILE_ID, new Date().getFullYear(), new Date().getMonth() + 1),
    staleTime: 60_000,
  });

  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => investments.reduce((acc, inv) => {
    const c = calcRow(inv, currentCcl);
    return {
      invertidoArs: acc.invertidoArs + c.invertidoArs,
      actualArs: acc.actualArs + c.actualArs,
      invertidoUsd: acc.invertidoUsd + c.invertidoUsd,
      actualUsd: acc.actualUsd + c.actualUsd,
    };
  }, { invertidoArs: 0, actualArs: 0, invertidoUsd: 0, actualUsd: 0 }), [investments, currentCcl]);

  // ─── Sector totals (for signal calc) ─────────────────────────────────────────
  const sectorTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of investments) {
      const s = getSector(inv.ticker, inv.instrument_type ?? "cedear");
      const c = calcRow(inv, currentCcl);
      map[s] = (map[s] ?? 0) + c.actualArs;
    }
    return map;
  }, [investments, currentCcl]);

  // ─── Positions ───────────────────────────────────────────────────────────────
  const positions = useMemo(
    () => buildPositions(investments, totals.actualArs, sectorTotals, currentCcl),
    [investments, totals.actualArs, sectorTotals, currentCcl],
  );

  // ─── CAGR / XIRR ─────────────────────────────────────────────────────────────
  const { cagr, xirr } = useMemo(() => {
    if (investments.length === 0) return { cagr: 0, xirr: null };
    const sorted = [...investments].sort((a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    const firstDate = new Date(sorted[0].transaction_date);
    const cagr = calcCAGR(totals.invertidoArs, totals.actualArs, firstDate);

    const cashFlows: CashFlow[] = investments.map(inv => {
      const c = calcRow(inv, currentCcl);
      return { date: new Date(inv.transaction_date), amount: -c.invertidoArs };
    });
    cashFlows.push({ date: new Date(), amount: totals.actualArs });
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
    const xirr = calcXIRR(cashFlows);
    return { cagr, xirr };
  }, [investments, totals, currentCcl]);

  // ─── Smart insights ───────────────────────────────────────────────────────────
  const insights = useMemo(() => generateSmartInsights(
    positions.map(p => ({
      key: p.key, type: p.type, sector: p.sector,
      currentValue: p.actualArs, totalInvested: p.invertidoArs,
      returnPct: p.invertidoArs > 0 ? (p.gananciaArs / p.invertidoArs) : 0,
      count: p.count, ppp: p.ppp,
      maturityDate: p.maturityDate,
    })),
    totals.actualArs,
    dashSummary?.balance ?? 0,
  ), [positions, totals.actualArs, dashSummary]);

  // ─── Chart data ───────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (investments.length === 0) return [];
    const sortedInvs = [...investments].sort((a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    const dateGroups = new Map<string, InvestmentEntry[]>();
    for (const inv of sortedInvs) {
      const d = inv.transaction_date.slice(0, 10);
      if (!dateGroups.has(d)) dateGroups.set(d, []);
      dateGroups.get(d)!.push(inv);
    }
    let cumInvested = 0;
    const points: Array<{ date: string; invested: number; portfolio: number }> = [];
    const isArs = currency === "ARS";
    for (const [date, invs] of dateGroups) {
      for (const inv of invs) {
        const c = calcRow(inv, currentCcl);
        cumInvested += isArs ? c.invertidoArs : c.invertidoUsd;
      }
      points.push({ date, invested: cumInvested, portfolio: cumInvested });
    }
    // Last point = current portfolio value
    const todayVal = isArs ? totals.actualArs : totals.actualUsd;
    if (points.length > 0) {
      points[points.length - 1].portfolio = todayVal;
    }
    return points;
  }, [investments, totals, currency]);

  const sym = currency === "ARS" ? "$" : "USD ";
  const dispInv = currency === "ARS" ? totals.invertidoArs : totals.invertidoUsd;
  const dispAct = currency === "ARS" ? totals.actualArs : totals.actualUsd;
  const dispGan = dispAct - dispInv;
  const isGainPos = dispGan >= 0;

  // Retorno USD real (usa CCL actual para valor presente, CCL compra para costo)
  const portfolioReturnPctUsd = currentCcl && totals.invertidoUsd > 0
    ? ((totals.actualUsd - totals.invertidoUsd) / totals.invertidoUsd) * 100
    : undefined;

  // ─── Filter & sort ────────────────────────────────────────────────────────────
  const filteredPositions = useMemo(() => {
    let list = positions;
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(p => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    if (sectorFilter) {
      list = list.filter(p => p.sector === sectorFilter);
    }
    return sortPositions(list, sortCol, sortDir, currency);
  }, [positions, filterText, sectorFilter, sortCol, sortDir, currency]);

  const filteredTransactions = useMemo(() => {
    let list = investments;
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(inv => (inv.ticker ?? "").toLowerCase().includes(q) || inv.name.toLowerCase().includes(q));
    }
    return sortTransactions(list, sortCol, sortDir, currency, currentCcl);
  }, [investments, filterText, sortCol, sortDir, currency, currentCcl]);

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const p = (s: string) => parseFloat(s.replace(",", ".")) || 0;

  const addMutation = useMutation({
    mutationFn: () => {
      const qty = p(form.quantity), priceArs = p(form.price_ars);
      const ccl = p(form.dolar_ccl), currPrice = p(form.current_price_ars) || priceArs;
      const tna = p(form.tna), dias = parseInt(form.plazo_dias) || 0;
      let amtInvested = 0, currValue = 0;
      if (instrType === "plazo_fijo") {
        amtInvested = priceArs;
        currValue = priceArs * (1 + (tna / 100) * (dias / 365));
      } else if (instrType === "fci") {
        amtInvested = qty * priceArs;
        currValue = qty * currPrice;
      } else if (instrType === "bono") {
        amtInvested = qty * (priceArs / 100); currValue = qty * (currPrice / 100);
      } else if (instrType === "crypto") {
        amtInvested = qty * priceArs; currValue = qty * currPrice;
      } else {
        amtInvested = ccl > 0 ? (priceArs * qty) / ccl : 0;
        currValue = ccl > 0 ? (currPrice * qty) / ccl : 0;
      }
      return createInvestment({
        profile_id: PROFILE_ID, name: form.name || form.ticker,
        ticker: form.ticker || undefined, amount_invested: amtInvested,
        current_value: currValue || undefined, transaction_date: form.transaction_date,
        notes: form.notes || undefined, quantity: qty || undefined,
        price_ars: priceArs || undefined, dolar_ccl: ccl || undefined,
        current_price_ars: currPrice || undefined, instrument_type: instrType,
        tna: tna || undefined, plazo_dias: dias || undefined,
        fecha_vencimiento: form.fecha_vencimiento || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.investments() });
      setModalOpen(false); setForm(emptyForm);
      toast.success("Inversión registrada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvestment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.investments() });
      setDeleteId(null); toast.success("Inversión eliminada");
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);

  const savePrice = async (inv: InvestmentEntry) => {
    if (!editingPrice) return;
    const newPrice = parseFloat(editingPrice.value.replace(",", "."));
    if (isNaN(newPrice) || newPrice <= 0) { setEditingPrice(null); return; }
    const ccl = inv.dolar_ccl ?? 1, qty = inv.quantity ?? 1;
    const newCurrentValue = ccl > 0 ? (newPrice * qty) / ccl : inv.current_value ?? 0;
    try {
      await updateInvestmentValue(inv.id, newCurrentValue, newPrice);
      qc.invalidateQueries({ queryKey: QK.investments() });
      toast.success("Precio actualizado");
    } catch (e) { toast.error(String(e)); }
    setEditingPrice(null);
  };

  const handleRefreshPrices = async () => {
    const cedearAccion = investments.filter(i => i.instrument_type === "cedear" || i.instrument_type === "accion");
    const tickers = [...new Set(cedearAccion.map(i => i.ticker ?? i.name).filter(Boolean))];
    if (tickers.length === 0) { toast.error("No hay CEDEARs/Acciones para actualizar"); return; }
    setRefreshing(true);
    try {
      const [prices, ccl] = await Promise.all([fetchPrices(tickers), fetchCcl().catch(() => null)]);
      if (prices.length === 0) { toast.error("No se obtuvieron precios"); return; }
      const updates = prices.map(pr => ({ ticker: pr.ticker, price_ars: pr.price_ars }));
      const updated = await updatePricesByTicker(PROFILE_ID, updates, ccl ?? undefined);
      if (ccl) setCurrentCcl(ccl);
      qc.invalidateQueries({ queryKey: QK.investments() });
      toast.success(`${updated} posición(es) actualizadas · CCL: $${ccl ? fNum(ccl, 0) : "—"}`);

      // Save portfolio snapshot after price refresh
      try {
        const recalcArs = investments.reduce((s, inv) => s + calcRow(inv, ccl ?? currentCcl).actualArs, 0);
        const recalcUsd = investments.reduce((s, inv) => s + calcRow(inv, ccl ?? currentCcl).actualUsd, 0);
        const recalcInvArs = investments.reduce((s, inv) => s + calcRow(inv, ccl ?? currentCcl).invertidoArs, 0);
        await savePortfolioSnapshot(PROFILE_ID, recalcArs, recalcUsd, recalcInvArs, ccl ?? currentCcl ?? 0);
        qc.invalidateQueries({ queryKey: QK.portfolioSnapshots() });
      } catch { /* snapshot is non-critical */ }
    } catch (e) { toast.error(String(e)); }
    finally { setRefreshing(false); }
  };

  const importRef = useRef<HTMLInputElement>(null);
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importInvestments(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas"); return; }
      for (const r of rows) {
        await createInvestment({
          profile_id: PROFILE_ID, name: r.name, ticker: r.ticker || undefined,
          amount_invested: r.amount_invested, current_value: r.current_value || undefined,
          transaction_date: r.transaction_date, notes: r.notes || undefined,
          quantity: r.quantity, price_ars: r.price_ars,
          dolar_ccl: r.dolar_ccl, current_price_ars: r.current_price_ars,
          instrument_type: "cedear",
        });
      }
      qc.invalidateQueries({ queryKey: QK.investments() });
      toast.success(`${rows.length} inversión(es) importada(s)`);
    } catch { toast.error("Error al importar. Verificá el formato."); }
    e.target.value = "";
  };

  // ─── Form fields ─────────────────────────────────────────────────────────────
  const formFields = () => {
    if (instrType === "plazo_fijo") return (
      <>
        <Input label="Entidad / Banco *" placeholder="Ej: Banco Nación" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <Input label="Monto invertido $ *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
          <Input label="TNA % *" type="text" inputMode="decimal" value={form.tna} onChange={e => setForm(f => ({ ...f, tna: e.target.value }))} />
          <Input label="Plazo (días) *" type="text" inputMode="numeric" value={form.plazo_dias} onChange={e => setForm(f => ({ ...f, plazo_dias: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Fecha inicio *" type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
          <Input label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
        </div>
        {form.price_ars && form.tna && form.plazo_dias && (
          <div style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--text-3)" }}>
            Ganancia estimada: <strong style={{ color: "var(--success)", fontFamily: "var(--font-mono)" }}>
              ${fNum(p(form.price_ars) * (p(form.tna) / 100) * (parseInt(form.plazo_dias) / 365))}
            </strong>
          </div>
        )}
      </>
    );
    if (instrType === "fci") return (
      <>
        <Input label="Nombre del fondo *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Cuotapartes *" type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="VCP compra $ *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
        </div>
        <Input label="VCP actual $" type="text" inputMode="decimal" value={form.current_price_ars} onChange={e => setForm(f => ({ ...f, current_price_ars: e.target.value }))} />
      </>
    );
    if (instrType === "bono") return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Ticker *" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
          <Input label="Nombre (opcional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
          <Input label="VN *" type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Precio % *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
          <Input label="CCL" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={e => setForm(f => ({ ...f, dolar_ccl: e.target.value }))} />
          <Input label="Precio actual %" type="text" inputMode="decimal" value={form.current_price_ars} onChange={e => setForm(f => ({ ...f, current_price_ars: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Fecha compra *" type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
          <Input label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
        </div>
      </>
    );
    if (instrType === "crypto") return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Ticker *" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
          <Input label="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <Input label="Cantidad *" type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Precio USD compra *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
          <Input label="Precio USD actual" type="text" inputMode="decimal" value={form.current_price_ars} onChange={e => setForm(f => ({ ...f, current_price_ars: e.target.value }))} />
        </div>
        <Input label="Dólar CCL" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={e => setForm(f => ({ ...f, dolar_ccl: e.target.value }))} />
      </>
    );
    if (instrType === "otro") return (
      <>
        <Input label="Descripción *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Monto invertido *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
          <Input label="Valor actual" type="text" inputMode="decimal" value={form.current_price_ars} onChange={e => setForm(f => ({ ...f, current_price_ars: e.target.value }))} />
        </div>
      </>
    );
    // cedear / accion
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Ticker *" placeholder="Ej: NVDA" value={form.ticker} onChange={e => {
            const val = e.target.value.toUpperCase();
            setForm(f => ({ ...f, ticker: val }));
            if (val.length >= 2) {
              const detected = detectInstrumentType(val);
              if (detected.confidence !== "low" && detected.type !== instrType) {
                setInstrType(detected.type);
              }
            }
          }} />
          <Input label="Nombre (opcional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <Input label="Cantidad *" type="text" inputMode="numeric" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Precio ARS *" type="text" inputMode="decimal" value={form.price_ars} onChange={e => setForm(f => ({ ...f, price_ars: e.target.value }))} />
          <Input label="Dólar CCL *" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={e => setForm(f => ({ ...f, dolar_ccl: e.target.value }))} />
        </div>
        <Input label="Precio actual ARS" type="text" inputMode="decimal" value={form.current_price_ars} onChange={e => setForm(f => ({ ...f, current_price_ars: e.target.value }))} />
        {form.price_ars && form.dolar_ccl && form.quantity && (
          <div style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--text-3)" }}>
            Total: <strong style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
              USD {fNum((p(form.price_ars) * p(form.quantity)) / p(form.dolar_ccl))}
            </strong>
          </div>
        )}
      </>
    );
  };

  const canSave = () => {
    if (instrType === "plazo_fijo") return !!form.name && !!form.price_ars && !!form.tna && !!form.plazo_dias;
    if (instrType === "fci") return !!form.name && !!form.quantity && !!form.price_ars;
    if (instrType === "bono") return !!form.ticker && !!form.quantity && !!form.price_ars;
    if (instrType === "crypto") return !!form.ticker && !!form.quantity && !!form.price_ars;
    if (instrType === "otro") return !!form.name && !!form.price_ars;
    return !!form.ticker && !!form.quantity && !!form.price_ars && !!form.dolar_ccl;
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", fontSize: "12px", fontWeight: 500, border: "none", cursor: "pointer",
    borderRadius: "6px", background: active ? "var(--primary)" : "transparent",
    color: active ? "#fff" : "var(--text-3)", transition: "all 0.15s",
  });

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: "1560px" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Inversiones</h1>
          {currentCcl && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "6px", padding: "3px 8px", fontSize: "11px",
              color: "var(--text-3)", fontFamily: "var(--font-mono)",
            }}>
              <DollarSign size={10} />CCL: <strong style={{ color: "var(--text-2)" }}>${fNum(currentCcl, 0)}</strong>
            </span>
          )}
          {sectorFilter && (
            <span
              onClick={() => setSectorFilter(null)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
                borderRadius: "6px", padding: "3px 10px", fontSize: "11px",
                color: "var(--primary)", cursor: "pointer", fontWeight: 500,
              }}
            >
              Sector: {sectorFilter} ×
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Currency toggle */}
          <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            {(["ARS", "USD"] as Currency[]).map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                borderRadius: "6px", fontFamily: "var(--font-mono)",
                background: currency === c ? "var(--primary)" : "transparent",
                color: currency === c ? "#fff" : "var(--text-3)", transition: "all 0.15s",
              }}>{c}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setRebalanceOpen(true)} title="Simular rebalanceo">
            <Target size={13} /> Rebalanceo
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshPrices} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Actualizando..." : "Actualizar precios"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportInvestmentsTemplate()}><Download size={13} /> Plantilla</Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}><Upload size={13} /> Importar</Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <Button onClick={() => { setModalOpen(true); setForm(emptyForm); }}><Plus size={14} /> Nueva inversión</Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: "80px" }} />)}
        </div>
      ) : investments.length === 0 ? (
        <Card style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Briefcase size={28} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-2)", marginBottom: "4px" }}>Sin inversiones registradas</p>
            <p style={{ fontSize: "13px", color: "var(--text-3)" }}>Agregá tu primera inversión para ver el dashboard</p>
          </div>
          <Button onClick={() => setModalOpen(true)}><Plus size={14} /> Nueva inversión</Button>
        </Card>
      ) : (
        <>
          {/* ── KPI Bar ─────────────────────────────────────────────────────── */}
          <div className="animate-fade-in-up">
            <PortfolioKPIBar
              portfolioValue={dispAct}
              totalInvested={dispInv}
              cagr={cagr}
              xirr={xirr}
              currency={currency}
              sym={sym}
              returnPctUsd={portfolioReturnPctUsd}
            />
          </div>

          {/* ── Chart ───────────────────────────────────────────────────────── */}
          <div className="animate-fade-in-up" style={{ marginBottom: "16px" }}>
            <PortfolioChart chartData={chartData} snapshots={snapshots} currency={currency} sym={sym} />
          </div>

          {/* ── Allocation Charts ────────────────────────────────────────────── */}
          <div className="animate-fade-in-up">
            <AllocationCharts
              positions={positions.map(pos => ({
                key: pos.key,
                type: pos.type,
                typeLabel: pos.typeLabel,
                typeColor: pos.typeColor,
                sector: pos.sector,
                currentValueArs: pos.actualArs,
                currentValueUsd: pos.actualUsd,
                invertidoArs: pos.invertidoArs,
              }))}
              currency={currency}
              sym={sym}
              onSectorClick={setSectorFilter}
              activeSector={sectorFilter}
            />
          </div>

          {/* ── Insights ─────────────────────────────────────────────────────── */}
          <div className="animate-fade-in-up">
            <InsightsPanel insights={insights} />
          </div>

          {/* ── Tabs + Filter ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface-2)", padding: "4px", borderRadius: "8px" }}>
              <button style={tabStyle(activeTab === "resumen")} onClick={() => setActiveTab("resumen")}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <BarChart2 size={12} /> Posiciones
                </span>
              </button>
              <button style={tabStyle(activeTab === "transacciones")} onClick={() => setActiveTab("transacciones")}>
                Transacciones
              </button>
            </div>
            <input
              type="text" placeholder="Filtrar por instrumento..." value={filterText}
              onChange={e => setFilterText(e.target.value)}
              style={{
                height: "32px", width: "220px", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-light)", background: "var(--surface-2)",
                padding: "0 10px", fontSize: "12px", color: "var(--text)",
                fontFamily: "var(--font-ui)", outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--primary)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--border-light)")}
            />
          </div>

          {/* ── Positions Table ───────────────────────────────────────────────── */}
          {activeTab === "resumen" && (
            <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <SortTH label="Instrumento" col="nombre" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <SortTH label="Tipo" col="tipo" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <th style={TH}>Sector</th>
                      <th style={{ ...TH, textAlign: "right" }}>PPP</th>
                      <th style={{ ...TH, textAlign: "right" }}>Precio Act.</th>
                      <SortTH label={`Invertido ${currency}`} col="invertido" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label={`Valor Act. ${currency}`} col="actual" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label={`Gan. ${currency}`} col="ganancia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label="% Ret." col="pct" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label="Peso" col="peso" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <th style={{ ...TH }}>Señales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPositions.map((pos, i) => {
                      const isArs = currency === "ARS";
                      const invertido = isArs ? pos.invertidoArs : pos.invertidoUsd;
                      const actual = isArs ? pos.actualArs : pos.actualUsd;
                      const ganancia = isArs ? pos.gananciaArs : pos.gananciaUsd;
                      const returnPct = invertido > 0 ? (ganancia / invertido) * 100 : 0;
                      const isPos = ganancia >= 0;
                      const isExpanded = expandedPos === pos.key;
                      const isLast = i === filteredPositions.length - 1;
                      const rowBg = isPos
                        ? "color-mix(in srgb, var(--success) 4%, transparent)"
                        : "color-mix(in srgb, var(--danger) 4%, transparent)";

                      return (
                        <Fragment key={pos.key}>
                          <tr
                            onClick={() => setExpandedPos(isExpanded ? null : pos.key)}
                            style={{
                              borderBottom: !isExpanded && !isLast ? "1px solid var(--border-light)" : isExpanded ? "1px solid var(--border-light)" : "none",
                              cursor: "pointer",
                              background: isExpanded ? "var(--surface-2)" : "transparent",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = rowBg; }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                          >
                            <td style={{ ...TD, fontFamily: "var(--font-ui)", fontWeight: 600, color: "var(--text)" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <ChevronRight size={13} style={{ color: "var(--text-3)", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
                                {pos.key}
                                {pos.name && pos.name.toUpperCase() !== pos.key && (
                                  <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: "11px" }}>{pos.name}</span>
                                )}
                                {pos.count > 1 && (
                                  <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "var(--surface-3)", color: "var(--text-3)" }}>{pos.count}</span>
                                )}
                              </span>
                            </td>
                            <td style={{ ...TD, fontFamily: "var(--font-ui)" }}><TypeBadge type={pos.type} /></td>
                            <td style={{ ...TD, fontFamily: "var(--font-ui)" }}>
                              <span
                                onClick={e => { e.stopPropagation(); setSectorFilter(sectorFilter === pos.sector ? null : pos.sector); }}
                                style={{
                                  fontSize: "11px", cursor: "pointer",
                                  padding: "1px 6px", borderRadius: "4px",
                                  background: sectorFilter === pos.sector ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
                                  color: sectorFilter === pos.sector ? "var(--primary)" : "var(--text-3)",
                                  transition: "all 0.12s",
                                }}
                                title="Filtrar por sector"
                              >
                                {pos.sector}
                              </span>
                            </td>
                            <td style={{ ...TD, textAlign: "right" }}>
                              {pos.ppp !== null ? <span style={{ color: "var(--text-2)" }}>${fNum(pos.ppp)}</span> : <span style={{ color: "var(--text-3)" }}>—</span>}
                            </td>
                            <td style={{ ...TD, textAlign: "right" }}>
                              {pos.currentPriceArs !== null ? (
                                <span style={{ color: pos.currentPriceArs > (pos.ppp ?? pos.currentPriceArs) ? "var(--success)" : pos.currentPriceArs < (pos.ppp ?? pos.currentPriceArs) ? "var(--danger)" : "var(--text-2)" }}>
                                  ${fNum(pos.currentPriceArs)}
                                </span>
                              ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                            </td>
                            <td style={{ ...TD, textAlign: "right" }}>{sym}{fNum(invertido)}</td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}>{sym}{fNum(actual)}</td>
                            <td style={{ ...TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                              {isPos ? "+" : ""}{sym}{fNum(ganancia)}
                            </td>
                            <td style={{ ...TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                              {fPct(returnPct)}
                            </td>
                            <td style={{ ...TD, textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                                <div style={{ width: "44px", height: "5px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min(pos.weightPct, 100)}%`, background: pos.signals.some(s => s.level === "danger") ? "var(--danger)" : pos.signals.some(s => s.level === "warning") ? "var(--warning)" : INSTRUMENT_COLORS_HEX[pos.type], borderRadius: "3px" }} />
                                </div>
                                <span style={{ fontSize: "11px", color: "var(--text-3)", minWidth: "34px", textAlign: "right" }}>{pos.weightPct.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td style={{ ...TD, fontFamily: "var(--font-ui)" }}>
                              <SignalBadges signals={pos.signals} />
                            </td>
                          </tr>

                          {/* ── Drill-down ─────────────────────────────────── */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={11} style={{ padding: 0, borderBottom: !isLast ? "1px solid var(--border)" : "none" }}>
                                <div style={{
                                  background: "var(--surface-3, var(--surface-2))",
                                  borderLeft: `3px solid ${INSTRUMENT_COLORS_HEX[pos.type]}`,
                                  padding: "12px 24px 16px 36px",
                                }}>
                                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                                    Detalle de operaciones — {pos.key}
                                  </div>
                                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                      <tr>
                                        {["Fecha", "Detalles", "Precio compra", "Precio actual", "Invertido", "Valor act.", "Ganancia", "% Gan."].map((h, hi) => (
                                          <th key={hi} style={{ ...TH, padding: "4px 10px", background: "transparent", textAlign: hi >= 2 ? "right" : "left" }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pos.entries.slice().sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()).map((inv, ei) => {
                                        const c = calcRow(inv, currentCcl);
                                        const dInv = isArs ? c.invertidoArs : c.invertidoUsd;
                                        const dAct = isArs ? c.actualArs : c.actualUsd;
                                        const dGan = isArs ? c.gananciaArs : c.gananciaUsd;
                                        const dPct = dInv > 0 ? (dGan / dInv) * 100 : 0;
                                        const dPos = dGan >= 0;
                                        const entryPrice = inv.price_ars ?? 0;
                                        const pppDiff = pos.ppp !== null && entryPrice > 0 ? ((entryPrice - pos.ppp) / pos.ppp) * 100 : null;
                                        return (
                                          <tr key={inv.id} style={{ borderTop: ei > 0 ? "1px solid var(--border-light)" : "none" }}>
                                            <td style={{ ...TD, padding: "6px 10px", color: "var(--text-3)", fontSize: "11px" }}>{formatDate(inv.transaction_date)}</td>
                                            <td style={{ ...TD, padding: "6px 10px", color: "var(--text-3)", fontSize: "11px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{c.detalles || "—"}</td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>
                                              {entryPrice > 0 ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                  ${fNum(entryPrice)}
                                                  {pppDiff !== null && (
                                                    <span style={{ fontSize: "9px", color: pppDiff > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                                                      {pppDiff > 0 ? "▲" : "▼"}{Math.abs(pppDiff).toFixed(1)}%
                                                    </span>
                                                  )}
                                                </span>
                                              ) : "—"}
                                            </td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>
                                              {inv.current_price_ars ? `$${fNum(inv.current_price_ars)}` : <span style={{ color: "var(--text-3)" }}>—</span>}
                                            </td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>{sym}{fNum(dInv)}</td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>{sym}{fNum(dAct)}</td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px", color: dPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                              {dPos ? "+" : ""}{sym}{fNum(dGan)}
                                            </td>
                                            <td style={{ ...TD, padding: "6px 10px", textAlign: "right", fontSize: "11px", color: dPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                              {fPct(dPct)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    {pos.count > 1 && pos.ppp !== null && (
                                      <tfoot>
                                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                                          <td colSpan={2} style={{ ...TD, padding: "6px 10px", fontSize: "11px", color: "var(--text-3)" }}>PPP consolidado</td>
                                          <td colSpan={6} style={{ ...TD, padding: "6px 10px", fontSize: "11px" }}>
                                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)", fontWeight: 700 }}>${fNum(pos.ppp)}</span>
                                            <span style={{ color: "var(--text-3)", marginLeft: 8 }}>· {fNum(pos.totalQty, pos.totalQty % 1 === 0 ? 0 : 2)} unidades</span>
                                            {pos.currentPriceArs && (
                                              <span style={{ marginLeft: 8, color: pos.currentPriceArs >= pos.ppp ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                                · {pos.currentPriceArs >= pos.ppp ? "▲" : "▼"} {Math.abs(((pos.currentPriceArs - pos.ppp) / pos.ppp) * 100).toFixed(1)}% vs PPP
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {/* Totals row */}
                    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-2)" }}>
                      <td style={{ ...TD, fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--text)" }} colSpan={2}>TOTAL</td>
                      <td colSpan={3} style={{ ...TD, color: "var(--text-3)", fontSize: "11px" }}>
                        {filteredPositions.length} posición{filteredPositions.length !== 1 ? "es" : ""} · {investments.length} transacción{investments.length !== 1 ? "es" : ""}
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{sym}{fNum(dispInv)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{sym}{fNum(dispAct)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: isGainPos ? "var(--success)" : "var(--danger)" }}>
                        {isGainPos ? "+" : ""}{sym}{fNum(dispGan)}
                      </td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: isGainPos ? "var(--success)" : "var(--danger)" }}>
                        {dispInv > 0 ? fPct((dispGan / dispInv) * 100) : "—"}
                      </td>
                      <td colSpan={2} style={{ ...TD, textAlign: "right", fontWeight: 700, color: "var(--text-3)", fontSize: "11px" }}>100%</td>
                    </tr>
                  </tbody>
                </table>
                {filteredPositions.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: "13px" }}>
                    No hay posiciones para "{filterText || sectorFilter}"
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── Transactions Tab ─────────────────────────────────────────────── */}
          {activeTab === "transacciones" && (
            <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <SortTH label="Fecha" col="fecha" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <SortTH label="Tipo" col="tipo" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <SortTH label="Instrumento" col="nombre" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <th style={TH}>Detalles</th>
                      <SortTH label={`Invertido ${currency}`} col="invertido" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label={`Valor Act. ${currency}`} col="actual" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label={`Gan. ${currency}`} col="ganancia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <SortTH label="% Gan." col="pct" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} right />
                      <th style={{ ...TH, width: "36px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((inv, i) => {
                      const c = calcRow(inv, currentCcl);
                      const isArs = currency === "ARS";
                      const investido = isArs ? c.invertidoArs : c.invertidoUsd;
                      const actual = isArs ? c.actualArs : c.actualUsd;
                      const ganancia = isArs ? c.gananciaArs : c.gananciaUsd;
                      const pct = isArs ? c.gananciaPctArs : c.gananciaPctUsd;
                      const isPos = ganancia >= 0;
                      const type = inv.instrument_type ?? "cedear";
                      return (
                        <tr key={inv.id}
                          style={{ borderBottom: i !== filteredTransactions.length - 1 ? "1px solid var(--border-light)" : "none", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ ...TD, color: "var(--text-3)" }}>{formatDate(inv.transaction_date)}</td>
                          <td style={{ ...TD, fontFamily: "var(--font-ui)" }}><TypeBadge type={type} /></td>
                          <td style={{ ...TD, fontFamily: "var(--font-ui)", fontWeight: 600, color: "var(--text)" }}>
                            {inv.ticker ?? inv.name}
                            {inv.ticker && inv.name && inv.name !== inv.ticker && (
                              <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: "11px", marginLeft: 4 }}>{inv.name}</span>
                            )}
                          </td>
                          <td style={{ ...TD, color: "var(--text-3)", fontSize: "11px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>{c.detalles}</td>
                          <td style={{ ...TD, textAlign: "right" }}>{sym}{fNum(investido)}</td>
                          <td
                            style={{ ...TD, textAlign: "right", cursor: type !== "plazo_fijo" ? "pointer" : "default" }}
                            title={type !== "plazo_fijo" ? "Click para editar precio actual" : undefined}
                            onClick={() => type !== "plazo_fijo" && setEditingPrice({ id: inv.id, value: inv.current_price_ars?.toString() ?? "" })}
                          >
                            {editingPrice?.id === inv.id ? (
                              <input autoFocus type="text" inputMode="decimal"
                                value={editingPrice.value}
                                onChange={e => setEditingPrice({ id: inv.id, value: e.target.value })}
                                onBlur={() => savePrice(inv)}
                                onKeyDown={e => { if (e.key === "Enter") savePrice(inv); if (e.key === "Escape") setEditingPrice(null); }}
                                onClick={e => e.stopPropagation()}
                                style={{ width: "90px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "4px", padding: "2px 6px", color: "var(--text)", outline: "none" }}
                              />
                            ) : (
                              <span style={type !== "plazo_fijo" ? { borderBottom: "1px dashed var(--border)" } : {}}>
                                {sym}{fNum(actual)}
                              </span>
                            )}
                          </td>
                          <td style={{ ...TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                            {isPos ? "+" : ""}{sym}{fNum(ganancia)}
                          </td>
                          <td style={{ ...TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                            {fPct(pct)}
                          </td>
                          <td style={{ ...TD, textAlign: "right" }}>
                            <button onClick={() => setDeleteId(inv.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
                            ><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTransactions.length === 0 && filterText && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: "13px" }}>
                    No hay resultados para "{filterText}"
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Modal Nueva Inversión ────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva inversión">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Tipo de instrumento</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(Object.keys(INSTRUMENT_LABELS) as InstrumentType[]).map(t => (
                <button key={t} onClick={() => { setInstrType(t); setForm(emptyForm); }} style={{
                  padding: "5px 12px", fontSize: "12px", fontWeight: 600, border: "1px solid",
                  cursor: "pointer", borderRadius: "6px", transition: "all 0.15s",
                  borderColor: instrType === t ? INSTRUMENT_COLORS[t] : "var(--border)",
                  background: instrType === t ? INSTRUMENT_COLORS[t] + "22" : "transparent",
                  color: instrType === t ? INSTRUMENT_COLORS[t] : "var(--text-3)",
                }}>{INSTRUMENT_LABELS[t]}</button>
              ))}
            </div>
          </div>
          {formFields()}
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          {(instrType === "cedear" || instrType === "accion") && (
            <Input label="Fecha *" type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!canSave() || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId} title="Eliminar inversión"
        description="¿Estás seguro de que deseas eliminar esta inversión?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />

      <RebalanceModal
        open={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        positions={positions.map(p => ({
          key: p.key,
          name: p.name,
          typeLabel: p.typeLabel,
          typeColor: p.typeColor,
          currentValue: currency === "ARS" ? p.actualArs : p.actualUsd,
          currentWeight: p.weightPct / 100,
        }))}
        totalValue={dispAct}
        currency={currency}
        sym={sym}
      />
    </div>
  );
}
