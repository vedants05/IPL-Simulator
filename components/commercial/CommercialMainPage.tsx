"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Ticket,
  Shield,
  Crown,
  Award,
  ShoppingBag,
  Megaphone,
  Building,
  Activity,
  Tv,
  DollarSign,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Heart,
  Users,
} from "lucide-react";
import {
  loadCommercialState,
  saveCommercialState,
  syncCommercialFinance,
  type CommercialState,
} from "@/lib/logic/commercialSystem";
import type { TeamSupporterView } from "@/lib/logic/supporters";
import type { Player } from "@/lib/types";

// Import all 10 subpages
import CommercialDecisionHub from "./CommercialDecisionHub";

export interface CommercialMainPageProps {
  teamId: string;
  season: number;
  stadiumCapacity?: number;
  stadiumName?: string;
  squadPlayers?: Player[];
  supporterView?: TeamSupporterView;
  onNavigateToSupporters?: () => void;
  activeSubTab?: string;
  onSelectSubTab?: (subtab: string) => void;
}

const EMPTY_SQUAD: Player[] = [];

function CommercialViewport({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  return (
    <div key={pageKey} className="h-[calc(100vh-200px)] min-h-[500px] w-full overflow-hidden bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent)_7%,transparent),transparent_36%)]">
      <div className="h-full min-h-0 w-full">{children}</div>
    </div>
  );
}

export default function CommercialMainPage({
  teamId,
  season,
  stadiumCapacity = 45000,
  stadiumName = "Home Stadium",
  squadPlayers,
  supporterView,
  onNavigateToSupporters,
  activeSubTab = "overview",
  onSelectSubTab,
}: CommercialMainPageProps) {
  const effectiveSquad = squadPlayers ?? EMPTY_SQUAD;
  const [commercialState, setCommercialState] = useState<CommercialState>(() =>
    loadCommercialState(teamId, season, stadiumCapacity, effectiveSquad)
  );

  // Sync state whenever teamId or season changes
  useEffect(() => {
    setCommercialState(loadCommercialState(teamId, season, stadiumCapacity, effectiveSquad));
  }, [teamId, season, stadiumCapacity, squadPlayers]);

  const handleUpdateState = (nextState: CommercialState) => {
    const synchronized = syncCommercialFinance(nextState);
    setCommercialState(synchronized);
    saveCommercialState(synchronized);
  };

  const currentSubTab = activeSubTab || "overview";

  // Calculate high-level turnover & profits for the overview summary
  const totalGateAndSeasonCr = Number(
    (commercialState.ticketing.seasonTickets.totalRevenueCr + commercialState.ticketing.gateReceiptsSeasonTotalCr).toFixed(2)
  );

  const totalInflowCr = Number(
    (
      commercialState.broadcast.totalBroadcastIncomeCr +
      commercialState.sponsorships.totalAnnualSponsorshipCr +
      totalGateAndSeasonCr +
      commercialState.hospitality.totalHospitalityRevenueCr +
      commercialState.merchandising.totalMerchRevenueCr
    ).toFixed(2)
  );

  const operationsOtherCr = Number(
    (
      commercialState.operatingCosts.coachingStaffSalariesCr +
      commercialState.operatingCosts.travelAndHotelsCr +
      commercialState.operatingCosts.administrativeCorporateCr +
      commercialState.operatingCosts.stadiumAndTurfUpkeepCr
    ).toFixed(2)
  );

  const totalOutflowCr = Number(
    (
      commercialState.operatingCosts.squadSalariesCr +
      operationsOtherCr +
      commercialState.matchdayOps.seasonalOperationalSpendCr +
      commercialState.merchandising.totalMerchCostCr +
      commercialState.marketing.annualMarketingBudgetCr +
      commercialState.operations.totalAnnualOperatingInvestmentCr
    ).toFixed(2)
  );

  const netProfitCr = Number((totalInflowCr - totalOutflowCr).toFixed(2));
  const profitMargin = Number(((netProfitCr / Math.max(1, totalInflowCr)) * 100).toFixed(1));

  // Module Grid Card Config for Overview
  const commercialModules = [
    {
      id: "matchday",
      title: "Matchday Revenue",
      icon: Ticket,
      kpi: `₹${(totalGateAndSeasonCr).toFixed(1)} Cr`,
      subtext: "Demand, pricing, hospitality and stadium experience",
      accent: "text-amber-400",
    },
    {
      id: "partnerships",
      title: "Partnership Office",
      icon: Award,
      kpi: `₹${commercialState.sponsorships.totalAnnualSponsorshipCr.toFixed(1)} Cr`,
      subtext: "Offers, leverage, bonuses and contract renewals",
      accent: "text-emerald-400",
    },
    {
      id: "retail",
      title: "Retail & Marketing",
      icon: ShoppingBag,
      kpi: `₹${commercialState.merchandising.grossMerchProfitCr.toFixed(1)} Cr Net`,
      subtext: "Elastic demand, inventory and campaign outcomes",
      accent: "text-purple-400",
    },
    {
      id: "operations",
      title: "Club Operations",
      icon: Activity,
      kpi: `₹${commercialState.operations.totalAnnualOperatingInvestmentCr.toFixed(1)} Cr`,
      subtext: "Medical, scouting, preparation and travel contracts",
      accent: "text-cyan-400",
    },
    {
      id: "finance",
      title: "Finance & Rights",
      icon: Wallet,
      kpi: `₹${commercialState.finance.currentCashBalanceCr.toFixed(1)} Cr Cash`,
      subtext: `${profitMargin}% margin · forecast, broadcast and audit ledger`,
      accent: "text-teal-400",
    },
  ];

  return (
    <CommercialViewport pageKey={currentSubTab}>
      {/* 1. OVERVIEW SUBTAB */}
      {currentSubTab === "overview" && (
        <div className="grid h-full min-h-0 grid-cols-[minmax(270px,.68fr)_minmax(0,2.32fr)] gap-3">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-space-mono text-[8px] font-bold uppercase tracking-[.18em] text-accent">Commercial HQ</span>
                <span className="rounded border border-accent/25 bg-accent/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">Season {season}</span>
              </div>
              <h2 className="mt-2 font-anton text-[26px] uppercase leading-none text-text-primary">Business Summary</h2>
              <p className="mt-2 text-[10px] leading-snug text-text-secondary">{stadiumName} · commercial and franchise operations</p>
            </div>

            <button type="button" onClick={() => onSelectSubTab?.("finance")} className="group mt-3 rounded-lg border border-accent/35 bg-accent/5 p-3 text-left transition-colors hover:bg-accent/10">
              <div className="flex items-center justify-between text-text-secondary"><span className="font-space-mono text-[8px] font-bold uppercase">Available cash</span><Wallet className="size-4 text-accent" /></div>
              <div className="mt-2 flex items-end justify-between gap-3"><span className="font-anton text-[28px] leading-none text-text-primary">₹{commercialState.finance.currentCashBalanceCr.toFixed(1)} Cr</span><ChevronRight className="size-4 text-accent transition-transform group-hover:translate-x-0.5" /></div>
            </button>

            <div className="mt-3 grid min-h-0 flex-1 grid-rows-3 gap-2">
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Projected profit</div><div className={`mt-1 font-anton text-xl leading-none ${netProfitCr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{netProfitCr >= 0 ? "+" : ""}₹{netProfitCr.toFixed(1)} Cr</div></div><TrendingUp className="size-5 text-emerald-400" /></div>
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Annual inflow</div><div className="mt-1 font-anton text-xl leading-none text-emerald-400">₹{totalInflowCr.toFixed(1)} Cr</div></div><ArrowUpRight className="size-5 text-emerald-400" /></div>
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Annual outflow</div><div className="mt-1 font-anton text-xl leading-none text-rose-400">₹{totalOutflowCr.toFixed(1)} Cr</div></div><ArrowDownRight className="size-5 text-rose-400" /></div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary"><span>Operating margin</span><span className={profitMargin >= 0 ? "text-emerald-400" : "text-rose-400"}>{profitMargin}%</span></div>

            {supporterView && (
              <div className="mt-2 rounded-lg border border-border/70 bg-surface-secondary/35 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Heart className="size-3.5 fill-rose-400/20 text-rose-400" />
                    <span className="font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary">Fanbase Commercial Synergy</span>
                  </div>
                  {onNavigateToSupporters && (
                    <button
                      type="button"
                      onClick={onNavigateToSupporters}
                      className="flex items-center gap-0.5 font-space-mono text-[7px] font-bold uppercase text-accent hover:underline"
                    >
                      Supporters <ChevronRight className="size-2.5" />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-left">
                  <div className="rounded border border-border/50 bg-surface/60 p-2">
                    <div className="font-space-mono text-[7px] uppercase text-text-secondary">Mood & Approval</div>
                    <div className="text-[11px] font-bold text-text-primary capitalize">{supporterView.mood} ({supporterView.overallHappiness}%)</div>
                  </div>
                  <div className="rounded border border-border/50 bg-surface/60 p-2">
                    <div className="font-space-mono text-[7px] uppercase text-text-secondary">Gate Demand Pull</div>
                    <div className={`text-[11px] font-bold ${supporterView.overallHappiness >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
                      {supporterView.overallHappiness >= 50 ? "+" : ""}{((supporterView.overallHappiness - 50) * 0.4).toFixed(1)}%
                    </div>
                  </div>
                </div>
                {supporterView.popularPlayers && supporterView.popularPlayers.length > 0 && (
                  <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5 text-[8px] text-text-secondary">
                    <span>Key Crowd Magnet:</span>
                    <span className="max-w-[130px] truncate font-bold text-text-primary">
                      {supporterView.popularPlayers[0].name} ({supporterView.popularPlayers[0].approval}%)
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="grid min-h-0 grid-cols-6 grid-rows-2 gap-3">
            {commercialModules.map((mod, index) => {
              const Icon = mod.icon;
              return (
                <button type="button" key={mod.id} onClick={() => onSelectSubTab?.(mod.id)} className={`group flex min-h-0 flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${index < 3 ? "col-span-2" : "col-span-3"}`}>
                  <div>
                    <div className="flex items-center justify-between"><span className="rounded bg-surface-secondary/70 p-2"><Icon className={`size-5 ${mod.accent}`} /></span><ChevronRight className="size-4 text-text-secondary transition-all group-hover:translate-x-0.5 group-hover:text-accent" /></div>
                    <h3 className="mt-3 text-[11px] font-bold leading-tight text-text-primary group-hover:text-accent">{mod.title}</h3>
                    <div className="mt-1 font-space-mono text-[12px] font-bold leading-tight text-text-primary">{mod.kpi}</div>
                  </div>
                  <p className="mt-2 border-t border-border/60 pt-2 text-[9px] leading-snug text-text-secondary">{mod.subtext}</p>
                </button>
              );
            })}
          </section>
        </div>
      )}

      {currentSubTab !== "overview" && (
        <CommercialDecisionHub
          page={({ ticketing: "matchday", matchdayops: "matchday", hospitality: "matchday", sponsorships: "partnerships", merchandising: "retail", marketing: "retail", facilities: "operations", broadcast: "finance", operatingcosts: "finance" } as Record<string, "matchday" | "partnerships" | "retail" | "operations" | "finance">)[currentSubTab] ?? currentSubTab as "matchday" | "partnerships" | "retail" | "operations" | "finance"}
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          supporterView={supporterView}
          onNavigateToSupporters={onNavigateToSupporters}
          onUpdateState={handleUpdateState}
        />
      )}
    </CommercialViewport>
  );
}
