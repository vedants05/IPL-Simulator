"use client";

import { useState } from "react";
import {
  Award,
  Briefcase,
  Shirt,
  Building2,
  TrendingUp,
  Percent,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Handshake,
} from "lucide-react";
import type { CommercialState, SponsorshipDeal } from "@/lib/logic/commercialSystem";

interface SponsorshipsSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const CATEGORY_LABELS: Record<SponsorshipDeal["category"], string> = {
  shirt_front: "Principal Shirt Front",
  shirt_back: "Major Shirt Back",
  chest_arm: "Chest / Sleeve Patch",
  helmet_cap: "Helmet & Cap Partner",
  stadium_naming: "Stadium Title Rights",
  stand_naming: "Pavilion / Stand Naming",
  secondary_partner: "Official Category Partner",
};

export default function SponsorshipsSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: SponsorshipsSubpageProps) {
  const { sponsorships } = state;
  const [selectedFilter, setSelectedFilter] = useState<"all" | "kit" | "venue" | "associate">("all");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const filterDeals = (deal: SponsorshipDeal) => {
    if (selectedFilter === "kit") {
      return ["shirt_front", "shirt_back", "chest_arm", "helmet_cap"].includes(deal.category);
    }
    if (selectedFilter === "venue") {
      return ["stadium_naming", "stand_naming"].includes(deal.category);
    }
    if (selectedFilter === "associate") {
      return deal.category === "secondary_partner";
    }
    return true;
  };

  const handleRenewDeal = (dealId: string) => {
    const nextDeals = sponsorships.deals.map((d) => {
      if (d.id === dealId) {
        return {
          ...d,
          yearsRemaining: d.yearsRemaining + 2,
          annualValueCr: Number((d.annualValueCr * 1.08).toFixed(2)),
          satisfactionPercent: Math.min(100, d.satisfactionPercent + 5),
        };
      }
      return d;
    });

    const nextAnnual = Number(nextDeals.reduce((sum, d) => sum + d.annualValueCr, 0).toFixed(2));

    const nextState: CommercialState = {
      ...state,
      sponsorships: {
        ...sponsorships,
        deals: nextDeals,
        totalAnnualSponsorshipCr: nextAnnual,
      },
    };
    onUpdateState(nextState);
  };

  const handleAdjustValue = (dealId: string, deltaCr: number) => {
    const nextDeals = sponsorships.deals.map((d) => {
      if (d.id === dealId) {
        const nextVal = Math.max(1.0, Number((d.annualValueCr + deltaCr).toFixed(2)));
        return { ...d, annualValueCr: nextVal };
      }
      return d;
    });

    const nextAnnual = Number(nextDeals.reduce((sum, d) => sum + d.annualValueCr, 0).toFixed(2));

    const nextState: CommercialState = {
      ...state,
      sponsorships: {
        ...sponsorships,
        deals: nextDeals,
        totalAnnualSponsorshipCr: nextAnnual,
      },
    };
    onUpdateState(nextState);
  };

  const totalBonusesAvailable = sponsorships.deals.reduce((sum, d) => sum + d.bonusAmountCr, 0);
  const avgPartnerSatisfaction = Math.round(
    sponsorships.deals.reduce((sum, d) => sum + d.satisfactionPercent, 0) / Math.max(1, sponsorships.deals.length)
  );

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Annual Sponsorship
            </span>
            <Award className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{sponsorships.totalAnnualSponsorshipCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Contracted annual receivables</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Active Partners
            </span>
            <Handshake className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            {sponsorships.deals.length} Brands
          </p>
          <p className="mt-1 text-xs text-text-secondary">Across kit, venue & associate categories</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Partner Satisfaction
            </span>
            <Percent className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {avgPartnerSatisfaction}%
          </p>
          <p className="mt-1 text-xs text-text-secondary">High renewal probability</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Performance Incentives
            </span>
            <Sparkles className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            +₹{totalBonusesAvailable.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Potential playoff & trophy bonuses</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setSelectedFilter("all")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedFilter === "all"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          All Commercial Agreements ({sponsorships.deals.length})
        </button>
        <button
          onClick={() => setSelectedFilter("kit")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedFilter === "kit"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Kit & Apparel (Shirt / Cap)
        </button>
        <button
          onClick={() => setSelectedFilter("venue")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedFilter === "venue"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Stadium & Stand Naming
        </button>
        <button
          onClick={() => setSelectedFilter("associate")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedFilter === "associate"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Associate Partners
        </button>
      </div>

      {/* Agreements Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sponsorships.deals.filter(filterDeals).map((deal) => (
          <div
            key={deal.id}
            className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between hover:border-accent/50 transition-all"
          >
            <div>
              {/* Category & Tag */}
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-secondary border border-border text-text-secondary">
                  {CATEGORY_LABELS[deal.category] || deal.category}
                </span>
                <span className="text-xs font-mono font-bold text-accent">
                  ₹{deal.annualValueCr.toFixed(2)} Cr / yr
                </span>
              </div>

              {/* Partner Name & Industry */}
              <div className="mt-3">
                <h4 className="font-anton text-base tracking-wide text-text-primary uppercase">
                  {deal.partnerName}
                </h4>
                <p className="text-xs text-text-secondary mt-0.5">{deal.industry}</p>
              </div>

              {/* Contract Term and Satisfaction */}
              <div className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Contract Term Remaining:</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {deal.yearsRemaining} {deal.yearsRemaining === 1 ? "Year (Expiring)" : "Years"}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Partner Satisfaction:</span>
                  <span
                    className={`font-mono font-semibold ${
                      deal.satisfactionPercent >= 85
                        ? "text-emerald-400"
                        : deal.satisfactionPercent >= 70
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {deal.satisfactionPercent}%
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Incentive Trigger:</span>
                  <span className="font-medium text-text-primary text-[11px] truncate max-w-[150px]">
                    {deal.bonusTrigger}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Bonus Payout:</span>
                  <span className="font-mono font-bold text-amber-400">
                    +₹{deal.bonusAmountCr.toFixed(2)} Cr
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAdjustValue(deal.id, -0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                  title="Reduce deal value"
                >
                  -
                </button>
                <button
                  onClick={() => handleAdjustValue(deal.id, 0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                  title="Increase deal value"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => handleRenewDeal(deal.id)}
                className="px-3 py-1 text-xs font-semibold rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors border border-accent/30"
              >
                Renew (+2 Yrs)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
