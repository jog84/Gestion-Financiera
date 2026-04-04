import { describe, expect, it } from "vitest";
import { calcRow, calcXIRR } from "@/lib/investmentCalcs";
import type { InvestmentEntry } from "@/types";

function makeSellEntry(overrides: Partial<InvestmentEntry> = {}): InvestmentEntry {
  return {
    id: "sell-1",
    profile_id: "default",
    period_id: "2026-03",
    name: "AAPL",
    ticker: "AAPL",
    transaction_kind: "sell",
    account_id: "acc-1",
    account_name: "Broker",
    amount_invested: 4,
    current_value: 5.2,
    cash_amount_ars: 5_200,
    realized_cost_ars: 4_000,
    realized_gain_ars: 1_200,
    transaction_date: "2026-03-10",
    notes: null,
    quantity: 4,
    price_ars: 1_300,
    dolar_ccl: 1_000,
    current_price_ars: 1_300,
    instrument_type: "cedear",
    tna: null,
    plazo_dias: null,
    fecha_vencimiento: null,
    sector: null,
    ...overrides,
  };
}

describe("investmentCalcs", () => {
  it("uses realized values for sell transactions", () => {
    const row = calcRow(makeSellEntry(), 1_000);

    expect(row.invertidoArs).toBe(4_000);
    expect(row.actualArs).toBe(5_200);
    expect(row.gananciaArs).toBe(1_200);
    expect(row.gananciaPctArs).toBe(30);
    expect(row.detalles).toContain("vendidas");
  });

  it("returns null XIRR when cash flows do not contain both signs", () => {
    const result = calcXIRR([
      { date: new Date("2026-01-01"), amount: -1000 },
      { date: new Date("2026-02-01"), amount: -500 },
    ]);

    expect(result).toBeNull();
  });
});
