import {
  buildPositions,
  sortPositions,
  sortTransactions,
  type Currency,
  type EnhancedPosition,
  type SortDir,
  type SortKey,
} from "@/components/investments/investmentHelpers";
import {
  calcCAGR,
  calcRow,
  calcXIRR,
  generateSmartInsights,
  type CashFlow,
  type SmartInsight,
} from "@/lib/investmentCalcs";
import type {
  CashOverview,
  DashboardSummary,
  FinancialAccount,
  InvestmentEntry,
} from "@/types";

type PortfolioTotals = {
  invertidoArs: number;
  actualArs: number;
  invertidoUsd: number;
  actualUsd: number;
};

type RealizedGains = {
  ars: number;
  usd: number;
};

export type InvestmentsViewModelInput = {
  investments: InvestmentEntry[];
  accounts: FinancialAccount[];
  cashOverview?: CashOverview;
  dashSummary?: DashboardSummary;
  currentCcl?: number | null;
  currency: Currency;
  filterText: string;
  sectorFilter: string | null;
  sortCol: SortKey | null;
  sortDir: SortDir;
};

export type InvestmentsViewModel = {
  positions: EnhancedPosition[];
  totals: PortfolioTotals;
  realizedGains: RealizedGains;
  cagr: number;
  xirr: number | null;
  insights: SmartInsight[];
  chartData: Array<{ date: string; invested: number; portfolio: number }>;
  filteredPositions: EnhancedPosition[];
  filteredTransactions: InvestmentEntry[];
  dispInv: number;
  dispAct: number;
  sym: string;
  portfolioReturnPctUsd?: number;
  accountOptions: Array<{ value: string; label: string }>;
};

function buildPortfolioTotals(positions: EnhancedPosition[]): PortfolioTotals {
  return positions.reduce<PortfolioTotals>((acc, position) => ({
    invertidoArs: acc.invertidoArs + position.invertidoArs,
    actualArs: acc.actualArs + position.actualArs,
    invertidoUsd: acc.invertidoUsd + position.invertidoUsd,
    actualUsd: acc.actualUsd + position.actualUsd,
  }), { invertidoArs: 0, actualArs: 0, invertidoUsd: 0, actualUsd: 0 });
}

function buildRealizedGains(investments: InvestmentEntry[], currentCcl?: number | null): RealizedGains {
  return investments.reduce<RealizedGains>((acc, investment) => {
    if (investment.transaction_kind !== "sell") return acc;
    const row = calcRow(investment, currentCcl);
    return {
      ars: acc.ars + row.gananciaArs,
      usd: acc.usd + row.gananciaUsd,
    };
  }, { ars: 0, usd: 0 });
}

function buildReturns(
  investments: InvestmentEntry[],
  totals: PortfolioTotals,
  currentCcl?: number | null,
) {
  if (investments.length === 0) {
    return { cagr: 0, xirr: null };
  }

  const sortedBuys = [...investments]
    .filter((investment) => investment.transaction_kind === "buy")
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  if (sortedBuys.length === 0) {
    return { cagr: 0, xirr: null };
  }

  const cashFlows: CashFlow[] = investments.map((investment) => {
    const row = calcRow(investment, currentCcl);
    return {
      date: new Date(investment.transaction_date),
      amount: investment.transaction_kind === "sell" ? row.actualArs : -row.invertidoArs,
    };
  });

  cashFlows.push({ date: new Date(), amount: totals.actualArs });
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    cagr: calcCAGR(totals.invertidoArs, totals.actualArs, new Date(sortedBuys[0].transaction_date)),
    xirr: calcXIRR(cashFlows),
  };
}

function buildChartData(
  investments: InvestmentEntry[],
  currency: Currency,
  currentCcl: number | null | undefined,
  totals: PortfolioTotals,
) {
  if (investments.length === 0) return [];

  const sorted = [...investments].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  const groups = new Map<string, InvestmentEntry[]>();

  for (const investment of sorted) {
    const date = investment.transaction_date.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)?.push(investment);
  }

  let cumulative = 0;
  const points: Array<{ date: string; invested: number; portfolio: number }> = [];
  const isArs = currency === "ARS";

  for (const [date, group] of groups) {
    for (const investment of group) {
      const row = calcRow(investment, currentCcl);
      cumulative += investment.transaction_kind === "sell"
        ? -(isArs ? row.actualArs : row.actualUsd)
        : (isArs ? row.invertidoArs : row.invertidoUsd);
    }
    points.push({ date, invested: cumulative, portfolio: cumulative });
  }

  if (points.length > 0) {
    points[points.length - 1].portfolio = isArs ? totals.actualArs : totals.actualUsd;
  }

  return points;
}

export function applyPriceUpdatesToInvestments(
  investments: InvestmentEntry[],
  updates: Array<{ ticker: string; price_ars: number }>,
  currentCcl?: number | null,
) {
  const priceByTicker = new Map(
    updates.map((update) => [update.ticker.trim().toUpperCase(), update.price_ars]),
  );

  return investments.map((investment) => {
    const key = (investment.ticker ?? investment.name).trim().toUpperCase();
    const nextPrice = priceByTicker.get(key);
    if (nextPrice == null || investment.transaction_kind !== "buy") {
      return investment;
    }

    const fx = currentCcl && currentCcl > 0 ? currentCcl : investment.dolar_ccl;
    const nextValue = investment.quantity != null && fx && fx > 0
      ? (nextPrice * investment.quantity) / fx
      : investment.current_value;

    return {
      ...investment,
      current_price_ars: nextPrice,
      current_value: nextValue,
    };
  });
}

export function buildInvestmentsViewModel(input: InvestmentsViewModelInput): InvestmentsViewModel {
  const {
    investments,
    accounts,
    dashSummary,
    currentCcl,
    currency,
    filterText,
    sectorFilter,
    sortCol,
    sortDir,
  } = input;

  const positions = buildPositions(investments, currentCcl);
  const totals = buildPortfolioTotals(positions);
  const realizedGains = buildRealizedGains(investments, currentCcl);
  const { cagr, xirr } = buildReturns(investments, totals, currentCcl);

  const insights = generateSmartInsights(
    positions.map((position) => ({
      key: position.key,
      type: position.type,
      sector: position.sector,
      currentValue: position.actualArs,
      totalInvested: position.invertidoArs,
      returnPct: position.invertidoArs > 0 ? position.gananciaArs / position.invertidoArs : 0,
      count: position.count,
      ppp: position.ppp,
      maturityDate: position.maturityDate,
    })),
    totals.actualArs,
    dashSummary?.balance ?? 0,
  );

  const chartData = buildChartData(investments, currency, currentCcl, totals);

  let filteredPositions = positions;
  if (filterText) {
    const query = filterText.toLowerCase();
    filteredPositions = filteredPositions.filter((position) =>
      position.key.toLowerCase().includes(query) || position.name.toLowerCase().includes(query),
    );
  }
  if (sectorFilter) {
    filteredPositions = filteredPositions.filter((position) => position.sector === sectorFilter);
  }
  filteredPositions = sortPositions(filteredPositions, sortCol, sortDir, currency);

  let filteredTransactions = investments;
  if (filterText) {
    const query = filterText.toLowerCase();
    filteredTransactions = filteredTransactions.filter((investment) =>
      (investment.ticker ?? "").toLowerCase().includes(query) || investment.name.toLowerCase().includes(query),
    );
  }
  filteredTransactions = sortTransactions(filteredTransactions, sortCol, sortDir, currency, currentCcl);

  const dispInv = currency === "ARS" ? totals.invertidoArs : totals.invertidoUsd;
  const dispAct = currency === "ARS" ? totals.actualArs : totals.actualUsd;
  const portfolioReturnPctUsd = currentCcl && totals.invertidoUsd > 0
    ? ((totals.actualUsd - totals.invertidoUsd) / totals.invertidoUsd) * 100
    : undefined;

  return {
    positions,
    totals,
    realizedGains,
    cagr,
    xirr,
    insights,
    chartData,
    filteredPositions,
    filteredTransactions,
    dispInv,
    dispAct,
    sym: currency === "ARS" ? "$" : "USD ",
    portfolioReturnPctUsd,
    accountOptions: accounts.map((account) => ({
      value: account.id,
      label: `${account.name}${account.institution ? ` · ${account.institution}` : ""} · ${account.currency_code}`,
    })),
  };
}
