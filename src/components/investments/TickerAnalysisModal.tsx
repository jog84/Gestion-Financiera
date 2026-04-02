import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, TrendingUp, TrendingDown, Activity, Globe,
  AlertCircle, ArrowUpRight, ArrowDownRight, BarChart2, LineChart
} from "lucide-react";
import { fetchTickerAnalysis, type TickerAnalysis } from "@/lib/api";
import { PriceChart } from "./PriceChart";

interface Props {
  ticker: string;
  onClose: () => void;
  onRegister?: (ticker: string, price: number) => void;
}

export function TickerAnalysisModal({ ticker, onClose, onRegister }: Props) {
  const [showChart, setShowChart] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ticker-analysis", ticker],
    queryFn: () => fetchTickerAnalysis(ticker),
    staleTime: 60_000,
  });

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border-light)",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BarChart2 size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>{ticker}</span>
            {data && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>
                {data.instrument_name}
              </span>
            )}
            {data?.current_price != null && (
              <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)", marginLeft: "8px" }}>
                ${data.current_price.toLocaleString("es-AR")}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowChart(true)}
            title="Ver gráfico TradingView"
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "4px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
              background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)",
              color: "#22d3ee", cursor: "pointer",
            }}
          >
            <LineChart size={13} /> Gráfico
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Timestamps */}
        {data && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "12px",
            padding: "8px 20px", borderBottom: "1px solid var(--border-light)",
            fontSize: "11px", color: "var(--text-muted)",
          }}>
            {data.price_history.length > 0 && (
              <span>📊 Último precio: <strong style={{ color: "var(--text)" }}>{fmtTs(data.price_history[data.price_history.length - 1].timestamp)}</strong></span>
            )}
            {data.technicals && (
              <span>📐 Técnicos: <strong style={{ color: "var(--text)" }}>{fmtTs(data.technicals.timestamp)}</strong></span>
            )}
            {data.signal && (
              <span>🎯 Señal generada: <strong style={{ color: "var(--text)" }}>{fmtTs(data.signal.generated_at)}</strong></span>
            )}
            {data.signal && (
              <span>⏱ Vence: <strong style={{ color: "var(--text)" }}>{fmtTs(data.signal.expires_at)}</strong></span>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {isLoading && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "14px" }}>
              Cargando análisis de {ticker}...
            </div>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", padding: "20px" }}>
              <AlertCircle size={14} />
              <span style={{ fontSize: "13px" }}>No se encontró análisis para {ticker} en Inversiones AR.</span>
            </div>
          )}
          {data && <AnalysisBody data={data} onRegister={onRegister} />}
        </div>
      </div>
      {showChart && (
        <PriceChart
          ticker={ticker}
          assetClass={data?.asset_class}
          onClose={() => setShowChart(false)}
        />
      )}
    </div>
  );
}

function AnalysisBody({ data, onRegister }: { data: TickerAnalysis; onRegister?: (ticker: string, price: number) => void }) {
  const { signal, technicals, price_history, macro_snapshot } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Gráfico de velas */}
      {price_history.length > 0 && (
        <CandleChart
          bars={price_history}
          ema20={technicals?.ema20 ?? null}
          ema50={technicals?.ema50 ?? null}
          support={technicals?.support_level ?? null}
          resistance={technicals?.resistance_level ?? null}
        />
      )}

      {/* Señal activa */}
      {signal ? (
        <SignalPanel signal={signal} onRegister={onRegister} />
      ) : (
        <div style={{
          padding: "12px 16px", borderRadius: "10px",
          border: "1px solid var(--border-light)",
          background: "var(--surface-2)",
          fontSize: "13px", color: "var(--text-muted)",
        }}>
          Sin señal activa para {data.ticker} en este momento.
        </div>
      )}

      {/* Indicadores técnicos */}
      {technicals && <TechnicalsPanel tech={technicals} currentPrice={data.current_price} />}

      {/* Contexto macro */}
      {macro_snapshot && <MacroPanel macro={macro_snapshot} />}

      {/* Razonamiento */}
      {signal && signal.reasoning.length > 0 && <ReasoningPanel reasoning={signal.reasoning} />}
    </div>
  );
}

// ─── Mini gráfico de velas (SVG) ─────────────────────────────────────────────

function CandleChart({ bars, ema20, ema50, support, resistance }: {
  bars: { timestamp: string; open: number; high: number; low: number; close: number }[];
  ema20: number | null; ema50: number | null;
  support: number | null; resistance: number | null;
}) {
  const W = 720, H = 200, PAD = 8;
  const allValues = bars.flatMap(b => [b.high, b.low]);
  if (ema20) allValues.push(ema20);
  if (ema50) allValues.push(ema50);
  if (support) allValues.push(support);
  if (resistance) allValues.push(resistance);
  const minV = Math.min(...allValues) * 0.998;
  const maxV = Math.max(...allValues) * 1.002;
  const range = maxV - minV || 1;

  const toY = (v: number) => PAD + ((maxV - v) / range) * (H - PAD * 2);
  const barW = Math.max(2, (W / bars.length) * 0.6);
  const step = W / bars.length;

  return (
    <div style={{ borderRadius: "10px", border: "1px solid var(--border-light)", background: "var(--surface-2)", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "180px", display: "block" }}>
        {/* Soporte / Resistencia */}
        {support && (
          <>
            <line x1={0} y1={toY(support)} x2={W} y2={toY(support)} stroke="#4ade80" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
            <text x={W - 4} y={toY(support) - 3} textAnchor="end" fontSize={9} fill="#4ade80" opacity={0.8}>S {support.toFixed(0)}</text>
          </>
        )}
        {resistance && (
          <>
            <line x1={0} y1={toY(resistance)} x2={W} y2={toY(resistance)} stroke="#f87171" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
            <text x={W - 4} y={toY(resistance) - 3} textAnchor="end" fontSize={9} fill="#f87171" opacity={0.8}>R {resistance.toFixed(0)}</text>
          </>
        )}
        {/* EMA 20 */}
        {ema20 && (
          <line x1={0} y1={toY(ema20)} x2={W} y2={toY(ema20)} stroke="#22d3ee" strokeWidth={1.5} opacity={0.7} />
        )}
        {/* EMA 50 */}
        {ema50 && (
          <line x1={0} y1={toY(ema50)} x2={W} y2={toY(ema50)} stroke="#f59e0b" strokeWidth={1.5} opacity={0.7} />
        )}
        {/* Velas */}
        {bars.map((b, i) => {
          const x = i * step + step / 2;
          const isUp = b.close >= b.open;
          const color = isUp ? "#4ade80" : "#f87171";
          const bodyTop = toY(Math.max(b.open, b.close));
          const bodyBot = toY(Math.min(b.open, b.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              <line x1={x} y1={toY(b.high)} x2={x} y2={toY(b.low)} stroke={color} strokeWidth={1} opacity={0.8} />
              <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} opacity={0.85} />
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "12px", padding: "6px 12px 8px", fontSize: "10px", color: "var(--text-muted)" }}>
        {ema20 && <span style={{ color: "#22d3ee" }}>— EMA 20: {ema20.toFixed(0)}</span>}
        {ema50 && <span style={{ color: "#f59e0b" }}>— EMA 50: {ema50.toFixed(0)}</span>}
        {support && <span style={{ color: "#4ade80" }}>- - Soporte: {support.toFixed(0)}</span>}
        {resistance && <span style={{ color: "#f87171" }}>- - Resistencia: {resistance.toFixed(0)}</span>}
        <span style={{ marginLeft: "auto" }}>{bars.length} barras</span>
      </div>
    </div>
  );
}

// ─── Panel de señal ───────────────────────────────────────────────────────────

function SignalPanel({ signal, onRegister }: {
  signal: NonNullable<TickerAnalysis["signal"]>;
  onRegister?: (ticker: string, price: number) => void;
}) {
  const isBuy = signal.signal_type === "COMPRA";
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  return (
    <div style={{
      borderRadius: "10px",
      border: `1px solid ${isBuy ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
      background: isBuy ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700,
            background: isBuy ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
            color: isBuy ? "#4ade80" : "#f87171",
          }}>
            {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {signal.signal_type}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Confianza: <strong style={{ color: "var(--text)" }}>{signal.confidence_score.toFixed(0)}%</strong>
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            R/R: <strong style={{ color: signal.risk_reward_ratio >= 2 ? "#4ade80" : "var(--text)" }}>{signal.risk_reward_ratio.toFixed(1)}x</strong>
          </span>
          <StrengthDots value={signal.strength} />
        </div>
        {onRegister && signal.entry_price > 0 && (
          <button
            onClick={() => onRegister(signal.ticker, signal.entry_price)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "5px 12px", borderRadius: "7px",
              border: "1px solid var(--primary)", background: "transparent",
              color: "var(--primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <TrendingUp size={12} /> Registrar operación
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {[
          { label: "Entrada", value: `$${fmt(signal.entry_price)}`, sub: signal.entry_price_usd ? `USD ${signal.entry_price_usd.toFixed(2)}` : null, color: "var(--text)" },
          { label: "Stop Loss", value: `$${fmt(signal.stop_loss)}`, sub: `-${signal.stop_loss_percent.toFixed(1)}%`, color: "#f87171" },
          { label: "TP 1", value: `$${fmt(signal.take_profit1)}`, sub: `+${signal.take_profit1_percent.toFixed(1)}%`, color: "#4ade80" },
          { label: "TP 2", value: `$${fmt(signal.take_profit2)}`, sub: `+${signal.take_profit2_percent.toFixed(1)}%`, color: "#4ade80" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--border-light)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: "14px", color }}>{value}</div>
            {sub && <div style={{ fontSize: "10px", color, opacity: 0.75, marginTop: "2px" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {!signal.execution_ready && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
          <AlertCircle size={11} /> Señal no ejecutable — precio con demora o datos degradados
        </div>
      )}
    </div>
  );
}

// ─── Panel técnicos ───────────────────────────────────────────────────────────

function TechnicalsPanel({ tech, currentPrice }: { tech: NonNullable<TickerAnalysis["technicals"]>; currentPrice: number | null }) {
  const rsiColor = tech.rsi14 == null ? "var(--text-muted)"
    : tech.rsi14 > 70 ? "#f87171"
    : tech.rsi14 < 30 ? "#4ade80"
    : "var(--text)";

  const adxLabel = tech.adx14 == null ? "—"
    : tech.adx14 > 25 ? "Tendencia fuerte"
    : tech.adx14 > 15 ? "Tendencia débil"
    : "Sin tendencia";

  const macdSignal = tech.macd != null && tech.macd_signal != null
    ? tech.macd > tech.macd_signal ? "Alcista" : "Bajista"
    : null;

  const bbPos = tech.bb_upper != null && tech.bb_lower != null && currentPrice != null
    ? ((currentPrice - tech.bb_lower) / (tech.bb_upper - tech.bb_lower) * 100).toFixed(0) + "%"
    : null;

  const items = [
    { label: "RSI (14)", value: tech.rsi14?.toFixed(1) ?? "—", color: rsiColor, sub: tech.rsi14 != null ? (tech.rsi14 > 70 ? "Sobrecomprado" : tech.rsi14 < 30 ? "Sobrevendido" : "Neutro") : null },
    { label: "ADX (14)", value: tech.adx14?.toFixed(1) ?? "—", color: "var(--text)", sub: adxLabel },
    { label: "MACD", value: tech.macd?.toFixed(2) ?? "—", color: tech.macd != null && tech.macd > 0 ? "#4ade80" : "#f87171", sub: macdSignal },
    { label: "EMA 20", value: tech.ema20 != null ? `$${tech.ema20.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "—", color: "#22d3ee", sub: currentPrice && tech.ema20 ? (currentPrice > tech.ema20 ? "Precio sobre EMA" : "Precio bajo EMA") : null },
    { label: "EMA 50", value: tech.ema50 != null ? `$${tech.ema50.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "—", color: "#f59e0b", sub: null },
    { label: "BB Posición", value: bbPos ?? "—", color: "var(--text)", sub: tech.rsi_divergence ? `Div RSI: ${tech.rsi_divergence}` : null },
  ];

  return (
    <div style={{ borderRadius: "10px", border: "1px solid var(--border-light)", background: "var(--surface-2)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <Activity size={14} color="var(--primary)" />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Indicadores Técnicos</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {items.map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: "var(--surface)", borderRadius: "7px", padding: "8px 10px", border: "1px solid var(--border-light)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "3px" }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: "14px", color }}>{value}</div>
            {sub && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{sub}</div>}
          </div>
        ))}
      </div>
      {(tech.support_level || tech.resistance_level) && (
        <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px" }}>
          {tech.support_level && <span>Soporte: <strong style={{ color: "#4ade80" }}>${tech.support_level.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong></span>}
          {tech.resistance_level && <span>Resistencia: <strong style={{ color: "#f87171" }}>${tech.resistance_level.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong></span>}
        </div>
      )}
    </div>
  );
}

// ─── Panel macro ──────────────────────────────────────────────────────────────

function MacroPanel({ macro }: { macro: NonNullable<TickerAnalysis["macro_snapshot"]> }) {
  const items = [
    { label: "EMBI", value: macro.embi != null ? `${macro.embi.toLocaleString("es-AR")} bps` : null, trend: macro.embiTrend },
    { label: "Inflación mensual", value: macro.inflacionMensual != null ? `${macro.inflacionMensual.toFixed(1)}%` : null, trend: null },
    { label: "Brecha cambiaria", value: macro.brechaCambiaria != null ? `${macro.brechaCambiaria.toFixed(1)}%` : null, trend: null },
    { label: "Score macro", value: macro.macroScore != null ? (macro.macroScore > 0 ? `+${macro.macroScore}` : `${macro.macroScore}`) : null, trend: null },
  ].filter(i => i.value != null);

  if (items.length === 0) return null;

  return (
    <div style={{ borderRadius: "10px", border: "1px solid var(--border-light)", background: "var(--surface-2)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <Globe size={14} color="var(--primary)" />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Contexto Macro</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {items.map(({ label, value, trend }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--border-light)", fontSize: "12px" }}>
            <span style={{ color: "var(--text-muted)" }}>{label}:</span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{value}</span>
            {trend === "BAJANDO" && <TrendingDown size={11} color="#4ade80" />}
            {trend === "SUBIENDO" && <TrendingUp size={11} color="#f87171" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Panel razonamiento ───────────────────────────────────────────────────────

function ReasoningPanel({ reasoning }: { reasoning: string[] }) {
  return (
    <div style={{ borderRadius: "10px", border: "1px solid var(--border-light)", background: "var(--surface-2)", padding: "14px 16px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
        Análisis
      </div>
      <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "5px" }}>
        {reasoning.map((r, i) => (
          <li key={i} style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: "1.45" }}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Dots de fuerza ───────────────────────────────────────────────────────────

function fmtTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function StrengthDots({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: i <= value ? "var(--primary)" : "var(--border)",
        }} />
      ))}
    </div>
  );
}
