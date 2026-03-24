import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, Lightbulb, ChevronDown, ChevronUp, X } from "lucide-react";
import type { SmartInsight, InsightLevel } from "@/lib/investmentCalcs";

interface InsightsPanelProps {
  insights: SmartInsight[];
}

const LEVEL_CONFIG: Record<InsightLevel, {
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  critical: {
    icon: AlertCircle,
    color: "var(--danger)",
    bg: "color-mix(in srgb, var(--danger) 8%, var(--surface-1))",
    border: "color-mix(in srgb, var(--danger) 35%, var(--border))",
    label: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    color: "var(--warning)",
    bg: "color-mix(in srgb, var(--warning) 8%, var(--surface-1))",
    border: "color-mix(in srgb, var(--warning) 35%, var(--border))",
    label: "Atención",
  },
  info: {
    icon: Info,
    color: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 6%, var(--surface-1))",
    border: "color-mix(in srgb, var(--primary) 25%, var(--border))",
    label: "Info",
  },
  opportunity: {
    icon: Lightbulb,
    color: "var(--success)",
    bg: "color-mix(in srgb, var(--success) 8%, var(--surface-1))",
    border: "color-mix(in srgb, var(--success) 30%, var(--border))",
    label: "Oportunidad",
  },
};

const MAX_VISIBLE = 4;

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  if (insights.length === 0) return null;

  const visible = insights.filter((_, i) => !dismissed.has(i));
  const displayList = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hasMore = visible.length > MAX_VISIBLE;

  const criticalCount = insights.filter(i => i.level === "critical").length;
  const warningCount = insights.filter(i => i.level === "warning").length;

  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "14px 16px", marginBottom: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Insights
          </span>
          {criticalCount > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px",
              background: "color-mix(in srgb, var(--danger) 15%, transparent)",
              color: "var(--danger)",
            }}>
              {criticalCount} crítico{criticalCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px",
              background: "color-mix(in srgb, var(--warning) 15%, transparent)",
              color: "var(--warning)",
            }}>
              {warningCount} alerta{warningCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
          {visible.length} activo{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Insights list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {displayList.map((insight) => {
          const realIdx = insights.indexOf(insight);
          const cfg = LEVEL_CONFIG[insight.level];
          const Icon = cfg.icon;
          return (
            <div
              key={realIdx}
              style={{
                display: "flex", gap: "10px", padding: "9px 12px",
                borderRadius: "8px", background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                alignItems: "flex-start",
              }}
            >
              <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "12px", color: "var(--text)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                  {insight.title}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "2px 0 0 0", lineHeight: 1.4 }}>
                  {insight.description}
                </p>
                {insight.action && (
                  <p style={{
                    fontSize: "11px", color: cfg.color, margin: "4px 0 0 0",
                    fontWeight: 600, lineHeight: 1.3,
                  }}>
                    → {insight.action}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, realIdx]))}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-3)", padding: "0", borderRadius: "4px",
                  flexShrink: 0, display: "flex", alignItems: "center",
                }}
                title="Descartar"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: "11px", padding: "8px 0 0 0",
            fontFamily: "var(--font-ui)",
          }}
        >
          {expanded ? (
            <><ChevronUp size={12} /> Mostrar menos</>
          ) : (
            <><ChevronDown size={12} /> Ver {visible.length - MAX_VISIBLE} más</>
          )}
        </button>
      )}
    </div>
  );
}
