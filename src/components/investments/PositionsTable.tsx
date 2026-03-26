import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { calcRow } from "@/lib/investmentCalcs";
import {
  fNum,
  fPct,
  INSTRUMENT_COLORS_HEX,
  INVESTMENTS_TD,
  INVESTMENTS_TH,
  SignalBadges,
  SortTH,
  TypeBadge,
  type Currency,
  type EnhancedPosition,
  type SortDir,
  type SortKey,
} from "@/components/investments/investmentHelpers";
import { Card } from "@/components/ui/Card";

type PositionsTableProps = {
  positions: EnhancedPosition[];
  investmentsCount: number;
  currency: Currency;
  sym: string;
  sortCol: SortKey | null;
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
  expandedPos: string | null;
  setExpandedPos: (key: string | null) => void;
  sectorFilter: string | null;
  setSectorFilter: (sector: string | null) => void;
  currentCcl: number | null;
  dispInv: number;
  dispAct: number;
};

export function PositionsTable({
  positions,
  investmentsCount,
  currency,
  sym,
  sortCol,
  sortDir,
  onSort,
  expandedPos,
  setExpandedPos,
  sectorFilter,
  setSectorFilter,
  currentCcl,
  dispInv,
  dispAct,
}: PositionsTableProps) {
  const isGainPos = dispAct - dispInv >= 0;

  return (
    <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <SortTH label="Instrumento" col="nombre" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTH label="Tipo" col="tipo" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <th style={INVESTMENTS_TH}>Sector</th>
              <th style={{ ...INVESTMENTS_TH, textAlign: "right" }}>PPP</th>
              <th style={{ ...INVESTMENTS_TH, textAlign: "right" }}>Precio Act.</th>
              <SortTH label={`Invertido ${currency}`} col="invertido" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label={`Valor Act. ${currency}`} col="actual" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label={`Gan. ${currency}`} col="ganancia" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label="% Ret." col="pct" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label="Peso" col="peso" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <th style={INVESTMENTS_TH}>Señales</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const isArs = currency === "ARS";
              const invertido = isArs ? pos.invertidoArs : pos.invertidoUsd;
              const actual = isArs ? pos.actualArs : pos.actualUsd;
              const ganancia = isArs ? pos.gananciaArs : pos.gananciaUsd;
              const returnPct = invertido > 0 ? (ganancia / invertido) * 100 : 0;
              const isPos = ganancia >= 0;
              const isExpanded = expandedPos === pos.key;
              const isLast = i === positions.length - 1;
              const rowBg = isPos
                ? "color-mix(in srgb, var(--success) 4%, transparent)"
                : "color-mix(in srgb, var(--danger) 4%, transparent)";

              return (
                <Fragment key={pos.key}>
                  <tr
                    onClick={() => setExpandedPos(isExpanded ? null : pos.key)}
                    style={{
                      borderBottom: !isExpanded && !isLast ? "1px solid var(--border-light)" : isExpanded ? "1px solid var(--border-light)" : "none",
                      cursor: "pointer",
                      background: isExpanded ? "var(--surface-2)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = rowBg; }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)", fontWeight: 600, color: "var(--text)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <ChevronRight size={13} style={{ color: "var(--text-3)", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
                        {pos.key}
                        {pos.name && pos.name.toUpperCase() !== pos.key && (
                          <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: "11px" }}>{pos.name}</span>
                        )}
                        {pos.count > 1 && (
                          <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "var(--surface-3)", color: "var(--text-3)" }}>{pos.count}</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)" }}><TypeBadge type={pos.type} /></td>
                    <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)" }}>
                      <span
                        onClick={(e) => { e.stopPropagation(); setSectorFilter(sectorFilter === pos.sector ? null : pos.sector); }}
                        style={{
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: sectorFilter === pos.sector ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
                          color: sectorFilter === pos.sector ? "var(--primary)" : "var(--text-3)",
                          transition: "all 0.12s",
                        }}
                        title="Filtrar por sector"
                      >
                        {pos.sector}
                      </span>
                    </td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>
                      {pos.ppp !== null ? <span style={{ color: "var(--text-2)" }}>${fNum(pos.ppp)}</span> : <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>
                      {pos.currentPriceArs !== null ? (
                        <span style={{ color: pos.currentPriceArs > (pos.ppp ?? pos.currentPriceArs) ? "var(--success)" : pos.currentPriceArs < (pos.ppp ?? pos.currentPriceArs) ? "var(--danger)" : "var(--text-2)" }}>
                          ${fNum(pos.currentPriceArs)}
                        </span>
                      ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>{sym}{fNum(invertido)}</td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 600 }}>{sym}{fNum(actual)}</td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                      {isPos ? "+" : ""}{sym}{fNum(ganancia)}
                    </td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                      {fPct(returnPct)}
                    </td>
                    <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                        <div style={{ width: "44px", height: "5px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(pos.weightPct, 100)}%`, background: pos.signals.some((s) => s.level === "danger") ? "var(--danger)" : pos.signals.some((s) => s.level === "warning") ? "var(--warning)" : INSTRUMENT_COLORS_HEX[pos.type], borderRadius: "3px" }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--text-3)", minWidth: "34px", textAlign: "right" }}>{pos.weightPct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)" }}>
                      <SignalBadges signals={pos.signals} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={11} style={{ padding: 0, borderBottom: !isLast ? "1px solid var(--border)" : "none" }}>
                        <div style={{ background: "var(--surface-3, var(--surface-2))", borderLeft: `3px solid ${INSTRUMENT_COLORS_HEX[pos.type]}`, padding: "12px 24px 16px 36px" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                            Detalle de operaciones — {pos.key}
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                {["Fecha", "Detalles", "Precio compra", "Precio actual", "Invertido", "Valor act.", "Ganancia", "% Gan."].map((header, index) => (
                                  <th key={header} style={{ ...INVESTMENTS_TH, padding: "4px 10px", background: "transparent", textAlign: index >= 2 ? "right" : "left" }}>{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pos.entries.slice().sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()).map((inv, entryIndex) => {
                                const c = calcRow(inv, currentCcl);
                                const dInv = isArs ? c.invertidoArs : c.invertidoUsd;
                                const dAct = isArs ? c.actualArs : c.actualUsd;
                                const dGan = isArs ? c.gananciaArs : c.gananciaUsd;
                                const dPct = dInv > 0 ? (dGan / dInv) * 100 : 0;
                                const dPos = dGan >= 0;
                                const entryPrice = inv.price_ars ?? 0;
                                const pppDiff = pos.ppp !== null && entryPrice > 0 ? ((entryPrice - pos.ppp) / pos.ppp) * 100 : null;

                                return (
                                  <tr key={inv.id} style={{ borderTop: entryIndex > 0 ? "1px solid var(--border-light)" : "none" }}>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", color: "var(--text-3)", fontSize: "11px" }}>{formatDate(inv.transaction_date)}</td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", color: "var(--text-3)", fontSize: "11px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{c.detalles || "—"}</td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>
                                      {entryPrice > 0 ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          ${fNum(entryPrice)}
                                          {pppDiff !== null && (
                                            <span style={{ fontSize: "9px", color: pppDiff > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                                              {pppDiff > 0 ? "▲" : "▼"}{Math.abs(pppDiff).toFixed(1)}%
                                            </span>
                                          )}
                                        </span>
                                      ) : "—"}
                                    </td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>
                                      {inv.current_price_ars ? `$${fNum(inv.current_price_ars)}` : <span style={{ color: "var(--text-3)" }}>—</span>}
                                    </td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>{sym}{fNum(dInv)}</td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px" }}>{sym}{fNum(dAct)}</td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px", color: dPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                      {dPos ? "+" : ""}{sym}{fNum(dGan)}
                                    </td>
                                    <td style={{ ...INVESTMENTS_TD, padding: "6px 10px", textAlign: "right", fontSize: "11px", color: dPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                      {fPct(dPct)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {pos.count > 1 && pos.ppp !== null && (
                              <tfoot>
                                <tr style={{ borderTop: "1px solid var(--border)" }}>
                                  <td colSpan={2} style={{ ...INVESTMENTS_TD, padding: "6px 10px", fontSize: "11px", color: "var(--text-3)" }}>PPP consolidado</td>
                                  <td colSpan={6} style={{ ...INVESTMENTS_TD, padding: "6px 10px", fontSize: "11px" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)", fontWeight: 700 }}>${fNum(pos.ppp)}</span>
                                    <span style={{ color: "var(--text-3)", marginLeft: 8 }}>· {fNum(pos.totalQty, pos.totalQty % 1 === 0 ? 0 : 2)} unidades</span>
                                    {pos.currentPriceArs && (
                                      <span style={{ marginLeft: 8, color: pos.currentPriceArs >= pos.ppp ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                                        · {pos.currentPriceArs >= pos.ppp ? "▲" : "▼"} {Math.abs(((pos.currentPriceArs - pos.ppp) / pos.ppp) * 100).toFixed(1)}% vs PPP
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-2)" }}>
              <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--text)" }} colSpan={2}>TOTAL</td>
              <td colSpan={3} style={{ ...INVESTMENTS_TD, color: "var(--text-3)", fontSize: "11px" }}>
                {positions.length} posición{positions.length !== 1 ? "es" : ""} · {investmentsCount} transacción{investmentsCount !== 1 ? "es" : ""}
              </td>
              <td style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 700 }}>{sym}{fNum(dispInv)}</td>
              <td style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 700 }}>{sym}{fNum(dispAct)}</td>
              <td style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 700, color: isGainPos ? "var(--success)" : "var(--danger)" }}>
                {isGainPos ? "+" : ""}{sym}{fNum(dispAct - dispInv)}
              </td>
              <td style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 700, color: isGainPos ? "var(--success)" : "var(--danger)" }}>
                {dispInv > 0 ? fPct(((dispAct - dispInv) / dispInv) * 100) : "—"}
              </td>
              <td colSpan={2} style={{ ...INVESTMENTS_TD, textAlign: "right", fontWeight: 700, color: "var(--text-3)", fontSize: "11px" }}>100%</td>
            </tr>
          </tbody>
        </table>
        {positions.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: "13px" }}>
            No hay posiciones para el filtro activo
          </div>
        )}
      </div>
    </Card>
  );
}
