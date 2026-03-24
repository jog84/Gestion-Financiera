import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, BarChart2, ShoppingBag, Receipt } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { MonthSelector } from "@/components/MonthSelector";
import {
  getDashboardSummary, getMonthlySummary, getExpenseBreakdown, getRecentTransactions,
  getRecurringTransactions,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

const PROFILE_ID  = "default";
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
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: summary,        isLoading: ls } = useQuery({ queryKey: ["dashboard",           PROFILE_ID, year, month], queryFn: () => getDashboardSummary(PROFILE_ID, year, month) });
  const { data: monthly = [],    isLoading: lm } = useQuery({ queryKey: ["monthly_summary",    PROFILE_ID, 6],           queryFn: () => getMonthlySummary(PROFILE_ID, 6) });
  const { data: breakdown = [],  isLoading: lb } = useQuery({ queryKey: ["expense_breakdown",  PROFILE_ID, year, month], queryFn: () => getExpenseBreakdown(PROFILE_ID, year, month) });
  const { data: recent = [],     isLoading: lr } = useQuery({ queryKey: ["recent_transactions", PROFILE_ID, 8],          queryFn: () => getRecentTransactions(PROFILE_ID, 8) });
  const { data: recurring = [] }                 = useQuery({ queryKey: ["recurring",           PROFILE_ID],             queryFn: () => getRecurringTransactions(PROFILE_ID), staleTime: 60_000 });

  // Compromisos fijos mensuales activos (para sub-label del balance)
  const monthlyFixed = recurring
    .filter(t => t.is_active && t.kind === "expense" && t.frequency === "monthly")
    .reduce((s, t) => s + t.amount, 0);

  const income      = summary?.total_income   ?? 0;
  const expenses    = summary?.total_expenses ?? 0;
  const balance     = summary?.balance        ?? 0;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

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
      <div className="animate-fade-in-up" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "14px" }}>
        {ls ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
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
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="animate-fade-in-up delay-100" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "12px", marginBottom: "12px" }}>

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
      <div className="animate-fade-in-up delay-200">
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
