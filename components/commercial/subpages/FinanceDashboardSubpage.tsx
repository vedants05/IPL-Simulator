"use client";

import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Filter,
  PieChart,
  FileText,
  IndianRupee,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CommercialState, LedgerTransaction } from "@/lib/logic/commercialSystem";

interface FinanceDashboardSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

export default function FinanceDashboardSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: FinanceDashboardSubpageProps) {
  const { finance, broadcast, sponsorships, ticketing, hospitality, merchandising, operatingCosts, matchdayOps, marketing, operations } = state;
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit">("all");

  // Dynamic Income Breakdown
  const totalGateAndSeasonCr = Number(
    (ticketing.seasonTickets.totalRevenueCr + ticketing.gateReceiptsSeasonTotalCr).toFixed(2)
  );

  const dynamicTotalIncomeCr = Number(
    (
      broadcast.totalBroadcastIncomeCr +
      sponsorships.totalAnnualSponsorshipCr +
      totalGateAndSeasonCr +
      hospitality.totalHospitalityRevenueCr +
      merchandising.totalMerchRevenueCr
    ).toFixed(2)
  );

  // Dynamic Expenditure Breakdown
  const operationsOtherCr = Number(
    (
      operatingCosts.coachingStaffSalariesCr +
      operatingCosts.travelAndHotelsCr +
      operatingCosts.administrativeCorporateCr +
      operatingCosts.stadiumAndTurfUpkeepCr
    ).toFixed(2)
  );

  const dynamicTotalExpenditureCr = Number(
    (
      operatingCosts.squadSalariesCr +
      operationsOtherCr +
      matchdayOps.seasonalOperationalSpendCr +
      merchandising.totalMerchCostCr +
      marketing.annualMarketingBudgetCr +
      operations.totalAnnualOperatingInvestmentCr
    ).toFixed(2)
  );

  const netOperatingProfitCr = Number((dynamicTotalIncomeCr - dynamicTotalExpenditureCr).toFixed(2));
  const profitMarginPercent = Number(
    ((netOperatingProfitCr / Math.max(1, dynamicTotalIncomeCr)) * 100).toFixed(1)
  );
  const projectedEndCashCr = Number(
    (finance.startingCashBalanceCr + netOperatingProfitCr).toFixed(2)
  );

  const filteredTransactions =
    filterType === "all"
      ? finance.transactions
      : finance.transactions.filter((t) => t.type === filterType);

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Cash Reserves
            </span>
            <Wallet className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{finance.currentCashBalanceCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Liquid franchise operating capital</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Projected Net Profit
            </span>
            {netOperatingProfitCr >= 0 ? (
              <TrendingUp className="size-4 text-emerald-400" />
            ) : (
              <TrendingDown className="size-4 text-rose-400" />
            )}
          </div>
          <p
            className={`mt-2 font-anton text-2xl uppercase tracking-wide ${
              netOperatingProfitCr >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {netOperatingProfitCr >= 0 ? "+" : ""}₹{netOperatingProfitCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">{profitMarginPercent}% Operating Margin</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Season Turnover (Revenue)
            </span>
            <ArrowUpRight className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            ₹{dynamicTotalIncomeCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Across 5 primary commercial streams</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Total Budget Outflow
            </span>
            <ArrowDownRight className="size-4 text-rose-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-rose-400">
            ₹{dynamicTotalExpenditureCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Projected End-Season Cash: ₹{projectedEndCashCr.toFixed(2)} Cr
          </p>
        </div>
      </div>

      {/* Income vs Expenditure Comprehensive Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="size-4 text-emerald-400" />
              <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
                Annual Commercial Inflows
              </h3>
            </div>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              ₹{dynamicTotalIncomeCr.toFixed(2)} Cr
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">BCCI Central Pool & TV Rights</p>
                <p className="text-[10px] text-text-secondary">Broadcaster revenue distribution & TRP bonuses</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{broadcast.totalBroadcastIncomeCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Corporate Sponsorships & Naming</p>
                <p className="text-[10px] text-text-secondary">Shirt, helmet, stadium naming & associate brands</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{sponsorships.totalAnnualSponsorshipCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Gate Receipts & Season Tickets</p>
                <p className="text-[10px] text-text-secondary">Public grandstand tickets & member packages</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{totalGateAndSeasonCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Corporate Boxes & VIP Hospitality</p>
                <p className="text-[10px] text-text-secondary">Luxury suites, lounge day passes & packages</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{hospitality.totalHospitalityRevenueCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Official Merchandising & Retail</p>
                <p className="text-[10px] text-text-secondary">Matchday megastore & global e-commerce</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{merchandising.totalMerchRevenueCr.toFixed(2)} Cr
              </span>
            </div>
          </div>
        </div>

        {/* Expenditure Breakdown */}
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="size-4 text-rose-400" />
              <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
                Annual Commercial Outflows
              </h3>
            </div>
            <span className="font-mono font-bold text-rose-400 text-sm">
              ₹{dynamicTotalExpenditureCr.toFixed(2)} Cr
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Squad Player Payroll & Contracts</p>
                <p className="text-[10px] text-text-secondary">IPL player auction purse & player compensations</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{operatingCosts.squadSalariesCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Coaching, Travel & Corporate Administration</p>
                <p className="text-[10px] text-text-secondary">Charter flights, 5-star team hotels & legal</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{operationsOtherCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Matchday Operations, Security & Pyro</p>
                <p className="text-[10px] text-text-secondary">Stadium stewards, catering royalty & entertainment</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{matchdayOps.seasonalOperationalSpendCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">Retail Merchandise Manufacturing</p>
                <p className="text-[10px] text-text-secondary">Kits & apparel manufacturing inventory cost</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{merchandising.totalMerchCostCr.toFixed(2)} Cr
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded bg-surface-secondary/40">
              <div>
                <p className="font-semibold text-text-primary">High-Performance & Marketing</p>
                <p className="text-[10px] text-text-secondary">Sports science, scouting programmes & brand campaigns</p>
              </div>
              <span className="font-mono font-bold text-text-primary">
                ₹{(marketing.annualMarketingBudgetCr + operations.totalAnnualOperatingInvestmentCr).toFixed(2)} Cr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Franchise Financial Ledger & Audit Trail
            </h3>
            <p className="text-xs text-text-secondary">
              Verified BCCI, partner, and operational ledger settlements for Season {state.season}.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                filterType === "all"
                  ? "bg-accent text-white"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("credit")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                filterType === "credit"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              Credits Only
            </button>
            <button
              onClick={() => setFilterType("debit")}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                filterType === "debit"
                  ? "bg-rose-500/20 text-rose-400"
                  : "bg-surface-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              Debits Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-secondary font-space-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Amount (₹ Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-surface-secondary/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-text-secondary whitespace-nowrap">{tx.date}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-surface-secondary border border-border text-text-primary capitalize">
                      {tx.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-primary">{tx.description}</td>
                  <td
                    className={`py-2.5 px-3 font-mono font-bold text-right whitespace-nowrap ${
                      tx.type === "credit" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}₹{tx.amountCr.toFixed(2)} Cr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
