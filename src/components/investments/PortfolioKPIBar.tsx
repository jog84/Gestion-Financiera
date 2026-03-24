import { AlertTriangle } from "lucide-react";

interface PortfolioKPIBarProps {
  portfolioValue: number;
  totalInvested: number;
  cagr: number;
  xirr: number | null;
  currency: "ARS" | "USD";
  sym: string;
  /** Retorno porcentual en USD real (usa CCL actual para el valor presente).
   *  undefined = no disponible (sin CCL actual). */
  returnPctUsd?: number;
}

function fNum(n: number, d = 2) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

function fPct(n: number, showSign = true) {
  const sign = showSign && n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  subLabel?: string;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
  alertLabel?: string;
  mono?: boolean;
}

function KPICard({ label, value, subValue, subLabel, trend, alert, alertLabel, mono }: KPICardProps) {
  const trendColor =
    trend === "up" ? "var(--success)" :
    trend === "down" ? "var(--danger)" :
    "var(--text)";

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: alert ? "color-mix(in srgb, var(--warning) 8%, var(--surface-1))" : "var(--surface-1)",
      border: `1px solid ${alert ? "color-mix(in srgb, var(--warning) 40%, var(--border))" : "var(--border)"}`,
      borderRadius: "12px",
      padding: "14px 16px",
      transition: "border-color 0.2s",
    }}>
      <div style={{
        fontSize: "10px", fontWeight: 600, color: "var(--text-3)",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px",
        display: "flex", alignItems: "center", gap: "5px",
      }}>
        {alert && <AlertTriangle size={10} style={{ color: "var(--warning)", flexShrink: 0 }} />}
        {label}
      </div>

      <div style={{
        fontSize: "22px", fontWeight: 700, lineHeight: 1.15,
        fontFamily: mono !== false ? "var(--font-mono)" : "var(--font-ui)",
        color: trendColor,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </div>

      {(subValue || subLabel || alertLabel) && (
        <div style={{
          fontSize: "11px", color: alert ? "var(--warning)" : "var(--text-3)",
          marginTop: "5px", display: "flex", alignItems: "center", gap: "4px",
          fontFamily: "var(--font-mono)",
        }}>
          {subValue && <span>{subValue}</span>}
          {subLabel && <span style={{ fontFamily: "var(--font-ui)", color: "var(--text-3)" }}>{subLabel}</span>}
          {alertLabel && <span>{alertLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function PortfolioKPIBar({ portfolioValue, totalInvested, cagr, xirr, sym, returnPctUsd }: PortfolioKPIBarProps) {
  const ganancia = portfolioValue - totalInvested;
  const retTotal = totalInvested > 0 ? ganancia / totalInvested : 0;
  const isPos = ganancia >= 0;

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
      {/* Patrimonio */}
      <KPICard
        label="Portfolio"
        value={`${sym}${fNum(portfolioValue, 0)}`}
        subValue={`${isPos ? "+" : ""}${sym}${fNum(Math.abs(ganancia), 0)}`}
        subLabel="total"
        trend={isPos ? "up" : "down"}
      />

      {/* Retorno total */}
      <KPICard
        label="Retorno total"
        value={fPct(retTotal)}
        subValue={`${sym}${fNum(totalInvested, 0)}`}
        subLabel="invertido"
        trend={isPos ? "up" : "down"}
      />

      {/* CAGR */}
      <KPICard
        label="CAGR (anual)"
        value={fPct(cagr)}
        subLabel="rendimiento anualizado"
        trend={cagr > 0 ? "up" : cagr < 0 ? "down" : "neutral"}
      />

      {/* IRR */}
      {xirr !== null ? (
        <KPICard
          label="IRR (por timing)"
          value={fPct(xirr)}
          subLabel="ajustado por fecha"
          trend={xirr > 0 ? "up" : xirr < 0 ? "down" : "neutral"}
        />
      ) : (
        <KPICard
          label="IRR"
          value="—"
          subLabel="datos insuficientes"
          trend="neutral"
        />
      )}

      {/* Retorno en USD (con CCL actual) */}
      {returnPctUsd !== undefined ? (
        <KPICard
          label="Retorno en USD"
          value={fPct(returnPctUsd / 100)}
          subLabel="usando CCL actual"
          trend={returnPctUsd > 0 ? "up" : returnPctUsd < 0 ? "down" : "neutral"}
          alert={Math.abs(returnPctUsd) < 1 && returnPctUsd !== 0}
          alertLabel={Math.abs(returnPctUsd) < 1 ? "Casi neutro vs USD" : undefined}
        />
      ) : (
        <KPICard
          label="Retorno en USD"
          value="—"
          subLabel="actualizar CCL para ver"
          trend="neutral"
        />
      )}
    </div>
  );
}
