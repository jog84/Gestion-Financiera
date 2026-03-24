import { useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TrendingUp, TrendingDown } from "lucide-react";

interface RebalancePosition {
  key: string;
  name: string;
  typeLabel: string;
  typeColor: string;
  currentValue: number;
  currentWeight: number; // 0–1
}

interface RebalanceModalProps {
  open: boolean;
  onClose: () => void;
  positions: RebalancePosition[];
  totalValue: number;
  currency: "ARS" | "USD";
  sym: string;
}

function fNum(n: number, d = 0) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

export function RebalanceModal({ open, onClose, positions, totalValue, currency: _currency, sym }: RebalanceModalProps) {
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const equal = positions.length > 0 ? (100 / positions.length) : 0;
    return Object.fromEntries(positions.map(p => [p.key, equal.toFixed(1)]));
  });

  const [preset, setPreset] = useState<"equal" | "current" | "custom">("equal");

  const applyPreset = (p: "equal" | "current") => {
    if (p === "equal") {
      const equal = positions.length > 0 ? (100 / positions.length) : 0;
      setTargets(Object.fromEntries(positions.map(pos => [pos.key, equal.toFixed(1)])));
    } else {
      setTargets(Object.fromEntries(positions.map(pos => [(pos.key), (pos.currentWeight * 100).toFixed(1)])));
    }
    setPreset(p);
  };

  const targetSum = useMemo(() => {
    return Object.values(targets).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [targets]);

  const isValid = Math.abs(targetSum - 100) < 0.5;

  interface Rebalance {
    key: string;
    typeLabel: string;
    typeColor: string;
    currentValue: number;
    currentWeight: number;
    targetWeight: number;
    targetValue: number;
    delta: number;
    action: "comprar" | "vender" | "mantener";
  }

  const rebalances: Rebalance[] = useMemo(() => {
    return positions.map(pos => {
      const targetWeight = (parseFloat(targets[pos.key]) || 0) / 100;
      const targetValue = totalValue * targetWeight;
      const delta = targetValue - pos.currentValue;
      return {
        key: pos.key,
        typeLabel: pos.typeLabel,
        typeColor: pos.typeColor,
        currentValue: pos.currentValue,
        currentWeight: pos.currentWeight,
        targetWeight,
        targetValue,
        delta,
        action: Math.abs(delta) < totalValue * 0.005 ? "mantener" : delta > 0 ? "comprar" : "vender",
      };
    });
  }, [positions, targets, totalValue]);

  return (
    <Modal open={open} onClose={onClose} title="Simulación de rebalanceo">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "560px" }}>

        {/* Preset buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Preset:
          </span>
          {(["equal", "current"] as const).map(p => (
            <button key={p} onClick={() => applyPreset(p)} style={{
              padding: "4px 12px", fontSize: "12px", fontWeight: 500,
              border: "1px solid", borderRadius: "6px", cursor: "pointer", transition: "all 0.15s",
              borderColor: preset === p ? "var(--primary)" : "var(--border)",
              background: preset === p ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
              color: preset === p ? "var(--primary)" : "var(--text-3)",
            }}>
              {p === "equal" ? "Pesos iguales" : "Distribución actual"}
            </button>
          ))}
          <span style={{
            marginLeft: "auto", fontSize: "12px", fontFamily: "var(--font-mono)",
            color: isValid ? "var(--success)" : "var(--danger)",
            fontWeight: 600,
          }}>
            Suma: {targetSum.toFixed(1)}% {isValid ? "✓" : `(falta ${(100 - targetSum).toFixed(1)}%)`}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Activo", "Valor actual", "Peso actual", "Peso objetivo", "Δ Valor", "Acción"].map((h, i) => (
                  <th key={h} style={{
                    padding: "6px 10px", fontSize: "10px", fontWeight: 600,
                    color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase",
                    textAlign: i <= 1 ? "left" : "right",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rebalances.map((row) => (
                <tr key={row.key} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "8px 10px", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        display: "inline-block", width: "8px", height: "8px",
                        borderRadius: "2px", background: row.typeColor, flexShrink: 0,
                      }} />
                      {row.key}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-2)", textAlign: "right" }}>
                    {sym}{fNum(row.currentValue)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                      <div style={{ width: "40px", height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${Math.min(row.currentWeight * 100, 100)}%`,
                          background: row.typeColor, borderRadius: "2px",
                        }} />
                      </div>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-3)", minWidth: "36px", textAlign: "right" }}>
                        {(row.currentWeight * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                      <input
                        type="text" inputMode="decimal"
                        value={targets[row.key]}
                        onChange={(e) => {
                          setTargets(prev => ({ ...prev, [row.key]: e.target.value }));
                          setPreset("custom");
                        }}
                        style={{
                          width: "54px", textAlign: "right", fontFamily: "var(--font-mono)",
                          fontSize: "12px", padding: "3px 6px",
                          background: "var(--surface-2)", border: "1px solid var(--border)",
                          borderRadius: "4px", color: "var(--text)", outline: "none",
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
                      />
                      <span style={{ fontSize: "11px", color: "var(--text-3)" }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <span style={{
                      fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: 600,
                      color: row.action === "mantener" ? "var(--text-3)" : row.delta > 0 ? "var(--success)" : "var(--danger)",
                    }}>
                      {row.action === "mantener" ? "—" : `${row.delta > 0 ? "+" : ""}${sym}${fNum(Math.abs(row.delta))}`}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {row.action === "mantener" ? (
                      <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Mantener</span>
                    ) : row.action === "comprar" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>
                        <TrendingUp size={11} /> Comprar
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--danger)", fontWeight: 600 }}>
                        <TrendingDown size={11} /> Vender
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {isValid && (
          <div style={{
            background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px",
            display: "flex", gap: "20px", flexWrap: "wrap",
          }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Compras necesarias </span>
              <strong style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--success)" }}>
                {sym}{fNum(rebalances.filter(r => r.delta > 0).reduce((s, r) => s + r.delta, 0))}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Ventas sugeridas </span>
              <strong style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--danger)" }}>
                {sym}{fNum(Math.abs(rebalances.filter(r => r.delta < 0).reduce((s, r) => s + r.delta, 0)))}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Portfolio objetivo </span>
              <strong style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                {sym}{fNum(totalValue)}
              </strong>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
            Solo es una simulación. No se guardan cambios.
          </span>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
