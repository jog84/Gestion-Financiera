import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Printer } from "lucide-react";
import { getAnnualReport, getExpenseBreakdown, getMonthlySummary, getYoyComparison } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const PROFILE_ID = "default";
const CHART_COLORS = ["#2563eb", "#10b981", "#0ea5e9", "#6366f1", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];
const now = new Date();

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = now.getFullYear() - i;
  return { value: String(y), label: String(y) };
});

const MONTH_OPTIONS = [
  { value: "0", label: "Todos" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(2000, i)),
  })),
];

type Tab = "expenses" | "incomes" | "evolution" | "annual" | "yoy";

const TABS: { id: Tab; label: string }[] = [
  { id: "expenses", label: "Gastos por Categoría" },
  { id: "incomes", label: "Ingresos por Fuente" },
  { id: "evolution", label: "Evolución Mensual" },
  { id: "annual", label: "Resumen Anual" },
  { id: "yoy", label: "Año vs Año" },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface-3)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "10px 14px", boxShadow: "var(--shadow)" }}>
      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: p.name === "Ingresos" ? "var(--success)" : "var(--danger)" }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
};

export function Reports() {
  const [tab, setTab] = useState<Tab>("expenses");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [yoyYearA, setYoyYearA] = useState(now.getFullYear());
  const [yoyYearB, setYoyYearB] = useState(now.getFullYear() - 1);

  const { data: annual } = useQuery({
    queryKey: ["annual_report", PROFILE_ID, year],
    queryFn: () => getAnnualReport(PROFILE_ID, year),
  });

  const { data: expenseBreakdown = [] } = useQuery({
    queryKey: ["expense_breakdown", PROFILE_ID, year, month],
    queryFn: () => getExpenseBreakdown(PROFILE_ID, year, month),
    enabled: tab === "expenses",
  });

  const { data: incomeSummary = [] } = useQuery({
    queryKey: ["monthly_summary_12", PROFILE_ID],
    queryFn: () => getMonthlySummary(PROFILE_ID, 12),
    enabled: tab === "incomes" || tab === "evolution",
  });

  const { data: yoy } = useQuery({
    queryKey: ["yoy", PROFILE_ID, yoyYearA, yoyYearB],
    queryFn: () => getYoyComparison(PROFILE_ID, yoyYearA, yoyYearB),
    enabled: tab === "yoy",
  });

  const evolutionData = (annual?.rows ?? []).map((r) => ({
    name: r.month_name.slice(0, 3),
    Ingresos: r.total_income,
    Gastos: r.total_expenses,
  }));

  const yoyData = (yoy?.rows ?? []).map((r) => ({
    name: r.month_name.slice(0, 3),
    [`Ingresos ${yoyYearA}`]: r.income_a,
    [`Ingresos ${yoyYearB}`]: r.income_b,
    [`Gastos ${yoyYearA}`]: r.expenses_a,
    [`Gastos ${yoyYearB}`]: r.expenses_b,
  }));

  const tooltipContentStyle = {
    background: "var(--surface-3)",
    border: "1px solid var(--border-light)",
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: "var(--text)",
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Reportes</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={13} /> Imprimir / PDF
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setYear(new Date().getFullYear())}
              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 500, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-ui)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
            >Este año</button>
            <button
              onClick={() => setYear(new Date().getFullYear() - 1)}
              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 500, color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-ui)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
            >Año pasado</button>
          </div>
          <Select options={YEAR_OPTIONS} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
          {(tab === "expenses" || tab === "incomes") && (
            <Select options={MONTH_OPTIONS} value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up delay-100" style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "4px", width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 16px",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: tab === t.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--font-ui)",
              background: tab === t.id ? "var(--surface)" : "transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-3)",
              boxShadow: tab === t.id ? "var(--shadow-sm)" : "none",
              border: tab === t.id ? "1px solid var(--border-light)" : "1px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Gastos por Categoría */}
      {tab === "expenses" && (
        <div className="animate-fade-in-up delay-200" style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "12px" }}>
          <Card style={{ padding: "18px 20px" }}>
            <CardHeader><CardTitle>Distribución</CardTitle></CardHeader>
            {expenseBreakdown.length === 0 ? (
              <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "13px" }}>Sin gastos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expenseBreakdown} dataKey="total" nameKey="category_name" cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {expenseBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipContentStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "10px", color: "var(--text-2)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card style={{ padding: "18px 20px" }}>
            <CardHeader><CardTitle>Detalle por categoría</CardTitle></CardHeader>
            {expenseBreakdown.length === 0 ? (
              <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "13px" }}>Sin gastos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(() => {
                  const total = expenseBreakdown.reduce((s, c) => s + c.total, 0);
                  return expenseBreakdown.map((cat, i) => (
                    <div key={cat.category_name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-2)" }}>{cat.category_name}</span>
                        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--danger)" }}>
                          {formatCurrency(cat.total)}
                          <span style={{ marginLeft: "8px", color: "var(--text-3)", fontWeight: 400 }}>
                            {total > 0 ? ((cat.total / total) * 100).toFixed(1) : 0}%
                          </span>
                        </span>
                      </div>
                      <div style={{ height: "4px", width: "100%", overflow: "hidden", borderRadius: "2px", background: "var(--border)" }}>
                        <div style={{ height: "100%", width: `${total > 0 ? (cat.total / total) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: "2px" }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Ingresos por fuente */}
      {tab === "incomes" && (
        <Card className="animate-fade-in-up delay-200" style={{ padding: "18px 20px" }}>
          <CardHeader><CardTitle>Evolución de ingresos — últimos 12 meses</CardTitle></CardHeader>
          {incomeSummary.length === 0 ? (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "13px" }}>Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeSummary.map((m) => ({ name: `${m.month}/${m.year}`, Ingresos: m.total_income }))}>
                <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={36} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipContentStyle} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="Ingresos" fill="var(--success)" radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* Tab: Evolución mensual */}
      {tab === "evolution" && (
        <Card className="animate-fade-in-up delay-200" style={{ padding: "18px 20px" }}>
          <CardHeader><CardTitle>Ingresos vs Gastos — {year}</CardTitle></CardHeader>
          {evolutionData.length === 0 ? (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "13px" }}>Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData}>
                <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="Ingresos" stroke="var(--success)" strokeWidth={2} dot={{ r: 3, fill: "var(--success)" }} />
                <Line dataKey="Gastos" stroke="var(--danger)" strokeWidth={2} dot={{ r: 3, fill: "var(--danger)" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-2)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* Tab: Resumen anual */}
      {tab === "annual" && (
        <Card className="animate-fade-in-up delay-200" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={TH}>Mes</th>
                <th style={{ ...TH, textAlign: "right" }}>Ingresos</th>
                <th style={{ ...TH, textAlign: "right" }}>Gastos</th>
                <th style={{ ...TH, textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(annual?.rows ?? []).map((row, i) => (
                <tr
                  key={row.month}
                  style={{ borderBottom: i !== 11 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-2)" }}>{row.month_name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--success)" }}>{row.total_income > 0 ? formatCurrency(row.total_income) : "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--danger)" }}>{row.total_expenses > 0 ? formatCurrency(row.total_expenses) : "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-mono)", color: row.balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {row.balance !== 0 ? (row.balance > 0 ? "+" : "") + formatCurrency(row.balance) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {annual && (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-2)" }}>
                  <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>Total {year}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--success)" }}>{formatCurrency(annual.total_income)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--danger)" }}>{formatCurrency(annual.total_expenses)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: annual.total_balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {annual.total_balance > 0 ? "+" : ""}{formatCurrency(annual.total_balance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}

      {/* Tab: Año vs Año */}
      {tab === "yoy" && (
        <div className="animate-fade-in-up delay-200" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>Comparar:</span>
            <Select options={YEAR_OPTIONS} value={String(yoyYearA)} onChange={(e) => setYoyYearA(Number(e.target.value))} />
            <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>vs</span>
            <Select options={YEAR_OPTIONS} value={String(yoyYearB)} onChange={(e) => setYoyYearB(Number(e.target.value))} />
          </div>

          {yoy && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* Summary KPI row */}
              <Card style={{ padding: "18px 20px", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  {[
                    { label: `Ingresos ${yoyYearA}`, value: yoy.total_income_a, color: "var(--success)" },
                    { label: `Ingresos ${yoyYearB}`, value: yoy.total_income_b, color: "var(--success)", dim: true },
                    { label: `Gastos ${yoyYearA}`, value: yoy.total_expenses_a, color: "var(--danger)" },
                    { label: `Gastos ${yoyYearB}`, value: yoy.total_expenses_b, color: "var(--danger)", dim: true },
                  ].map((kpi) => (
                    <div key={kpi.label}>
                      <p style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-ui)", marginBottom: "4px" }}>{kpi.label}</p>
                      <p style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: kpi.color, opacity: kpi.dim ? 0.6 : 1 }}>
                        {formatCurrency(kpi.value)}
                      </p>
                    </div>
                  ))}
                  <div>
                    <p style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-ui)", marginBottom: "4px" }}>Δ Ingresos</p>
                    <p style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: yoy.income_diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {yoy.income_diff >= 0 ? "+" : ""}{formatCurrency(yoy.income_diff)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-ui)", marginBottom: "4px" }}>Δ Gastos</p>
                    <p style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: yoy.expenses_diff <= 0 ? "var(--success)" : "var(--danger)" }}>
                      {yoy.expenses_diff >= 0 ? "+" : ""}{formatCurrency(yoy.expenses_diff)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Income comparison chart */}
              <Card style={{ padding: "18px 20px" }}>
                <CardHeader><CardTitle>Ingresos por mes</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={yoyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={36} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipContentStyle} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar dataKey={`Ingresos ${yoyYearA}`} fill="var(--success)" opacity={0.9} radius={[2, 2, 0, 0]} />
                    <Bar dataKey={`Ingresos ${yoyYearB}`} fill="var(--success)" opacity={0.4} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Expenses comparison chart */}
              <Card style={{ padding: "18px 20px" }}>
                <CardHeader><CardTitle>Gastos por mes</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={yoyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={36} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipContentStyle} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar dataKey={`Gastos ${yoyYearA}`} fill="var(--danger)" opacity={0.9} radius={[2, 2, 0, 0]} />
                    <Bar dataKey={`Gastos ${yoyYearB}`} fill="var(--danger)" opacity={0.4} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Monthly detail table */}
              <Card style={{ padding: 0, overflow: "hidden", gridColumn: "1 / -1" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={TH}>Mes</th>
                      <th style={{ ...TH, textAlign: "right" }}>Ingresos {yoyYearA}</th>
                      <th style={{ ...TH, textAlign: "right" }}>Ingresos {yoyYearB}</th>
                      <th style={{ ...TH, textAlign: "right" }}>Gastos {yoyYearA}</th>
                      <th style={{ ...TH, textAlign: "right" }}>Gastos {yoyYearB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(yoy.rows ?? []).map((row, i) => (
                      <tr
                        key={row.month}
                        style={{ borderBottom: i !== (yoy.rows.length - 1) ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "8px 16px", fontSize: "12px", color: "var(--text-2)" }}>{row.month_name}</td>
                        <td style={{ padding: "8px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--success)" }}>{row.income_a > 0 ? formatCurrency(row.income_a) : "—"}</td>
                        <td style={{ padding: "8px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--success)", opacity: 0.6 }}>{row.income_b > 0 ? formatCurrency(row.income_b) : "—"}</td>
                        <td style={{ padding: "8px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--danger)" }}>{row.expenses_a > 0 ? formatCurrency(row.expenses_a) : "—"}</td>
                        <td style={{ padding: "8px 16px", textAlign: "right", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--danger)", opacity: 0.6 }}>{row.expenses_b > 0 ? formatCurrency(row.expenses_b) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
