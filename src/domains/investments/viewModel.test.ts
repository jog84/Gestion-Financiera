import { describe, expect, it } from "vitest";
import { applyPriceUpdatesToInvestments, buildInvestmentsViewModel } from "@/domains/investments/viewModel";
import type { FinancialAccount, InvestmentEntry } from "@/types";

const baseAccount: FinancialAccount = {
  id: "acc-1",
  profile_id: "default",
  name: "Broker",
  institution: "Test",
  account_type: "broker",
  currency_code: "ARS",
  current_balance: 0,
  is_liquid: true,
  include_in_net_worth: true,
  notes: null,
};

function makeInvestment(overrides: Partial<InvestmentEntry>): InvestmentEntry {
  return {
    id: "inv-1",
    profile_id: "default",
    period_id: "2026-03",
    name: "AAPL",
    ticker: "AAPL",
    transaction_kind: "buy",
    account_id: "acc-1",
    account_name: "Broker",
    amount_invested: 10,
    current_value: 12,
    cash_amount_ars: 10_000,
    realized_cost_ars: null,
    realized_gain_ars: null,
    transaction_date: "2026-03-01",
    notes: null,
    quantity: 10,
    price_ars: 1_000,
    dolar_ccl: 1_000,
    current_price_ars: 1_200,
    instrument_type: "cedear",
    tna: null,
    plazo_dias: null,
    fecha_vencimiento: null,
    sector: null,
    ...overrides,
  };
}

describe("investments view model", () => {
  it("builds consolidated positions and realized gains from buy/sell flows", () => {
    const investments = [
      makeInvestment({ id: "buy-1" }),
      makeInvestment({
        id: "sell-1",
        transaction_kind: "sell",
        quantity: 4,
        cash_amount_ars: 5_200,
        current_value: 5.2,
        realized_cost_ars: 4_000,
        realized_gain_ars: 1_200,
        transaction_date: "2026-03-10",
      }),
    ];

    const vm = buildInvestmentsViewModel({
      investments,
      accounts: [baseAccount],
      dashSummary: { total_income: 0, total_expenses: 0, balance: 50_000, month: 3, year: 2026 },
      currentCcl: 1_000,
      currency: "ARS",
      filterText: "",
      sectorFilter: null,
      sortCol: "actual",
      sortDir: "desc",
    });

    expect(vm.positions).toHaveLength(1);
    expect(vm.positions[0].totalQty).toBe(6);
    expect(vm.positions[0].invertidoArs).toBe(6_000);
    expect(vm.positions[0].actualArs).toBe(7_200);
    expect(vm.realizedGains.ars).toBe(1_200);
    expect(vm.portfolioReturnPctUsd).toBeCloseTo(20, 5);
    expect(vm.accountOptions).toEqual([
      { value: "acc-1", label: "Broker · Test · ARS" },
    ]);
  });

  it("updates only matching buy rows when fresh prices arrive", () => {
    const buy = makeInvestment({ id: "buy-1", quantity: 2, current_price_ars: 1_000, current_value: 2 });
    const sell = makeInvestment({ id: "sell-1", transaction_kind: "sell", quantity: 1, current_price_ars: 900, current_value: 0.9 });
    const other = makeInvestment({ id: "buy-2", ticker: "GGAL", name: "GGAL", quantity: 3, current_price_ars: 800, current_value: 2.4 });

    const updated = applyPriceUpdatesToInvestments([buy, sell, other], [
      { ticker: "AAPL", price_ars: 1_300 },
    ], 1_200);

    expect(updated[0].current_price_ars).toBe(1_300);
    expect(updated[0].current_value).toBeCloseTo((1_300 * 2) / 1_200, 5);
    expect(updated[1].current_price_ars).toBe(900);
    expect(updated[2].current_price_ars).toBe(800);
  });
});
