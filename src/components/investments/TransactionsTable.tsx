import { Trash2 } from "lucide-react";
import type { InvestmentEntry } from "@/types";
import { formatDate } from "@/lib/utils";
import { calcRow } from "@/lib/investmentCalcs";
import {
  effectiveType,
  fNum,
  fPct,
  INVESTMENTS_TD,
  INVESTMENTS_TH,
  SortTH,
  TypeBadge,
  type Currency,
  type SortDir,
  type SortKey,
} from "@/components/investments/investmentHelpers";
import { Card } from "@/components/ui/Card";

type TransactionsTableProps = {
  transactions: InvestmentEntry[];
  currency: Currency;
  sym: string;
  sortCol: SortKey | null;
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
  currentCcl: number | null;
  editingPrice: { id: string; value: string } | null;
  setEditingPrice: (value: { id: string; value: string } | null) => void;
  savePrice: (investment: InvestmentEntry) => void;
  setDeleteId: (id: string) => void;
};

export function TransactionsTable({
  transactions,
  currency,
  sym,
  sortCol,
  sortDir,
  onSort,
  currentCcl,
  editingPrice,
  setEditingPrice,
  savePrice,
  setDeleteId,
}: TransactionsTableProps) {
  return (
    <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <SortTH label="Fecha" col="fecha" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTH label="Tipo" col="tipo" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTH label="Instrumento" col="nombre" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <th style={INVESTMENTS_TH}>Detalles</th>
              <SortTH label={`Invertido ${currency}`} col="invertido" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label={`Valor Act. ${currency}`} col="actual" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label={`Gan. ${currency}`} col="ganancia" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <SortTH label="% Gan." col="pct" sortCol={sortCol} sortDir={sortDir} onSort={onSort} right />
              <th style={{ ...INVESTMENTS_TH, width: "36px" }} />
            </tr>
          </thead>
          <tbody>
            {transactions.map((investment, index) => {
              const c = calcRow(investment, currentCcl);
              const isArs = currency === "ARS";
              const invested = isArs ? c.invertidoArs : c.invertidoUsd;
              const actual = isArs ? c.actualArs : c.actualUsd;
              const gain = isArs ? c.gananciaArs : c.gananciaUsd;
              const pct = isArs ? c.gananciaPctArs : c.gananciaPctUsd;
              const isPos = gain >= 0;
              const type = effectiveType(investment.ticker, investment.instrument_type);

              return (
                <tr
                  key={investment.id}
                  style={{ borderBottom: index !== transactions.length - 1 ? "1px solid var(--border-light)" : "none", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...INVESTMENTS_TD, color: "var(--text-3)" }}>{formatDate(investment.transaction_date)}</td>
                  <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)" }}><TypeBadge type={type} /></td>
                  <td style={{ ...INVESTMENTS_TD, fontFamily: "var(--font-ui)", fontWeight: 600, color: "var(--text)" }}>
                    {investment.ticker ?? investment.name}
                    {investment.ticker && investment.name && investment.name !== investment.ticker && (
                      <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: "11px", marginLeft: 4 }}>{investment.name}</span>
                    )}
                  </td>
                  <td style={{ ...INVESTMENTS_TD, color: "var(--text-3)", fontSize: "11px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>{c.detalles}</td>
                  <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>{sym}{fNum(invested)}</td>
                  <td
                    style={{ ...INVESTMENTS_TD, textAlign: "right", cursor: type !== "plazo_fijo" ? "pointer" : "default" }}
                    title={type !== "plazo_fijo" ? "Click para editar precio actual" : undefined}
                    onClick={() => type !== "plazo_fijo" && setEditingPrice({ id: investment.id, value: investment.current_price_ars?.toString() ?? "" })}
                  >
                    {editingPrice?.id === investment.id ? (
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice({ id: investment.id, value: e.target.value })}
                        onBlur={() => savePrice(investment)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePrice(investment);
                          if (e.key === "Escape") setEditingPrice(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "90px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "4px", padding: "2px 6px", color: "var(--text)", outline: "none" }}
                      />
                    ) : (
                      <span style={type !== "plazo_fijo" ? { borderBottom: "1px dashed var(--border)" } : {}}>
                        {sym}{fNum(actual)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...INVESTMENTS_TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                    {isPos ? "+" : ""}{sym}{fNum(gain)}
                  </td>
                  <td style={{ ...INVESTMENTS_TD, textAlign: "right", color: isPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                    {fPct(pct)}
                  </td>
                  <td style={{ ...INVESTMENTS_TD, textAlign: "right" }}>
                    <button
                      onClick={() => setDeleteId(investment.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: "13px" }}>
            No hay transacciones para el filtro activo
          </div>
        )}
      </div>
    </Card>
  );
}
