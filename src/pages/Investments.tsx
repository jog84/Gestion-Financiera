import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart2, Briefcase, Download, DollarSign, Plus, RefreshCw, Target, Upload } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/app/providers/ProfileProvider";
import { AllocationCharts } from "@/components/investments/AllocationCharts";
import { generateSmartInsights, calcCAGR, calcRow, calcXIRR, type CashFlow } from "@/lib/investmentCalcs";
import { InsightsPanel } from "@/components/investments/InsightsPanel";
import { InvestmentFormModal } from "@/components/investments/InvestmentFormModal";
import { PortfolioChart } from "@/components/investments/PortfolioChart";
import { PortfolioKPIBar } from "@/components/investments/PortfolioKPIBar";
import { PositionsTable } from "@/components/investments/PositionsTable";
import { RebalanceModal } from "@/components/investments/RebalanceModal";
import { AddInstrumentWidget } from "@/components/investments/AddInstrumentWidget";
import { SignalsWidget } from "@/components/investments/SignalsWidget";
import { TickerAnalysisModal } from "@/components/investments/TickerAnalysisModal";
import { TransactionsTable } from "@/components/investments/TransactionsTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  buildPositions,
  createEmptyInvestmentForm,
  fNum,
  investmentsTabStyle,
  p,
  sortPositions,
  sortTransactions,
  type Currency,
  type InvestmentFormState,
  type SortDir,
  type SortKey,
  type TickerDetection,
} from "@/components/investments/investmentHelpers";
import {
  createInvestment,
  deleteInvestment,
  fetchCcl,
  fetchPrices,
  getDashboardSummary,
  getCashOverview,
  getFinancialAccounts,
  getInvestments,
  getPortfolioSnapshots,
  savePortfolioSnapshot,
  updateInvestmentValue,
  updatePricesByTicker,
  type InversionesSignal,
} from "@/lib/api";
import { exportInvestmentsTemplate, importInvestments } from "@/lib/excel";
import { INVALIDATE, QK } from "@/lib/queryKeys";
import type { InstrumentType, InvestmentEntry } from "@/types";

type InvestmentsTab = "resumen" | "transacciones" | "analisis";

export function Investments() {
  const { profileId } = useProfile();
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InvestmentsTab>("resumen");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [filterText, setFilterText] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortKey | null>("actual");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentCcl, setCurrentCcl] = useState<number | null>(() => {
    const stored = parseFloat(localStorage.getItem("last_ccl") ?? "");
    return isFinite(stored) && stored > 0 ? stored : null;
  });
  const [cclStale, setCclStale] = useState(true);
  const [instrType, setInstrType] = useState<InstrumentType>("cedear");
  const [expandedPos, setExpandedPos] = useState<string | null>(null);
  const [tickerDetection, setTickerDetection] = useState<TickerDetection | null>(null);
  const [form, setForm] = useState<InvestmentFormState>(createEmptyInvestmentForm);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  const [transactionKind, setTransactionKind] = useState<"buy" | "sell">("buy");
  const [analysisTicker, setAnalysisTicker] = useState<string | null>(null);

  const { data: investments = [], isLoading } = useQuery({
    queryKey: QK.investments(profileId),
    queryFn: () => getInvestments(profileId),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: QK.financialAccounts(profileId),
    queryFn: () => getFinancialAccounts(profileId),
  });

  const { data: cashOverview } = useQuery({
    queryKey: QK.cashOverview(profileId),
    queryFn: () => getCashOverview(profileId),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: QK.portfolioSnapshots(profileId),
    queryFn: () => getPortfolioSnapshots(profileId),
  });

  const { data: dashSummary } = useQuery({
    queryKey: QK.dashboard(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
    queryFn: () => getDashboardSummary(profileId, new Date().getFullYear(), new Date().getMonth() + 1),
    staleTime: 60_000,
  });

  useEffect(() => {
    fetchCcl()
      .then((ccl) => {
        setCurrentCcl(ccl);
        setCclStale(false);
        localStorage.setItem("last_ccl", String(ccl));
      })
      .catch(() => {});
  }, []);

  const handleSort = (column: SortKey) => {
    if (sortCol === column) setSortDir((dir) => dir === "asc" ? "desc" : "asc");
    else {
      setSortCol(column);
      setSortDir("desc");
    }
  };

  const handleRegisterSignal = (signal: InversionesSignal) => {
    const assetClassToInstrType = (ac: string): typeof instrType => {
      if (ac === "CEDEAR") return "cedear";
      if (ac === "ACCION") return "accion";
      if (ac.startsWith("BONO")) return "bono";
      return "otro";
    };
    setInstrType(assetClassToInstrType(signal.asset_class));
    setTransactionKind("buy");
    setForm((prev) => ({
      ...prev,
      ticker: signal.ticker,
      name: signal.instrument_name,
      price_ars: String(signal.entry_price),
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Señal ${signal.signal_type} desde Inversiones AR · Stop: $${signal.stop_loss.toLocaleString("es-AR")} · TP1: $${signal.take_profit1.toLocaleString("es-AR")} · Confianza: ${signal.confidence_score.toFixed(0)}%`,
      quantity: "",
      current_price_ars: String(signal.entry_price),
      dolar_ccl: currentCcl ? String(currentCcl) : prev.dolar_ccl,
    }));
    setModalOpen(true);
  };

  const positions = useMemo(
    () => buildPositions(investments, currentCcl),
    [investments, currentCcl],
  );

  const totals = useMemo(() => positions.reduce((acc, position) => ({
    invertidoArs: acc.invertidoArs + position.invertidoArs,
    actualArs: acc.actualArs + position.actualArs,
    invertidoUsd: acc.invertidoUsd + position.invertidoUsd,
    actualUsd: acc.actualUsd + position.actualUsd,
  }), { invertidoArs: 0, actualArs: 0, invertidoUsd: 0, actualUsd: 0 }), [positions]);

  const realizedGains = useMemo(() => investments.reduce((acc, investment) => {
    if (investment.transaction_kind !== "sell") return acc;
    const row = calcRow(investment, currentCcl);
    return {
      ars: acc.ars + row.gananciaArs,
      usd: acc.usd + row.gananciaUsd,
    };
  }, { ars: 0, usd: 0 }), [investments, currentCcl]);

  const { cagr, xirr } = useMemo(() => {
    if (investments.length === 0) return { cagr: 0, xirr: null };

    const sorted = [...investments].filter((investment) => investment.transaction_kind === "buy").sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    const cashFlows: CashFlow[] = investments.map((investment) => {
      const row = calcRow(investment, currentCcl);
      return {
        date: new Date(investment.transaction_date),
        amount: investment.transaction_kind === "sell" ? row.actualArs : -row.invertidoArs,
      };
    });
    cashFlows.push({ date: new Date(), amount: totals.actualArs });
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      cagr: calcCAGR(totals.invertidoArs, totals.actualArs, new Date(sorted[0].transaction_date)),
      xirr: calcXIRR(cashFlows),
    };
  }, [investments, totals, currentCcl]);

  const insights = useMemo(() => generateSmartInsights(
    positions.map((position) => ({
      key: position.key,
      type: position.type,
      sector: position.sector,
      currentValue: position.actualArs,
      totalInvested: position.invertidoArs,
      returnPct: position.invertidoArs > 0 ? position.gananciaArs / position.invertidoArs : 0,
      count: position.count,
      ppp: position.ppp,
      maturityDate: position.maturityDate,
    })),
    totals.actualArs,
    dashSummary?.balance ?? 0,
  ), [positions, totals.actualArs, dashSummary]);

  const chartData = useMemo(() => {
    if (investments.length === 0) return [];
    const sorted = [...investments].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    const groups = new Map<string, InvestmentEntry[]>();

    for (const investment of sorted) {
      const date = investment.transaction_date.slice(0, 10);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(investment);
    }

    let cumulative = 0;
    const points: Array<{ date: string; invested: number; portfolio: number }> = [];
    const isArs = currency === "ARS";

    for (const [date, group] of groups) {
      for (const investment of group) {
        const row = calcRow(investment, currentCcl);
        cumulative += investment.transaction_kind === "sell"
          ? -(isArs ? row.actualArs : row.actualUsd)
          : (isArs ? row.invertidoArs : row.invertidoUsd);
      }
      points.push({ date, invested: cumulative, portfolio: cumulative });
    }

    if (points.length > 0) {
      points[points.length - 1].portfolio = isArs ? totals.actualArs : totals.actualUsd;
    }

    return points;
  }, [investments, currency, currentCcl, totals.actualArs, totals.actualUsd]);

  const dispInv = currency === "ARS" ? totals.invertidoArs : totals.invertidoUsd;
  const dispAct = currency === "ARS" ? totals.actualArs : totals.actualUsd;
  const sym = currency === "ARS" ? "$" : "USD ";
  const portfolioReturnPctUsd = currentCcl && totals.invertidoUsd > 0
    ? ((totals.actualUsd - totals.invertidoUsd) / totals.invertidoUsd) * 100
    : undefined;

  const filteredPositions = useMemo(() => {
    let list = positions;
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter((position) => position.key.toLowerCase().includes(q) || position.name.toLowerCase().includes(q));
    }
    if (sectorFilter) {
      list = list.filter((position) => position.sector === sectorFilter);
    }
    return sortPositions(list, sortCol, sortDir, currency);
  }, [positions, filterText, sectorFilter, sortCol, sortDir, currency]);

  const filteredTransactions = useMemo(() => {
    let list = investments;
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter((investment) => (investment.ticker ?? "").toLowerCase().includes(q) || investment.name.toLowerCase().includes(q));
    }
    return sortTransactions(list, sortCol, sortDir, currency, currentCcl);
  }, [investments, filterText, sortCol, sortDir, currency, currentCcl]);

  const addMutation = useMutation({
    mutationFn: () => {
      const qty = p(form.quantity);
      const priceArs = p(form.price_ars);
      const ccl = p(form.dolar_ccl);
      const currentPrice = p(form.current_price_ars) || priceArs;
      const tna = p(form.tna);
      const days = parseInt(form.plazo_dias) || 0;
      let amountInvested = 0;
      let currentValue = 0;

      if (instrType === "plazo_fijo") {
        amountInvested = priceArs;
        currentValue = priceArs * (1 + (tna / 100) * (days / 365));
      } else if (instrType === "fci") {
        amountInvested = qty * priceArs;
        currentValue = qty * currentPrice;
      } else if (instrType === "bono") {
        amountInvested = qty * (priceArs / 100);
        currentValue = qty * (currentPrice / 100);
      } else if (instrType === "crypto") {
        amountInvested = qty * priceArs;
        currentValue = qty * currentPrice;
      } else if (instrType === "otro") {
        amountInvested = priceArs;
        currentValue = currentPrice || priceArs;
      } else {
        amountInvested = ccl > 0 ? (priceArs * qty) / ccl : 0;
        currentValue = ccl > 0 ? (currentPrice * qty) / ccl : 0;
      }

      return createInvestment({
        profile_id: profileId,
        name: form.name || form.ticker,
        ticker: form.ticker || undefined,
        transaction_kind: transactionKind,
        account_id: form.account_id || null,
        amount_invested: amountInvested,
        current_value: currentValue || undefined,
        transaction_date: form.transaction_date,
        notes: form.notes || undefined,
        quantity: qty || undefined,
        price_ars: priceArs || undefined,
        dolar_ccl: ccl || undefined,
        current_price_ars: currentPrice || undefined,
        instrument_type: instrType,
        tna: tna || undefined,
        plazo_dias: days || undefined,
        fecha_vencimiento: form.fecha_vencimiento || undefined,
      });
    },
    onSuccess: () => {
      INVALIDATE.onInvestmentChanged(profileId).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      setModalOpen(false);
      setForm(createEmptyInvestmentForm());
      setTickerDetection(null);
      setTransactionKind("buy");
      toast.success(transactionKind === "sell" ? "Venta registrada" : "Inversión registrada");
    },
    onError: (error: unknown) => toast.error(String(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvestment,
    onSuccess: () => {
      INVALIDATE.onInvestmentChanged(profileId).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      setDeleteId(null);
      toast.success("Movimiento eliminado");
    },
  });

  const savePrice = async (investment: InvestmentEntry) => {
    if (!editingPrice) return;
    const newPrice = parseFloat(editingPrice.value.replace(",", "."));
    if (isNaN(newPrice) || newPrice <= 0) {
      setEditingPrice(null);
      return;
    }

    const ccl = investment.dolar_ccl ?? 1;
    const qty = investment.quantity ?? 1;
    const newCurrentValue = ccl > 0 ? (newPrice * qty) / ccl : investment.current_value ?? 0;

    try {
      await updateInvestmentValue(investment.id, newCurrentValue, newPrice);
      INVALIDATE.onInvestmentChanged(profileId).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      toast.success("Precio actualizado");
    } catch (error) {
      toast.error(String(error));
    }

    setEditingPrice(null);
  };

  const handleRefreshPrices = async () => {
    const equities = investments.filter((investment) => investment.instrument_type === "cedear" || investment.instrument_type === "accion");
    const tickers = [...new Set(equities.map((investment) => investment.ticker ?? investment.name).filter(Boolean))];

    if (tickers.length === 0) {
      toast.error("No hay CEDEARs/Acciones para actualizar");
      return;
    }

    setRefreshing(true);

    try {
      const [prices, ccl] = await Promise.all([fetchPrices(tickers), fetchCcl().catch(() => null)]);
      if (prices.length === 0) {
        toast.error("No se obtuvieron precios");
        return;
      }

      const updates = prices.map((price) => ({ ticker: price.ticker, price_ars: price.price_ars }));
      const updated = await updatePricesByTicker(profileId, updates, ccl ?? undefined);

      if (ccl) {
        setCurrentCcl(ccl);
        setCclStale(false);
      }

      qc.invalidateQueries({ queryKey: QK.investments(profileId) });
      toast.success(`${updated} posición(es) actualizadas · CCL: $${ccl ? fNum(ccl, 0) : "—"}`);

      try {
        const snapshotCcl = ccl ?? currentCcl ?? 0;
        const recomputedPositions = buildPositions(investments, snapshotCcl);
        const recalcArs = recomputedPositions.reduce((sum, position) => sum + position.actualArs, 0);
        const recalcUsd = recomputedPositions.reduce((sum, position) => sum + position.actualUsd, 0);
        const recalcInvArs = recomputedPositions.reduce((sum, position) => sum + position.invertidoArs, 0);
        await savePortfolioSnapshot(profileId, recalcArs, recalcUsd, recalcInvArs, snapshotCcl);
        qc.invalidateQueries({ queryKey: QK.portfolioSnapshots(profileId) });
      } catch {
        // snapshot non critical
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setRefreshing(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await importInvestments(file);
      if (rows.length === 0) {
        toast.error("No se encontraron filas válidas");
        return;
      }

      for (const row of rows) {
        await createInvestment({
          profile_id: profileId,
          name: row.name,
          ticker: row.ticker || undefined,
          amount_invested: row.amount_invested,
          current_value: row.current_value || undefined,
          transaction_date: row.transaction_date,
          notes: row.notes || undefined,
          quantity: row.quantity,
          price_ars: row.price_ars,
          dolar_ccl: row.dolar_ccl,
          current_price_ars: row.current_price_ars,
          instrument_type: "cedear",
        });
      }

      INVALIDATE.onInvestmentChanged(profileId).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      toast.success(`${rows.length} inversión(es) importada(s)`);
    } catch {
      toast.error("Error al importar. Verificá el formato.");
    }

    event.target.value = "";
  };

  const canSave = () => {
    if (transactionKind === "sell" && !form.account_id) return false;
    if (instrType === "plazo_fijo") return transactionKind === "buy" && !!form.name && !!form.price_ars && !!form.tna && !!form.plazo_dias;
    if (instrType === "fci") return !!form.name && !!form.quantity && !!form.price_ars;
    if (instrType === "bono") return !!form.ticker && !!form.quantity && !!form.price_ars;
    if (instrType === "crypto") return !!form.ticker && !!form.quantity && !!form.price_ars;
    if (instrType === "otro") return !!form.name && !!form.price_ars;
    return !!form.ticker && !!form.quantity && !!form.price_ars && !!form.dolar_ccl;
  };

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name}${account.institution ? ` · ${account.institution}` : ""} · ${account.currency_code}`,
  }));

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1560px" }}>
      <PageHeader
        title="Inversiones"
        description="Portfolio, rendimiento y riesgo en una sola vista. La importación y exportación Excel se conserva intacta."
        actions={
          <>
            <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "2px", gap: "1px" }}>
              {(["ARS", "USD"] as Currency[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setCurrency(value)}
                  style={{
                    padding: "2px 9px",
                    fontSize: "11px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "4px",
                    fontFamily: "var(--font-mono)",
                    background: currency === value ? "var(--primary)" : "transparent",
                    color: currency === value ? "#fff" : "var(--text-3)",
                    transition: "all 0.15s",
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            {currentCcl && (
              <span
                title={cclStale ? "Último valor guardado — actualizar precios para refrescar" : "CCL actualizado"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "var(--surface-2)",
                  border: `1px solid ${cclStale ? "var(--border)" : "color-mix(in srgb, var(--success) 40%, var(--border))"}`,
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  color: "var(--text-3)",
                  fontFamily: "var(--font-mono)",
                  opacity: cclStale ? 0.75 : 1,
                }}
              >
                <DollarSign size={10} />CCL: <strong style={{ color: "var(--text-2)" }}>${fNum(currentCcl, 0)}</strong>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setRebalanceOpen(true)}>
              <Target size={13} /> Rebalanceo
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshPrices} disabled={refreshing}>
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Actualizando..." : "Actualizar precios"}
            </Button>
            <Button variant="outline" size="xs" onClick={() => exportInvestmentsTemplate()}>
              <Download size={11} /> Plantilla
            </Button>
            <Button variant="outline" size="xs" onClick={() => importRef.current?.click()}>
              <Upload size={11} /> Importar
            </Button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
            <Button variant="outline" size="xs" onClick={() => { setTransactionKind("sell"); setModalOpen(true); setForm(createEmptyInvestmentForm()); setTickerDetection(null); }}>
              <Plus size={12} /> Registrar venta
            </Button>
            <Button size="xs" onClick={() => { setTransactionKind("buy"); setModalOpen(true); setForm(createEmptyInvestmentForm()); setTickerDetection(null); }}>
              <Plus size={12} /> Nueva inversión
            </Button>
          </>
        }
      />

      {sectorFilter && (
        <div style={{ marginBottom: "12px" }}>
          <span
            onClick={() => setSectorFilter(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
              borderRadius: "6px",
              padding: "2px 8px",
              fontSize: "11px",
              color: "var(--primary)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Sector: {sectorFilter} ×
          </span>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Card style={{ padding: "32px", color: "var(--text-3)" }}>Cargando cartera…</Card>
          <Card style={{ padding: "32px", color: "var(--text-3)" }}>Preparando métricas…</Card>
          <Card style={{ padding: "32px", color: "var(--text-3)" }}>Armando posiciones…</Card>
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
          <div className="animate-fade-in-up">
            <PortfolioKPIBar
              portfolioValue={dispAct}
              totalInvested={dispInv}
              cagr={cagr}
              xirr={xirr}
              currency={currency}
              sym={sym}
              returnPctUsd={portfolioReturnPctUsd}
              realizedGain={currency === "ARS" ? realizedGains.ars : realizedGains.usd}
              liquidCash={currency === "ARS" ? (cashOverview?.liquid_balance ?? 0) : undefined}
            />
          </div>

          <div className="animate-fade-in-up" style={{ marginBottom: "16px" }}>
            <PortfolioChart chartData={chartData} snapshots={snapshots} currency={currency} sym={sym} />
          </div>

          <div className="animate-fade-in-up">
            <AllocationCharts
              positions={positions.map((position) => ({
                key: position.key,
                type: position.type,
                typeLabel: position.typeLabel,
                typeColor: position.typeColor,
                sector: position.sector,
                currentValueArs: position.actualArs,
                currentValueUsd: position.actualUsd,
                invertidoArs: position.invertidoArs,
              }))}
              currency={currency}
              sym={sym}
              onSectorClick={setSectorFilter}
              activeSector={sectorFilter}
            />
          </div>

          <div className="animate-fade-in-up">
            <InsightsPanel insights={insights.filter((insight) => insight.level !== "info" || insight.action)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface-2)", padding: "4px", borderRadius: "8px" }}>
              <button style={investmentsTabStyle(activeTab === "resumen")} onClick={() => setActiveTab("resumen")}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <BarChart2 size={12} /> Posiciones
                </span>
              </button>
              <button style={investmentsTabStyle(activeTab === "transacciones")} onClick={() => setActiveTab("transacciones")}>
                Transacciones
              </button>
              <button style={investmentsTabStyle(activeTab === "analisis")} onClick={() => setActiveTab("analisis")}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  📊 Análisis
                </span>
              </button>
            </div>
            <input
              type="text"
              placeholder="Filtrar por instrumento..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                display: activeTab === "analisis" ? "none" : undefined,
                height: "32px",
                width: "220px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-light)",
                background: "var(--surface-2)",
                padding: "0 10px",
                fontSize: "12px",
                color: "var(--text)",
                fontFamily: "var(--font-ui)",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
            />
          </div>

          {activeTab === "analisis" ? (
            <div>
              <AddInstrumentWidget onAnalyze={setAnalysisTicker} />
              <SignalsWidget onRegister={handleRegisterSignal} />
            </div>
          ) : activeTab === "resumen" ? (
            <PositionsTable
              positions={filteredPositions}
              investmentsCount={investments.length}
              currency={currency}
              sym={sym}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              expandedPos={expandedPos}
              setExpandedPos={setExpandedPos}
              sectorFilter={sectorFilter}
              setSectorFilter={setSectorFilter}
              currentCcl={currentCcl}
              dispInv={dispInv}
              dispAct={dispAct}
              onRegister={(ticker, price) => {
                setInstrType(ticker.length <= 6 ? "cedear" : "otro");
                setTransactionKind("buy");
                setForm((prev) => ({
                  ...prev,
                  ticker,
                  name: ticker,
                  price_ars: String(price),
                  transaction_date: new Date().toISOString().slice(0, 10),
                  current_price_ars: String(price),
                  dolar_ccl: currentCcl ? String(currentCcl) : prev.dolar_ccl,
                  notes: "",
                  quantity: "",
                }));
                setModalOpen(true);
              }}
            />
          ) : (
            <TransactionsTable
              transactions={filteredTransactions}
              currency={currency}
              sym={sym}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              currentCcl={currentCcl}
              editingPrice={editingPrice}
              setEditingPrice={setEditingPrice}
              savePrice={savePrice}
              setDeleteId={setDeleteId}
            />
          )}
        </>
      )}

      {analysisTicker && (
        <TickerAnalysisModal
          ticker={analysisTicker}
          onClose={() => setAnalysisTicker(null)}
          onRegister={(ticker, price) => {
            setAnalysisTicker(null);
            setInstrType(ticker.length <= 6 ? "cedear" : "otro");
            setTransactionKind("buy");
            setForm((prev) => ({
              ...prev,
              ticker,
              name: ticker,
              price_ars: String(price),
              transaction_date: new Date().toISOString().slice(0, 10),
              current_price_ars: String(price),
              dolar_ccl: currentCcl ? String(currentCcl) : prev.dolar_ccl,
              notes: "",
              quantity: "",
            }));
            setModalOpen(true);
          }}
        />
      )}

      <InvestmentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        form={form}
        setForm={setForm}
        transactionKind={transactionKind}
        setTransactionKind={setTransactionKind}
        instrType={instrType}
        setInstrType={setInstrType}
        tickerDetection={tickerDetection}
        setTickerDetection={setTickerDetection}
        accountOptions={accountOptions}
        canSave={canSave}
        isPending={addMutation.isPending}
        onSubmit={() => addMutation.mutate()}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar inversión"
        description="¿Estás seguro de que deseas eliminar esta inversión?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />

      <RebalanceModal
        open={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        positions={positions.map((position) => ({
          key: position.key,
          name: position.name,
          typeLabel: position.typeLabel,
          typeColor: position.typeColor,
          currentValue: currency === "ARS" ? position.actualArs : position.actualUsd,
          currentWeight: position.weightPct / 100,
        }))}
        totalValue={dispAct}
        currency={currency}
        sym={sym}
      />
    </div>
  );
}
