import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, BarChart2, ShoppingBag, Receipt, ShieldAlert } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { MonthSelector } from "@/components/MonthSelector";
import {
  checkFinancialAlerts, getExpenseBreakdown, getFinancialInsights, getFinancialOverview, getFinancialRecommendations, getMonthlySummary, getRecentTransactions,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QK } from "@/lib/queryKeys";
import { useProfile } from "@/app/providers/ProfileProvider";

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CAT_COLORS  = ["#2563eb", "#10b981", "#0ea5e9", "#6366f1", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];

function Skel({ w = "100%", h = 14, r = 4 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />;
}

// ── Pill badges ──────────────────────────────────────────────────────────────

function Pill({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      padding: "2px 8px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 600, color, background: bg,
      fontFamily: "var(--font-ui)",
    }}>
      {children}
    </span>
  );
}

function TrendPill({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const abs  = Math.abs(value);
  const up   = value >= 0;
  const good = invert ? !up : up;
  const col  = abs < 0.5 ? "var(--text-3)" : good ? "var(--success)" : "var(--danger)";
  const bg   = abs < 0.5 ? "var(--surface-3)" : good ? "var(--success-dim)" : "var(--danger-dim)";
  const Icon = abs < 0.5 ? null : up ? ArrowUpRight : ArrowDownRight;
  return (
    <Pill color={col} bg={bg}>
      {Icon && <Icon size={10} />}
      {up ? "+" : ""}{value.toFixed(1)}%
    </Pill>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ h, icon, text, sub, cta, onCta }: {
  h: number; icon: ReactNode; text: string; sub?: string; cta?: string; onCta?: () => void;
}) {
  return (
    <div style={{ height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "10px",
        border: "1px solid var(--border)", background: "var(--surface-2)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)",
      }}>{icon}</div>
      <span style={{ fontSize: "13px", color: "var(--text-2)", fontWeight: 500 }}>{text}</span>
      {sub && <span style={{ fontSize: "11px", color: "var(--text-3)" }}>{sub}</span>}
      {cta && onCta && (
        <button onClick={onCta} style={{
          marginTop: "4px", padding: "6px 14px", fontSize: "11px", fontWeight: 600,
          color: "var(--primary)", background: "rgba(67,97,238,0.1)",
          border: "1px solid rgba(67,97,238,0.2)", borderRadius: "8px",
          cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>{cta}</button>
      )}
    </div>
  );
}

// ── KPI Card — ReactAdmin style ──────────────────────────────────────────────
// Plain card, no icons, no tinted bg. Label + value + badge like the reference.

function KpiCard({ label, value, badge, sub }: {
  label: string; value: string; badge?: ReactNode; sub?: string;
}) {
  return (
    <div 
      className="transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-[var(--primary)] group"
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "12px", padding: "20px 24px",
        position: "relative", overflow: "hidden"
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {/* Label row + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-3)", fontWeight: 500, fontFamily: "var(--font-ui)" }}>
          {label}
        </span>
        {badge}
      </div>
      {/* Value — big, UI font (not mono) like ReactAdmin */}
      <div style={{
        fontSize: "32px", fontWeight: 700, color: "var(--text)",
        fontFamily: "var(--font-ui)", letterSpacing: "-0.03em", lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "8px", fontFamily: "var(--font-ui)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <Skel w={90} h={12} r={3} /><Skel w={50} h={20} r={10} />
      </div>
      <Skel w="55%" h={28} r={4} />
      <div style={{ marginTop: "10px" }}><Skel w="50%" h={10} r={3} /></div>
    </div>
  );
}

// ── Card shell ───────────────────────────────────────────────────────────────

function CardShell({ title, subtitle, right, children, outerStyle }: {
  title: string; subtitle?: string; right?: ReactNode; children: ReactNode; outerStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", ...outerStyle }}>
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-ui)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>{subtitle}</div>}
        </div>
        {right && <div style={{ display: "flex", alignItems: "center" }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const inc = payload.find(p => p.name === "Ingresos")?.value ?? 0;
  const exp = payload.find(p => p.name === "Gastos")?.value ?? 0;
  return (
    <div style={{ background: "var(--surface-3)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "10px 14px", minWidth: "150px" }}>
      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)", marginBottom: "6px", fontFamily: "var(--font-ui)" }}>{label}</p>
      {[{ l: "Ingresos", v: inc, c: "var(--success)" }, { l: "Gastos", v: exp, c: "var(--danger)" }].map(r => (
        <div key={r.l} style={{ display: "flex", justifyContent: "space-between", gap: "14px", marginBottom: "3px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>{r.l}</span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: r.c, fontFamily: "var(--font-ui)" }}>{formatCurrency(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { profileId } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: overview,       isLoading: ls } = useQuery({ queryKey: QK.financialOverview(profileId, year, month), queryFn: () => getFinancialOverview(profileId, year, month) });
  const { data: insights = [],  isLoading: li } = useQuery({ queryKey: QK.financialInsights(profileId, year, month), queryFn: () => getFinancialInsights(profileId, year, month) });
  const { data: recommendations = [], isLoading: lrec } = useQuery({ queryKey: QK.financialRecommendations(profileId, year, month), queryFn: () => getFinancialRecommendations(profileId, year, month) });
  const { data: monthly = [],    isLoading: lm } = useQuery({ queryKey: QK.monthlySummary(profileId, 6),          queryFn: () => getMonthlySummary(profileId, 6) });
  const { data: breakdown = [],  isLoading: lb } = useQuery({ queryKey: QK.expenseBreakdown(profileId, year, month), queryFn: () => getExpenseBreakdown(profileId, year, month) });
  const { data: recent = [],     isLoading: lr } = useQuery({ queryKey: QK.recentTx(profileId, 8),               queryFn: () => getRecentTransactions(profileId, 8) });

  useEffect(() => {
    let cancelled = false;
    void checkFinancialAlerts(profileId, year, month).then(() => {
      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ["alerts", profileId] });
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profileId, year, month, qc]);

  const income         = overview?.total_income ?? 0;
  const expenses       = overview?.total_expenses ?? 0;
  const balance        = overview?.balance ?? 0;
  const savingsRate    = overview?.savings_rate ?? 0;
  const totalAssets    = overview?.total_assets ?? 0;
  const liquidAssets   = overview?.liquid_assets ?? 0;
  const liquidityMonths = overview?.liquidity_months ?? null;
  const monthlyFixed   = overview?.monthly_fixed_expenses ?? 0;

  const prevDate = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prevM    = monthly.find(m => m.year === prevDate.year && m.month === prevDate.month);
  const incTrend = prevM && prevM.total_income   > 0 ? ((income   - prevM.total_income)   / prevM.total_income)   * 100 : null;
  const expTrend = prevM && prevM.total_expenses > 0 ? ((expenses - prevM.total_expenses) / prevM.total_expenses) * 100 : null;

  const chartData = monthly.map(m => ({ name: MONTH_NAMES[m.month - 1], Ingresos: m.total_income, Gastos: m.total_expenses }));
  const totalBk   = breakdown.reduce((s, c) => s + c.total, 0);

  const tick = { fill: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-ui)" };
  const axis = { axisLine: false as const, tickLine: false as const };

  return (
    <div className="page-enter" style={{ padding: "24px 28px", maxWidth: "1400px" }}>

      {/* Header */}
      <div style={{ marginBottom: "22px" }}>
        {/* Row 1: Título + controles de período */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-ui)", letterSpacing: "-0.02em" }}>
              Dashboard
            </h1>
            <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px", textTransform: "capitalize" }}>
              {new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month - 1))}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); }}
              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 500, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-ui)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
            >Este mes</button>
            <button
              onClick={() => { const d = new Date(); let m = d.getMonth(); let y = d.getFullYear(); if(m === 0) { m = 12; y--;} setYear(y); setMonth(m); }}
              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 500, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-ui)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
            >Mes pasado</button>
            <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
        </div>

        {/* Row 2: Links de navegación rápida */}
        <div style={{ display: "flex", gap: "2px", padding: "3px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", width: "fit-content" }}>
          {[
            { l: "Ingresos",    p: "/incomes",      c: "var(--success)" },
            { l: "Gastos",      p: "/expenses",     c: "var(--danger)" },
            { l: "Cuotas",      p: "/installments", c: "var(--warning)" },
            { l: "Inversiones", p: "/investments",  c: "var(--primary)" },
            { l: "Patrimonio",  p: "/assets",       c: "var(--cyan)" },
            { l: "Objetivos",   p: "/goals",        c: "#a855f7" },
          ].map(({ l, p, c }) => (
            <button key={p} onClick={() => navigate(p)} style={{
              padding: "5px 12px", fontSize: "12px", fontWeight: 500, color: c,
              background: "transparent", border: "none", borderRadius: "8px",
              cursor: "pointer", fontFamily: "var(--font-ui)", transition: "background 0.12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = `${c}18`)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="animate-fade-in-up" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px", marginBottom: "14px" }}>
        {ls ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard
              label="Ingresos del mes"
              value={formatCurrency(income)}
              badge={<TrendPill value={incTrend} />}
              sub={prevM ? `vs ${MONTH_NAMES[prevDate.month - 1]}` : "sin comparativo"}
            />
            <KpiCard
              label="Gastos del mes"
              value={formatCurrency(expenses)}
              badge={<TrendPill value={expTrend} invert />}
              sub={prevM ? `vs ${MONTH_NAMES[prevDate.month - 1]}` : "sin comparativo"}
            />
            <KpiCard
              label="Balance neto"
              value={formatCurrency(balance)}
              badge={
                <Pill
                  color={balance >= 0 ? "var(--success)" : "var(--danger)"}
                  bg={balance >= 0 ? "var(--success-dim)" : "var(--danger-dim)"}
                >
                  {balance >= 0 ? "Superávit" : "Déficit"}
                </Pill>
              }
              sub={balance >= 0
                ? `Mes en positivo${monthlyFixed > 0 ? ` · Fijos: ${formatCurrency(monthlyFixed)}/mes` : ""}`
                : `Revisá tus gastos${monthlyFixed > 0 ? ` · Fijos: ${formatCurrency(monthlyFixed)}/mes` : ""}`
              }
            />
            <KpiCard
              label="Patrimonio estimado"
              value={formatCurrency(totalAssets)}
              badge={<Pill color="var(--primary)" bg="rgba(67,97,238,0.12)">Total</Pill>}
              sub={liquidAssets > 0 ? `Liquidez disponible: ${formatCurrency(liquidAssets)}` : "Sin colchón líquido cargado"}
            />
            <KpiCard
              label="Tasa de ahorro"
              value={`${savingsRate.toFixed(1)}%`}
              badge={
                savingsRate >= 20
                  ? <Pill color="var(--success)" bg="var(--success-dim)">En meta</Pill>
                  : savingsRate > 0
                    ? <Pill color="var(--warning)" bg="var(--warning-dim)">En progreso</Pill>
                    : <Pill color="var(--text-3)" bg="var(--surface-3)">Sin ahorro</Pill>
              }
              sub="Meta: 20% del ingreso"
            />
            <KpiCard
              label="Cobertura de liquidez"
              value={liquidityMonths !== null ? `${liquidityMonths.toFixed(1)}m` : "N/D"}
              badge={
                liquidityMonths === null
                  ? <Pill color="var(--text-3)" bg="var(--surface-3)">Sin base</Pill>
                  : liquidityMonths >= 6
                    ? <Pill color="var(--success)" bg="var(--success-dim)">Sólida</Pill>
                    : liquidityMonths >= 3
                      ? <Pill color="var(--warning)" bg="var(--warning-dim)">Media</Pill>
                      : <Pill color="var(--danger)" bg="var(--danger-dim)">Baja</Pill>
              }
              sub={monthlyFixed > 0 ? `Fijos mensuales: ${formatCurrency(monthlyFixed)}` : "Sin gastos fijos activos"}
            />
          </>
        )}
      </div>

      <div className="animate-fade-in-up delay-100" style={{ marginBottom: "12px" }}>
        <CardShell
          title="Insights accionables"
          subtitle="Señales automáticas sobre liquidez, cashflow y riesgo de concentración"
          right={
            insights.length > 0 ? (
              <Pill color="var(--warning)" bg="var(--warning-dim)">{insights.length} activos</Pill>
            ) : undefined
          }
        >
          {li ? (
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
              <Skel h={110} r={8} />
              <Skel h={110} r={8} />
              <Skel h={110} r={8} />
            </div>
          ) : insights.length === 0 ? (
            <EmptyState
              h={120}
              icon={<ShieldAlert size={18} />}
              text="Sin alertas financieras críticas"
              sub="La liquidez, el cashflow y la concentración no muestran desvíos fuertes este mes."
            />
          ) : (
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
              {insights.slice(0, 3).map((insight) => {
                const tone = insight.severity === "high"
                  ? { fg: "var(--danger)", bg: "var(--danger-dim)" }
                  : insight.severity === "medium"
                    ? { fg: "var(--warning)", bg: "var(--warning-dim)" }
                    : { fg: "var(--primary)", bg: "rgba(67,97,238,0.12)" };
                return (
                  <div key={insight.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", background: "var(--surface-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <Pill color={tone.fg} bg={tone.bg}>
                        {insight.severity === "high" ? "Alta prioridad" : insight.severity === "medium" ? "Atención" : "Seguimiento"}
                      </Pill>
                      {insight.metric_value !== null ? (
                        <span style={{ fontSize: "11px", color: "var(--text-3)", fontWeight: 600 }}>
                          {insight.kind === "low_liquidity"
                            ? `${insight.metric_value.toFixed(1)}m`
                            : insight.kind === "portfolio_concentration" || insight.kind === "fixed_expense_pressure"
                              ? `${insight.metric_value.toFixed(0)}%`
                              : formatCurrency(Math.abs(insight.metric_value))}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>{insight.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.5, minHeight: "54px" }}>{insight.body}</div>
                    {insight.action_route && insight.action_label ? (
                      <button
                        onClick={() => navigate(insight.action_route!)}
                        style={{
                          marginTop: "12px",
                          padding: "7px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--primary)",
                          background: "rgba(67,97,238,0.1)",
                          border: "1px solid rgba(67,97,238,0.2)",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontFamily: "var(--font-ui)",
                        }}
                      >
                        {insight.action_label} →
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>
      </div>

      <div className="animate-fade-in-up delay-150" style={{ marginBottom: "12px" }}>
        <CardShell
          title="Recomendaciones"
          subtitle="Acciones sugeridas para mejorar ahorro, gasto y diversificación"
        >
          {lrec ? (
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
              <Skel h={120} r={8} />
              <Skel h={120} r={8} />
              <Skel h={120} r={8} />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              h={120}
              icon={<BarChart2 size={18} />}
              text="Sin recomendaciones relevantes"
              sub="Todavía no veo una acción con impacto claro por encima del ruido normal."
            />
          ) : (
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
              {recommendations.slice(0, 3).map((recommendation) => (
                <div key={recommendation.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", background: "var(--surface-2)" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>{recommendation.title}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", lineHeight: 1.5, minHeight: "56px" }}>{recommendation.summary}</div>
                  <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "rgba(67,97,238,0.08)", border: "1px solid rgba(67,97,238,0.16)" }}>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: "4px" }}>
                      {recommendation.impact_label}
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)" }}>
                      {formatCurrency(recommendation.impact_value)}
                    </div>
                  </div>
                  {recommendation.action_route && recommendation.action_label ? (
                    <button
                      onClick={() => navigate(recommendation.action_route!)}
                      style={{
                        marginTop: "12px",
                        padding: "7px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--primary)",
                        background: "rgba(67,97,238,0.1)",
                        border: "1px solid rgba(67,97,238,0.2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontFamily: "var(--font-ui)",
                      }}
                    >
                      {recommendation.action_label} →
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>

      {/* Charts row */}
      <div className="animate-fade-in-up delay-200" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "12px", marginBottom: "12px" }}>

        <div style={{ padding: "1px", background: "linear-gradient(90deg, var(--success), var(--danger))", borderRadius: "11px" }}>
          <CardShell
            title="Ingresos vs Gastos"
            subtitle="Últimos 6 meses"
            outerStyle={{ border: "none", background: "var(--surface)" }}
            right={
            <div style={{ display: "flex", gap: "12px" }}>
              {[{ l: "Ingresos", c: "var(--success)" }, { l: "Gastos", c: "var(--danger)" }].map(({ l, c }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: c }} />
                  <span style={{ fontSize: "11px", color: "var(--text-2)", fontFamily: "var(--font-ui)" }}>{l}</span>
                </div>
              ))}
            </div>
          }
        >
          <div style={{ padding: "16px 16px 12px" }}>
            {lm ? <Skel h={200} r={4} /> : chartData.length === 0 ? (
              <EmptyState h={200} icon={<BarChart2 size={20} />} text="Sin datos todavía"
                sub="Registrá ingresos o gastos para ver el gráfico"
                cta="Agregar ingreso" onCta={() => navigate("/incomes")} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--danger)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={tick} {...axis} />
                  <YAxis tick={tick} {...axis} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={30} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--border-light)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="Ingresos" stroke="var(--success)" strokeWidth={2} fill="url(#gI)" dot={false} activeDot={{ r: 3, fill: "var(--success)" }} />
                  <Area type="monotone" dataKey="Gastos"   stroke="var(--danger)"  strokeWidth={2} fill="url(#gE)" dot={false} activeDot={{ r: 3, fill: "var(--danger)" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardShell>
        </div>

        <CardShell
          title="Gastos por categoría"
          subtitle={breakdown.length > 0 ? formatCurrency(totalBk) + " total" : undefined}
        >
          <div style={{ padding: "16px 16px 12px" }}>
            {lb ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[100,80,64,50,38].map(w => <Skel key={w} h={20} r={4} w={`${w}%`} />)}
              </div>
            ) : breakdown.length === 0 ? (
              <EmptyState h={200} icon={<ShoppingBag size={20} />} text="Sin gastos este mes"
                sub="Registrá gastos para ver el desglose"
                cta="Agregar gasto" onCta={() => navigate("/expenses")} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={breakdown.slice(0, 6).map((c, i) => ({ name: c.category_name, total: c.total, category_id: c.category_id, fill: CAT_COLORS[i % CAT_COLORS.length] }))}
                  layout="vertical" margin={{ top: 0, right: 6, bottom: 0, left: 0 }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.5} strokeDasharray="3 3" />
                  <XAxis type="number" tick={tick} {...axis} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={tick} {...axis} width={80} />
                  <Tooltip
                    formatter={v => [formatCurrency(Number(v)), "Total"]}
                    contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--border-light)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-ui)" }}
                    cursor={{ fill: "var(--surface-2)" }}
                  />
                  <Bar
                    dataKey="total"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={16}
                    onClick={(data) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const catId = (data as any)?.category_id as string | undefined;
                      if (catId) {
                        navigate("/expenses", { state: { category_id: catId } });
                      } else {
                        navigate("/expenses");
                      }
                    }}
                  >
                    {breakdown.slice(0, 6).map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardShell>
      </div>

      {/* Transactions */}
      <div className="animate-fade-in-up delay-300">
        <CardShell
          title="Últimas transacciones"
        subtitle={recent.length > 0 ? `${recent.length} movimientos recientes` : undefined}
        right={
          <div style={{ display: "flex", gap: "14px" }}>
            <button onClick={() => navigate("/incomes")} style={{ fontSize: "11px", color: "var(--success)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontWeight: 500 }}>
              Ver ingresos →
            </button>
            <button onClick={() => navigate("/expenses")} style={{ fontSize: "11px", color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontWeight: 500 }}>
              Ver gastos →
            </button>
          </div>
        }
      >
        {lr ? (
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Skel w={30} h={30} r={6} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                  <Skel w="38%" h={11} r={3} /><Skel w="22%" h={9} r={3} />
                </div>
                <Skel w={75} h={11} r={3} />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState h={88} icon={<Receipt size={18} />}
            text="Sin transacciones recientes"
            sub="Tus últimos movimientos aparecerán aquí"
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {[["Fecha","left"],["Fuente / Categoría","left"],["Descripción","left"],["Tipo","left"],["Monto","right"]].map(([h, a]) => (
                  <th key={h} style={{
                    padding: "8px 16px", textAlign: a as "left" | "right",
                    fontSize: "10px", fontWeight: 600, color: "var(--text-3)",
                    letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-ui)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((tx, i) => (
                <tr key={tx.id}
                  style={{ borderBottom: i !== recent.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-2)", fontWeight: 600, fontFamily: "var(--font-ui)" }}>
                    {tx.source_or_category ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{ background: CAT_COLORS[tx.source_or_category.length % CAT_COLORS.length] }}>
                          {tx.source_or_category.charAt(0).toUpperCase()}
                        </div>
                        {tx.source_or_category}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-3)", fontStyle: "italic", fontWeight: 400 }}>Sin categoría</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", maxWidth: "200px" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>
                      {tx.description ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <Pill
                      color={tx.kind === "income" ? "var(--success)" : "var(--danger)"}
                      bg={tx.kind === "income" ? "var(--success-dim)" : "var(--danger-dim)"}
                    >
                      {tx.kind === "income" ? "Ingreso" : "Gasto"}
                    </Pill>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap", fontFamily: "var(--font-ui)" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-3)", marginRight: "1px" }}>
                      {tx.kind === "income" ? "+" : "−"}
                    </span>
                    <span style={{
                      fontSize: "13px", fontWeight: 700, letterSpacing: "-0.02em",
                      color: tx.kind === "income" ? "var(--success)" : "var(--danger)",
                    }}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardShell>
      </div>

    </div>
  );
}


