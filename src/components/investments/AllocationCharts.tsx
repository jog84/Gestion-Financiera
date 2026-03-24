import { PieChart, Pie, Cell, Tooltip as ReTooltip } from "recharts";

interface AllocationPosition {
  key: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  sector: string;
  currentValueArs: number;
  currentValueUsd: number;
  invertidoArs: number;
}

interface AllocationChartsProps {
  positions: AllocationPosition[];
  currency: "ARS" | "USD";
  sym: string;
  onSectorClick?: (sector: string | null) => void;
  activeSector?: string | null;
}

const CHART_COLORS = [
  "#4361ee", "#7c3aed", "#06d6a0", "#fb8500", "#0891b2",
  "#f59e0b", "#ef4444", "#84cc16", "#ec4899", "#14b8a6",
  "#f97316", "#8b5cf6",
];

const SECTOR_COLORS: Record<string, string> = {
  "Tecnología": "#4361ee",
  "Financiero": "#06d6a0",
  "Energía": "#fb8500",
  "Utilities": "#0891b2",
  "Consumo": "#f59e0b",
  "Salud": "#ec4899",
  "Minería": "#f97316",
  "Agro": "#84cc16",
  "Telecom": "#8b5cf6",
  "Renta Fija": "#6b7280",
  "Fondos": "#14b8a6",
  "Crypto": "#ef4444",
  "Otro": "#9ca3af",
};

function fNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

interface ChartSlice {
  name: string;
  value: number;
  color: string;
  pct: number;
  key?: string;
}

interface DonutPanelProps {
  title: string;
  data: ChartSlice[];
  sym: string;
  onSliceClick?: (name: string | null) => void;
  activeSlice?: string | null;
}

function TooltipContent({ active, payload, sym }: { active?: boolean; payload?: ReadonlyArray<{ payload?: ChartSlice }>; sym: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  if (!item) return null;
  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "8px", padding: "8px 12px", fontSize: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)", zIndex: 100,
    }}>
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>{item.name}</div>
      <div style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{sym}{fNum(item.value)}</div>
      <div style={{ color: "var(--text-3)", fontSize: "11px" }}>{item.pct.toFixed(1)}%</div>
    </div>
  );
}

function DonutPanel({ title, data, sym, onSliceClick, activeSlice }: DonutPanelProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) return (
    <div style={{
      flex: 1, background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "12px" }}>
        {title}
      </div>
      <div style={{ height: "80px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "12px" }}>
        Sin datos
      </div>
    </div>
  );

  const MAX_SLICES = 7;
  let displayData = data;
  if (data.length > MAX_SLICES) {
    const top = data.slice(0, MAX_SLICES - 1);
    const othersValue = data.slice(MAX_SLICES - 1).reduce((s, d) => s + d.value, 0);
    displayData = [...top, { name: "Otros", value: othersValue, color: "#9ca3af", pct: total > 0 ? (othersValue / total) * 100 : 0 }];
  }

  return (
    <div style={{
      flex: 1, background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "14px 16px", minWidth: 0,
    }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "12px" }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Donut */}
        <div style={{ position: "relative", flexShrink: 0, width: 120, height: 120 }}>
          <PieChart width={120} height={120}>
            <Pie
              data={displayData} cx={60} cy={60}
              innerRadius={36} outerRadius={54}
              dataKey="value" stroke="none" paddingAngle={2}
            >
              {displayData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  opacity={activeSlice && activeSlice !== entry.name ? 0.35 : 1}
                  style={{ cursor: onSliceClick ? "pointer" : "default", outline: "none" }}
                  onClick={() => onSliceClick?.(activeSlice === entry.name ? null : entry.name)}
                />
              ))}
            </Pie>
            <ReTooltip content={(props) => <TooltipContent {...props} sym={sym} />} />
          </PieChart>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Total</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.3 }}>
              {sym}{fNum(total)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
          {displayData.map((item, i) => {
            const isActive = activeSlice === item.name;
            return (
              <div
                key={i}
                onClick={() => onSliceClick?.(activeSlice === item.name ? null : item.name)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  cursor: onSliceClick ? "pointer" : "default",
                  opacity: activeSlice && !isActive ? 0.45 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <div style={{
                  width: "7px", height: "7px", borderRadius: "2px",
                  background: item.color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: "11px", color: "var(--text-2)", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {item.name}
                </span>
                <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-3)", flexShrink: 0 }}>
                  {item.pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AllocationCharts({ positions, currency, sym, onSectorClick, activeSector }: AllocationChartsProps) {
  const isArs = currency === "ARS";
  const getValue = (pos: AllocationPosition) => isArs ? pos.currentValueArs : pos.currentValueUsd;

  // By type
  const typeMap = new Map<string, { value: number; color: string; label: string }>();
  for (const pos of positions) {
    const v = getValue(pos);
    if (v <= 0) continue;
    const ex = typeMap.get(pos.type);
    if (ex) ex.value += v;
    else typeMap.set(pos.type, { value: v, color: pos.typeColor, label: pos.typeLabel });
  }
  const typeTotal = Array.from(typeMap.values()).reduce((s, d) => s + d.value, 0);
  const typeData: ChartSlice[] = Array.from(typeMap.entries())
    .map(([, d]) => ({ name: d.label, value: d.value, color: d.color, pct: typeTotal > 0 ? (d.value / typeTotal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // By sector
  const sectorMap = new Map<string, number>();
  for (const pos of positions) {
    const v = getValue(pos);
    if (v <= 0) continue;
    sectorMap.set(pos.sector, (sectorMap.get(pos.sector) ?? 0) + v);
  }
  const sectorTotal = Array.from(sectorMap.values()).reduce((s, d) => s + d, 0);
  const sectorData: ChartSlice[] = Array.from(sectorMap.entries())
    .map(([name, value], i) => ({
      name, value,
      color: SECTOR_COLORS[name] ?? CHART_COLORS[i % CHART_COLORS.length],
      pct: sectorTotal > 0 ? (value / sectorTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // By currency exposure (ARS vs USD)
  let arsValue = 0, usdValue = 0;
  for (const pos of positions) {
    if (pos.type === "plazo_fijo" || pos.type === "fci") {
      arsValue += isArs ? pos.currentValueArs : pos.currentValueUsd;
    } else {
      usdValue += isArs ? pos.currentValueArs : pos.currentValueUsd;
    }
  }
  const currTotal = arsValue + usdValue;
  const currData: ChartSlice[] = [
    { name: "USD (hard)", value: usdValue, color: "#4361ee", pct: currTotal > 0 ? (usdValue / currTotal) * 100 : 0 },
    { name: "ARS / Local", value: arsValue, color: "#06d6a0", pct: currTotal > 0 ? (arsValue / currTotal) * 100 : 0 },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
      <DonutPanel title="Por tipo" data={typeData} sym={sym} />
      <DonutPanel
        title="Por sector"
        data={sectorData}
        sym={sym}
        onSliceClick={onSectorClick}
        activeSlice={activeSector}
      />
      <DonutPanel title="Exposición moneda" data={currData} sym={sym} />
    </div>
  );
}
