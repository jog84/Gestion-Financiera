import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Plus, Wifi, WifiOff } from "lucide-react";
import { fetchInversionesSignals, type InversionesSignal } from "@/lib/api";

interface SignalsWidgetProps {
  onRegister: (signal: InversionesSignal) => void;
}

export function SignalsWidget({ onRegister }: SignalsWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"TODOS" | "COMPRA" | "VENTA">("TODOS");

  const { data: signals = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["inversiones-signals"],
    queryFn: fetchInversionesSignals,
    retry: false,
    staleTime: 60_000,
    refetchInterval: expanded ? 30_000 : false,
  });

  const buyCount = signals.filter((s) => s.signal_type === "COMPRA").length;
  const sellCount = signals.filter((s) => s.signal_type === "VENTA").length;
  const filtered = filter === "TODOS" ? signals : signals.filter((s) => s.signal_type === filter);
  const executableCount = signals.filter((s) => s.execution_ready).length;

  const isOffline = !!error;

  return (
    <div
      style={{
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      {/* Header - siempre visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={15} color={isOffline ? "var(--text-muted)" : "var(--primary)"} />
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Señales · Inversiones AR
          </span>
          {isOffline ? (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
              <WifiOff size={11} /> Desconectado
            </span>
          ) : !isLoading && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--success, #4ade80)" }}>
              <Wifi size={11} /> En línea
            </span>
          )}
        </div>

        {!isOffline && !isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>{signals.length} señales</span>
            {buyCount > 0 && (
              <span style={{ color: "#4ade80", display: "flex", alignItems: "center", gap: "3px" }}>
                <ArrowUpRight size={12} /> {buyCount} compra
              </span>
            )}
            {sellCount > 0 && (
              <span style={{ color: "#f87171", display: "flex", alignItems: "center", gap: "3px" }}>
                <ArrowDownRight size={12} /> {sellCount} venta
              </span>
            )}
            {executableCount > 0 && (
              <span style={{ color: "var(--primary)", fontSize: "11px" }}>{executableCount} ejecutables</span>
            )}
          </div>
        )}

        {expanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </button>

      {/* Contenido expandido */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-light)", padding: "12px 14px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
              Conectando con Inversiones AR...
            </div>
          ) : isOffline ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>
              <AlertCircle size={14} />
              <span>No se encontró la base de datos de Inversiones AR. Verificá que la app esté instalada en <code style={{ fontSize: "11px" }}>E:/Proyectos/Inversiones</code></span>
            </div>
          ) : signals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
              No hay señales activas en este momento.
            </div>
          ) : (
            <>
              {/* Filtros + Refresh */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["TODOS", "COMPRA", "VENTA"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-light)",
                        background: filter === f ? "var(--primary)" : "var(--surface-2)",
                        color: filter === f ? "#fff" : "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: filter === f ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    padding: "3px 10px", borderRadius: "6px",
                    border: "1px solid var(--border-light)",
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    fontSize: "11px", cursor: "pointer",
                    opacity: isFetching ? 0.5 : 1,
                  }}
                >
                  <Activity size={11} />
                  {isFetching ? "Actualizando..." : "Actualizar"}
                </button>
              </div>

              {/* Tabla de señales */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Ticker</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Tipo</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Entrada</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Stop</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>TP1</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>R/R</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Fuerza</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 500 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <SignalRow key={s.id} signal={s} onRegister={onRegister} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal, onRegister }: { signal: InversionesSignal; onRegister: (s: InversionesSignal) => void }) {
  const isBuy = signal.signal_type === "COMPRA";
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--border-light)",
        opacity: signal.is_stale ? 0.5 : 1,
        background: !signal.execution_ready ? "transparent" : isBuy ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)",
      }}
    >
      <td style={{ padding: "7px 8px" }}>
        <div style={{ fontWeight: 700, color: "var(--text)" }}>{signal.ticker}</div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {signal.instrument_name}
        </div>
      </td>
      <td style={{ padding: "7px 8px" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: "3px",
            padding: "2px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
            background: isBuy ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
            color: isBuy ? "#4ade80" : "#f87171",
          }}
        >
          {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {signal.signal_type}
        </span>
        {!signal.execution_ready && (
          <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>No ejecutable</div>
        )}
      </td>
      <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{fmt(signal.entry_price)}</td>
      <td style={{ padding: "7px 8px", textAlign: "right", color: "#f87171" }}>{fmt(signal.stop_loss)}</td>
      <td style={{ padding: "7px 8px", textAlign: "right", color: "#4ade80" }}>
        {fmt(signal.take_profit1)}
        <div style={{ fontSize: "10px", color: "rgba(74,222,128,0.7)" }}>+{signal.take_profit1_percent.toFixed(1)}%</div>
      </td>
      <td style={{ padding: "7px 8px", textAlign: "right", color: signal.risk_reward_ratio >= 2 ? "#4ade80" : "var(--text-muted)" }}>
        {signal.risk_reward_ratio.toFixed(1)}x
      </td>
      <td style={{ padding: "7px 8px", textAlign: "right" }}>
        <StrengthDots value={signal.strength} />
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right" }}>{signal.confidence_score.toFixed(0)}%</div>
      </td>
      <td style={{ padding: "7px 8px", textAlign: "center" }}>
        <button
          onClick={() => onRegister(signal)}
          title="Registrar como operación"
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "4px 10px", borderRadius: "6px",
            border: "1px solid var(--primary)",
            background: "transparent",
            color: "var(--primary)",
            fontSize: "11px", fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={11} /> Registrar
        </button>
      </td>
    </tr>
  );
}

function StrengthDots({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: i <= value ? "var(--primary)" : "var(--border-light)",
          }}
        />
      ))}
    </div>
  );
}
