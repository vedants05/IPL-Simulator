"use client";

import { useState } from "react";
import {
  HeartPulse,
  Binoculars,
  Flame,
  Plane,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Building2,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import type {
  CommercialState,
  OperationCategory,
  ClubOperationProgramme,
  OperationTierOption,
} from "@/lib/logic/commercialSystem";

interface OperationsSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const PROGRAMME_ICONS: Record<OperationCategory, any> = {
  sports_science: HeartPulse,
  scouting_network: Binoculars,
  prep_camps: Flame,
  logistics_travel: Plane,
};

const PROGRAMME_THEMES: Record<
  OperationCategory,
  { iconColor: string; bgBadge: string; textBadge: string; borderAccent: string }
> = {
  sports_science: {
    iconColor: "text-rose-400",
    bgBadge: "bg-rose-500/10",
    textBadge: "text-rose-400",
    borderAccent: "border-rose-500/30",
  },
  scouting_network: {
    iconColor: "text-amber-400",
    bgBadge: "bg-amber-500/10",
    textBadge: "text-amber-400",
    borderAccent: "border-amber-500/30",
  },
  prep_camps: {
    iconColor: "text-emerald-400",
    bgBadge: "bg-emerald-500/10",
    textBadge: "text-emerald-400",
    borderAccent: "border-emerald-500/30",
  },
  logistics_travel: {
    iconColor: "text-blue-400",
    bgBadge: "bg-blue-500/10",
    textBadge: "text-blue-400",
    borderAccent: "border-blue-500/30",
  },
};

export default function FacilitiesSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: OperationsSubpageProps) {
  const operations = state.operations;
  const [selectedCategory, setSelectedCategory] = useState<OperationCategory>("sports_science");

  const currentProg = operations.programmes[selectedCategory];
  const activeTier = currentProg.tierOptions.find((t) => t.id === currentProg.activeTierId) ?? currentProg.tierOptions[0];

  const handleSelectTier = (category: OperationCategory, tierId: string) => {
    const prog = operations.programmes[category];
    if (prog.activeTierId === tierId) return;

    const targetTier = prog.tierOptions.find((t) => t.id === tierId);
    if (!targetTier) return;

    const updatedProgrammes = {
      ...operations.programmes,
      [category]: {
        ...prog,
        activeTierId: tierId,
      },
    };

    const nextTotalInvestment = Number(
      Object.values(updatedProgrammes).reduce((sum, p) => {
        const selected = p.tierOptions.find((t) => t.id === p.activeTierId);
        return sum + (selected?.annualCostCr ?? 1.0);
      }, 0).toFixed(2)
    );

    // Ledger entry if there is a setup / retainer change
    const delta = Number((targetTier.setupCostCr).toFixed(2));
    const newTransactions = [...state.finance.transactions];
    if (delta > 0) {
      newTransactions.unshift({
        id: `tx-op-${Date.now()}`,
        date: `${state.season}-03-01`,
        type: "debit",
        category: "operations",
        description: `${targetTier.providerOrPartner} - Operational Setup & Retainer`,
        amountCr: delta,
      });
    }

    const nextState: CommercialState = {
      ...state,
      operations: {
        programmes: updatedProgrammes,
        totalAnnualOperatingInvestmentCr: nextTotalInvestment,
      },
      finance: {
        ...state.finance,
        transactions: newTransactions,
      },
    };

    onUpdateState(nextState);
  };

  const totalAnnualBudget = operations.totalAnnualOperatingInvestmentCr;
  const premierTiersCount = Object.values(operations.programmes).filter((p) => {
    const idx = p.tierOptions.findIndex((t) => t.id === p.activeTierId);
    return idx === p.tierOptions.length - 1;
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Total Operations Budget
            </span>
            <DollarSign className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{totalAnnualBudget.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Contracted annual departmental budget</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Elite Programmes Active
            </span>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            {premierTiersCount} of 4 Sectors
          </p>
          <p className="mt-1 text-xs text-text-secondary">Pinnacle global standards operational</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Franchise Base Ground
            </span>
            <Building2 className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-blue-400 truncate">
            {stadiumName}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Capacity: {stadiumCapacity.toLocaleString()} seats</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Franchise Philosophy
            </span>
            <ShieldCheck className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            Professional Ops
          </p>
          <p className="mt-1 text-xs text-text-secondary">Realistic service agreements & partnerships</p>
        </div>
      </div>

      {/* Programme Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(operations.programmes) as OperationCategory[]).map((cat) => {
          const prog = operations.programmes[cat];
          const Icon = PROGRAMME_ICONS[cat];
          const theme = PROGRAMME_THEMES[cat];
          const isSelected = selectedCategory === cat;
          const currentActive = prog.tierOptions.find((t) => t.id === prog.activeTierId) ?? prog.tierOptions[0];

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`size-5 ${theme.iconColor}`} />
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${theme.bgBadge} ${theme.textBadge}`}>
                  ₹{currentActive.annualCostCr.toFixed(1)} Cr/yr
                </span>
              </div>
              <h4 className="mt-2 text-xs font-bold text-text-primary leading-snug">{prog.name}</h4>
              <p className="mt-1 text-[11px] text-text-secondary truncate font-medium">
                {currentActive.name}
              </p>
              <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-text-secondary">
                <span>Partner:</span>
                <span className="font-bold text-text-primary truncate max-w-[130px]">
                  {currentActive.providerOrPartner}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed Tier Selection for Active Programme */}
      <div className="rounded-lg border border-border bg-surface p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
                Department Programme
              </span>
              <span className="text-xs text-text-secondary font-mono">
                Active Tier: {activeTier.name}
              </span>
            </div>
            <h3 className="mt-1 font-anton text-2xl uppercase tracking-wide text-text-primary">
              {currentProg.name}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Select your franchise operational partner and service agreement level. Higher tiers require financial commitment and brand reputation.
            </p>
          </div>
        </div>

        {/* Tiers Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentProg.tierOptions.map((tier) => {
            const isActive = tier.id === currentProg.activeTierId;
            const meetsReputation = state.marketing.brandEquityScore >= tier.reputationRequired;

            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                  isActive
                    ? "border-accent bg-accent/5 ring-2 ring-accent shadow-md"
                    : "border-border bg-surface-secondary/20 hover:border-border-hover"
                }`}
              >
                <div>
                  {/* Header & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
                      {tier.providerOrPartner}
                    </span>
                    {isActive && (
                      <span className="font-space-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-accent text-white flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Contracted
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 font-anton text-lg uppercase tracking-wide text-text-primary">
                    {tier.name}
                  </h4>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-xl font-bold text-text-primary">
                      ₹{tier.annualCostCr.toFixed(1)} Cr
                    </span>
                    <span className="text-[11px] text-text-secondary">/ year</span>
                    {tier.setupCostCr > 0 && (
                      <span className="text-[10px] text-text-secondary font-mono ml-auto">
                        +₹{tier.setupCostCr.toFixed(1)} Cr setup
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-text-secondary leading-relaxed font-medium">
                    {tier.impactSummary}
                  </p>

                  {/* Benefits Checklist */}
                  <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
                    <span className="text-[10px] font-mono uppercase font-bold text-text-secondary block">
                      Contract Deliverables:
                    </span>
                    {tier.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-text-primary">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contract Selection Action */}
                <div className="mt-5 pt-4 border-t border-border">
                  {isActive ? (
                    <div className="w-full py-2 text-center text-xs font-semibold text-accent font-mono bg-accent/10 rounded-lg">
                      Active Operational Contract
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectTier(selectedCategory, tier.id)}
                      disabled={!meetsReputation}
                      className={`w-full py-2 text-xs font-bold font-space-mono uppercase rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                        meetsReputation
                          ? "bg-accent text-white hover:bg-accent/90 active:scale-95"
                          : "bg-surface-secondary text-text-secondary/50 cursor-not-allowed border border-border"
                      }`}
                    >
                      {meetsReputation ? (
                        <>
                          Sign Contract <ArrowRight className="size-3.5" />
                        </>
                      ) : (
                        `Requires ${tier.reputationRequired}+ Brand Prestige`
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
