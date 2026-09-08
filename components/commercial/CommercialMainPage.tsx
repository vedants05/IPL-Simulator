"use client";

import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  Ticket,
  Shield,
  Crown,
  Award,
  ShoppingBag,
  Megaphone,
  Building,
  Tv,
  DollarSign,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import {
  loadCommercialState,
  saveCommercialState,
  type CommercialState,
} from "@/lib/logic/commercialSystem";
import type { Player } from "@/lib/types";

// Import all 10 subpages
import TicketingSubpage from "./subpages/TicketingSubpage";
import MatchdayOpsSubpage from "./subpages/MatchdayOpsSubpage";
import HospitalitySubpage from "./subpages/HospitalitySubpage";
import SponsorshipsSubpage from "./subpages/SponsorshipsSubpage";
import MerchandisingSubpage from "./subpages/MerchandisingSubpage";
import MarketingSubpage from "./subpages/MarketingSubpage";
import FacilitiesSubpage from "./subpages/FacilitiesSubpage";
import BroadcastSubpage from "./subpages/BroadcastSubpage";
import OperatingCostsSubpage from "./subpages/OperatingCostsSubpage";
import FinanceDashboardSubpage from "./subpages/FinanceDashboardSubpage";

export interface CommercialMainPageProps {
  teamId: string;
  season: number;
  stadiumCapacity?: number;
  stadiumName?: string;
  squadPlayers?: Player[];
  activeSubTab?: string;
  onSelectSubTab?: (subtab: string) => void;
}

const EMPTY_SQUAD: Player[] = [];

function CommercialViewport({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const fit = () => {
      const availableWidth = viewport.clientWidth;
      const availableHeight = viewport.clientHeight;
      if (!availableWidth || !availableHeight) return;

      let low = 0.25;
      let high = 1;
      for (let pass = 0; pass < 10; pass += 1) {
        const candidate = (low + high) / 2;
        content.style.width = `${100 / candidate}%`;
        const fitsHeight = content.scrollHeight * candidate <= availableHeight;
        const fitsWidth = content.scrollWidth * candidate <= availableWidth + 1;
        if (fitsHeight && fitsWidth) low = candidate;
        else high = candidate;
      }

      const nextScale = Math.min(1, low);
      content.style.width = `${100 / nextScale}%`;
      content.style.transform = `scale(${nextScale})`;
    };

    const scheduleFit = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(viewport);
    scheduleFit();
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [pageKey]);

  return (
    <div ref={viewportRef} className="h-full min-h-0 w-full overflow-hidden">
      <div ref={contentRef} className="origin-top-left">{children}</div>
    </div>
  );
}

export default function CommercialMainPage({
  teamId,
  season,
  stadiumCapacity = 45000,
  stadiumName = "Home Stadium",
  squadPlayers,
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
    setCommercialState(nextState);
    saveCommercialState(nextState);
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
      commercialState.facilities.totalAnnualMaintenanceCr
    ).toFixed(2)
  );

  const netProfitCr = Number((totalInflowCr - totalOutflowCr).toFixed(2));
  const profitMargin = Number(((netProfitCr / Math.max(1, totalInflowCr)) * 100).toFixed(1));

  // Module Grid Card Config for Overview
  const commercialModules = [
    {
      id: "ticketing",
      title: "Ticketing & Attendance",
      icon: Ticket,
      kpi: `₹${(totalGateAndSeasonCr).toFixed(1)} Cr`,
      subtext: `${commercialState.ticketing.seasonTickets.soldCount.toLocaleString()} Season Members · 4 Tiers`,
      accent: "text-amber-400",
    },
    {
      id: "matchdayops",
      title: "Matchday Operations",
      icon: Shield,
      kpi: `₹${commercialState.matchdayOps.totalCostPerMatchCr.toFixed(2)} Cr / game`,
      subtext: `${commercialState.matchdayOps.safetyRating}% Safety Rating · ${commercialState.matchdayOps.catering.satisfactionRating}% F&B`,
      accent: "text-blue-400",
    },
    {
      id: "hospitality",
      title: "Hospitality Operations",
      icon: Crown,
      kpi: `₹${commercialState.hospitality.totalHospitalityRevenueCr.toFixed(1)} Cr`,
      subtext: `${commercialState.hospitality.boxes.filter(b => b.leasedSeasonally).length} Leased Boxes · ${commercialState.hospitality.vipRetentionRatePercent}% Retention`,
      accent: "text-amber-500",
    },
    {
      id: "sponsorships",
      title: "Sponsorships & Partners",
      icon: Award,
      kpi: `₹${commercialState.sponsorships.totalAnnualSponsorshipCr.toFixed(1)} Cr`,
      subtext: `${commercialState.sponsorships.deals.length} Active Deals · Kit, Venue & Associate`,
      accent: "text-emerald-400",
    },
    {
      id: "merchandising",
      title: "Merchandising & Retail",
      icon: ShoppingBag,
      kpi: `₹${commercialState.merchandising.grossMerchProfitCr.toFixed(1)} Cr Net`,
      subtext: `₹${commercialState.merchandising.totalMerchRevenueCr.toFixed(1)} Cr Sales · ${commercialState.merchandising.ecommerceSharePercent}% Online`,
      accent: "text-purple-400",
    },
    {
      id: "marketing",
      title: "Marketing & Campaigns",
      icon: Megaphone,
      kpi: `${commercialState.marketing.brandEquityScore} / 100`,
      subtext: `${commercialState.marketing.globalFollowersMillions.toFixed(1)}M Followers · ₹${commercialState.marketing.annualMarketingBudgetCr.toFixed(1)} Cr Budget`,
      accent: "text-rose-400",
    },
    {
      id: "facilities",
      title: "Upgradeable Facilities",
      icon: Building,
      kpi: "4 Departments",
      subtext: "Medical, Admin, Scouting, Commercial (No Training)",
      accent: "text-cyan-400",
    },
    {
      id: "broadcast",
      title: "Broadcast & Prize Income",
      icon: Tv,
      kpi: `₹${commercialState.broadcast.totalBroadcastIncomeCr.toFixed(1)} Cr`,
      subtext: `₹${commercialState.broadcast.centralPoolShareCr} Cr Central Pool · TRP & Prizes`,
      accent: "text-indigo-400",
    },
    {
      id: "operatingcosts",
      title: "Operating Costs",
      icon: DollarSign,
      kpi: `₹${commercialState.operatingCosts.totalOperatingCostsCr.toFixed(1)} Cr`,
      subtext: `₹${commercialState.operatingCosts.squadSalariesCr.toFixed(1)} Cr Squad Wages · Charters & Admin`,
      accent: "text-red-400",
    },
    {
      id: "finance",
      title: "Finance & Cash Ledger",
      icon: Wallet,
      kpi: `₹${commercialState.finance.currentCashBalanceCr.toFixed(1)} Cr Cash`,
      subtext: `${profitMargin}% Margin · Verified Audit Ledger`,
      accent: "text-teal-400",
    },
  ];

  return (
    <CommercialViewport pageKey={currentSubTab}>
      {/* 1. OVERVIEW SUBTAB */}
      {currentSubTab === "overview" && (
        <div className="grid h-full min-h-[560px] grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,2.28fr)]">
          <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-5">
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-space-mono text-[8px] font-bold uppercase tracking-[.18em] text-accent">Commercial HQ</span>
                <span className="rounded border border-accent/25 bg-accent/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">Season {season}</span>
              </div>
              <h2 className="mt-2 font-anton text-[26px] uppercase leading-none text-text-primary">Business Summary</h2>
              <p className="mt-2 text-[10px] leading-snug text-text-secondary">{stadiumName} · commercial and franchise operations</p>
            </div>

            <button type="button" onClick={() => onSelectSubTab?.("finance")} className="group mt-4 rounded-lg border border-accent/35 bg-accent/5 p-4 text-left transition-colors hover:bg-accent/10">
              <div className="flex items-center justify-between text-text-secondary"><span className="font-space-mono text-[8px] font-bold uppercase">Available cash</span><Wallet className="size-4 text-accent" /></div>
              <div className="mt-2 flex items-end justify-between gap-3"><span className="font-anton text-[28px] leading-none text-text-primary">₹{commercialState.finance.currentCashBalanceCr.toFixed(1)} Cr</span><ChevronRight className="size-4 text-accent transition-transform group-hover:translate-x-0.5" /></div>
            </button>

            <div className="mt-4 grid flex-1 grid-rows-3 gap-3">
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Projected profit</div><div className={`mt-1 font-anton text-xl leading-none ${netProfitCr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{netProfitCr >= 0 ? "+" : ""}₹{netProfitCr.toFixed(1)} Cr</div></div><TrendingUp className="size-5 text-emerald-400" /></div>
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Annual inflow</div><div className="mt-1 font-anton text-xl leading-none text-emerald-400">₹{totalInflowCr.toFixed(1)} Cr</div></div><ArrowUpRight className="size-5 text-emerald-400" /></div>
              <div className="flex items-center justify-between rounded border border-border bg-surface-secondary/35 p-3"><div><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Annual outflow</div><div className="mt-1 font-anton text-xl leading-none text-rose-400">₹{totalOutflowCr.toFixed(1)} Cr</div></div><ArrowDownRight className="size-5 text-rose-400" /></div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 font-space-mono text-[8px] font-bold uppercase text-text-secondary"><span>Operating margin</span><span className={profitMargin >= 0 ? "text-emerald-400" : "text-rose-400"}>{profitMargin}%</span></div>
          </section>

          <section className="grid min-h-0 grid-cols-2 grid-rows-5 gap-3 md:grid-cols-5 md:grid-rows-2">
            {commercialModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button type="button" key={mod.id} onClick={() => onSelectSubTab?.(mod.id)} className="group flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border-2 border-border bg-surface p-4 text-left transition-colors hover:border-accent">
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

      {/* 2. SUBPAGE ROUTING */}
      {currentSubTab === "ticketing" && (
        <TicketingSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "matchdayops" && (
        <MatchdayOpsSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "hospitality" && (
        <HospitalitySubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "sponsorships" && (
        <SponsorshipsSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "merchandising" && (
        <MerchandisingSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "marketing" && (
        <MarketingSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "facilities" && (
        <FacilitiesSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "broadcast" && (
        <BroadcastSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "operatingcosts" && (
        <OperatingCostsSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}

      {currentSubTab === "finance" && (
        <FinanceDashboardSubpage
          state={commercialState}
          stadiumCapacity={stadiumCapacity}
          stadiumName={stadiumName}
          onUpdateState={handleUpdateState}
        />
      )}
    </CommercialViewport>
  );
}
