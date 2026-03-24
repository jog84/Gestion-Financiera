import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PortfolioSnapshot } from "@/types";

interface ChartDataPoint {
  date: string;      // YYYY-MM-DD
  invested: number;  // cumulative invested
  portfolio: number; // portfolio value
  label?: string;    // display label for X axis
}

interface PortfolioChartProps {
  chartData: ChartDataPoint[];
  snapshots: PortfolioSnapshot[];
  currency: "ARS" | "USD";
  sym: string;
}

type Range = "3m" | "6m" | "1a" | "max";

function fNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function filterByRange(data: ChartDataPoint[], range: Range): ChartDataPoint[] {
  if (range === "max") return data;
  const now = Date.now();
  const days: Record<Range, number> = { "3m": 90, "6m": 180, "1a": 365, max: 99999 };
  const cutoff = now - days[range] * 86400000;
  return data.filter(d => new Date(d.date + "T00:00:00").getTime() >= cutoff);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  sym: string;
}

function CustomTooltip({ active, payload, label, sym }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const portfolio = payload.find(p => p.name === "portfolio");
  const invested = payload.find(p => p.name === "invested");
  const gain = portfolio && invested ? portfolio.value - invested.value : null;
  const gainPct = gain !== null && invested && invested.value > 0 ? (gain / invested.value) * 100 : null;
  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "10px", padding: "10px 14px", fontSize: "12px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)", minWidth: "180px",
    }}>
      <div style={{ color: "var(--text-3)", marginBottom: "8px", fontSize: "11px" }}>
        {label ? formatDateLabel(label) : ""}
      </div>
      {portfolio && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-3)" }}>Portfolio</span>
          <span style={{ color: "var(--primary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            {sym}{fNum(portfolio.value)}
          </span>
        </div>
      )}
      {invested && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-3)" }}>Invertido</span>
          <span style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>
            {sym}{fNum(invested.value)}
          </span>
        </div>
      )}
      {gain !== null && (
        <div style={{
          borderTop: "1px solid var(--border)", paddingTop: "6px", marginTop: "6px",
          display: "flex", justifyContent: "space-between", gap: "16px",
        }}>
          <span style={{ color: "var(--text-3)" }}>Ganancia</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: 700,
            color: gain >= 0 ? "var(--success)" : "var(--danger)",
          }}>
            {gain >= 0 ? "+" : ""}{sym}{fNum(gain)}
            {gainPct !== null && ` (${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%)`}
          </span>
        </div>
      )}
    </div>
  );
}

export function PortfolioChart({ chartData, snapshots, currency, sym }: PortfolioChartProps) {
  const [range, setRange] = useState<Range>("max");

  // Build final data: use snapshots if available (≥2), else use computed chartData
  let finalData: ChartDataPoint[] = [];
  if (snapshots.length >= 2) {
    finalData = snapshots.map(s => ({
      date: s.snapshot_date,
      portfolio: currency === "ARS" ? s.total_value_ars : s.total_value_usd,
      invested: currency === "ARS" ? s.total_invested_ars : s.total_invested_ars / (s.ccl || 1),
    }));
    // Also add the current chartData point if it's newer
    if (chartData.length > 0) {
      const lastChartDate = chartData[chartData.length - 1].date;
      const lastSnapshotDate = finalData[finalData.length - 1].date;
      if (lastChartDate > lastSnapshotDate) {
        finalData.push(chartData[chartData.length - 1]);
      }
    }
  } else {
    finalData = chartData;
  }

  const visibleData = filterByRange(finalData, range);

  const hasData = visibleData.length >= 2;
  const isSnapshotMode = snapshots.length >= 2;

  const ranges: Range[] = ["3m", "6m", "1a", "max"];
  const rangeLabels: Record<Range, string> = { "3m": "3M", "6m": "6M", "1a": "1A", max: "Máx" };

  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Evolución del Portfolio
          </span>
          {!isSnapshotMode && (
            <span style={{
              marginLeft: "8px", fontSize: "10px", color: "var(--warning)",
              background: "color-mix(in srgb, var(--warning) 12%, transparent)",
              padding: "2px 7px", borderRadius: "4px",
            }}>
              Estimado — se enriquece con cada actualización de precios
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "3px 10px", fontSize: "11px", fontWeight: 600,
              border: "1px solid", borderRadius: "6px", cursor: "pointer",
              transition: "all 0.15s",
              borderColor: range === r ? "var(--primary)" : "var(--border)",
              background: range === r ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "transparent",
              color: range === r ? "var(--primary)" : "var(--text-3)",
            }}>
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{
          height: "200px", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", color: "var(--text-3)",
          gap: "8px",
        }}>
          <p style={{ fontSize: "13px" }}>Sin datos de evolución para este rango</p>
          <p style={{ fontSize: "11px" }}>Actualizá los precios regularmente para ver el historial</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={visibleData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4361ee" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4361ee" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b7280" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-ui)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `${sym}${fNum(v)}`}
              tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip sym={sym} />} />
            <Area
              type="monotone" dataKey="invested" name="invested"
              stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3"
              fill="url(#investedGrad)" dot={false}
            />
            <Area
              type="monotone" dataKey="portfolio" name="portfolio"
              stroke="#4361ee" strokeWidth={2.5}
              fill="url(#portfolioGrad)" dot={false}
              activeDot={{ r: 4, fill: "#4361ee", stroke: "var(--surface-1)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
