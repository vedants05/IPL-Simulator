"use client";

import { useState } from "react";
import {
  Shield,
  Utensils,
  Sparkles,
  Flame,
  Volume2,
  Trash2,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  IndianRupee,
  Coins,
} from "lucide-react";
import type {
  CommercialState,
  SecurityLevel,
  CateringModel,
  EventExpenditure,
} from "@/lib/logic/commercialSystem";

interface MatchdayOpsSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const SECURITY_PRESETS: Record<SecurityLevel["id"], SecurityLevel> = {
  standard: {
    id: "standard",
    label: "Standard Municipal Security",
    costPerMatchCr: 0.35,
    stewardsPer1000Fans: 12,
    incidentMitigationRating: 75,
  },
  enhanced: {
    id: "enhanced",
    label: "Enhanced Private & Police Force",
    costPerMatchCr: 0.65,
    stewardsPer1000Fans: 20,
    incidentMitigationRating: 90,
  },
  elite: {
    id: "elite",
    label: "Elite Special Forces & High-Tech Surveillance",
    costPerMatchCr: 1.1,
    stewardsPer1000Fans: 30,
    incidentMitigationRating: 98,
  },
};

export default function MatchdayOpsSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: MatchdayOpsSubpageProps) {
  const { matchdayOps } = state;
  const [activeTab, setActiveTab] = useState<"security" | "catering" | "event">("security");

  const currentSecurity = SECURITY_PRESETS[matchdayOps.securityLevel] || SECURITY_PRESETS.standard;

  const updateSecurity = (levelId: SecurityLevel["id"]) => {
    const sec = SECURITY_PRESETS[levelId];
    const newPerMatch = Number(
      (
        sec.costPerMatchCr +
        matchdayOps.eventExpenses.lightAndSoundPerMatchCr +
        matchdayOps.eventExpenses.fireworksAndPyroCr +
        matchdayOps.eventExpenses.fanEngageDJsAndCheerCr +
        matchdayOps.eventExpenses.sanitationAndCleanupCr
      ).toFixed(2)
    );

    const nextState: CommercialState = {
      ...state,
      matchdayOps: {
        ...matchdayOps,
        securityLevel: levelId,
        safetyRating: sec.incidentMitigationRating,
        totalCostPerMatchCr: newPerMatch,
        seasonalOperationalSpendCr: Number((newPerMatch * 7).toFixed(2)),
      },
    };
    onUpdateState(nextState);
  };

  const updateCateringModel = (updates: Partial<CateringModel>) => {
    const nextCatering: CateringModel = {
      ...matchdayOps.catering,
      ...updates,
    };

    const nextState: CommercialState = {
      ...state,
      matchdayOps: {
        ...matchdayOps,
        catering: nextCatering,
      },
    };
    onUpdateState(nextState);
  };

  const updateEventExpense = (key: keyof EventExpenditure, delta: number) => {
    const curVal = matchdayOps.eventExpenses[key];
    const nextVal = Math.max(0.05, Math.min(1.5, Number((curVal + delta).toFixed(2))));
    const nextExpenses = {
      ...matchdayOps.eventExpenses,
      [key]: nextVal,
    };

    const newPerMatch = Number(
      (
        currentSecurity.costPerMatchCr +
        nextExpenses.lightAndSoundPerMatchCr +
        nextExpenses.fireworksAndPyroCr +
        nextExpenses.fanEngageDJsAndCheerCr +
        nextExpenses.sanitationAndCleanupCr
      ).toFixed(2)
    );

    const nextState: CommercialState = {
      ...state,
      matchdayOps: {
        ...matchdayOps,
        eventExpenses: nextExpenses,
        totalCostPerMatchCr: newPerMatch,
        seasonalOperationalSpendCr: Number((newPerMatch * 7).toFixed(2)),
      },
    };
    onUpdateState(nextState);
  };

  // Catering calculations
  const avgCrowd = Math.round(stadiumCapacity * 0.9);
  const totalCateringGrossPerMatch = (avgCrowd * matchdayOps.catering.averageSpendPerFanInr);
  const clubCateringTakePerMatchCr = Number(
    ((totalCateringGrossPerMatch * (matchdayOps.catering.franchiseMarginPercent / 100)) / 10000000).toFixed(2)
  );
  const clubCateringSeasonCr = Number((clubCateringTakePerMatchCr * 7).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Matchday Spend / Game
            </span>
            <IndianRupee className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{matchdayOps.totalCostPerMatchCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            ₹{matchdayOps.seasonalOperationalSpendCr.toFixed(2)} Cr over 7 home matches
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Crowd Safety Rating
            </span>
            <Shield className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            {matchdayOps.safetyRating}%
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Tier: {currentSecurity.label.split(" ")[0]} ({currentSecurity.stewardsPer1000Fans} stewards/1k)
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Catering Net Income
            </span>
            <Coins className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{clubCateringSeasonCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            ₹{clubCateringTakePerMatchCr.toFixed(2)} Cr/match ({matchdayOps.catering.franchiseMarginPercent}% cut)
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Catering Fan Rating
            </span>
            <Utensils className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {matchdayOps.catering.satisfactionRating}%
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {matchdayOps.catering.stallsCount} food & drink points at {stadiumName}
          </p>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "security"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Security & Stewarding
        </button>
        <button
          onClick={() => setActiveTab("catering")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "catering"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Catering & Concessions
        </button>
        <button
          onClick={() => setActiveTab("event")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "event"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Event Production & Pyro
        </button>
      </div>

      {/* 1. SECURITY & STEWARDING TAB */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary mb-1">
              Matchday Security Protocol & Deployment
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Select crowd control, biometric ticketing turnstiles, and emergency deployment protocols for {stadiumName}. Higher tiers protect crowd safety and franchise reputation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(SECURITY_PRESETS) as Array<SecurityLevel["id"]>).map((key) => {
                const preset = SECURITY_PRESETS[key];
                const isSelected = matchdayOps.securityLevel === key;
                return (
                  <div
                    key={key}
                    onClick={() => updateSecurity(key)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 ring-1 ring-accent"
                        : "border-border bg-surface-secondary/40 hover:border-border-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-text-primary">{preset.label}</span>
                      {isSelected ? (
                        <CheckCircle className="size-4 text-accent" />
                      ) : (
                        <div className="size-4 rounded-full border border-border" />
                      )}
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between text-text-secondary">
                        <span>Cost / Match:</span>
                        <span className="font-mono font-semibold text-text-primary">
                          ₹{preset.costPerMatchCr.toFixed(2)} Cr
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Stewards / 1,000 Fans:</span>
                        <span className="font-mono font-semibold text-text-primary">
                          {preset.stewardsPer1000Fans} stewards
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Mitigation Rating:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {preset.incidentMitigationRating}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. CATERING TAB */}
      {activeTab === "catering" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Concessions Operating Model
            </h3>
            <p className="text-xs text-text-secondary">
              Configure whether external culinary vendors operate stalls on royalties, or if the franchise manages inventory in-house.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateCateringModel({ vendorModel: "franchise_commission", franchiseMarginPercent: 24 })}
                className={`p-3 rounded-lg border text-left transition-all ${
                  matchdayOps.catering.vendorModel === "franchise_commission"
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-secondary/40"
                }`}
              >
                <div className="font-semibold text-xs text-text-primary">Franchise Royalty (24%)</div>
                <div className="text-[11px] text-text-secondary mt-1">
                  Zero inventory risk. Vendors pay fixed concession fee + revenue share.
                </div>
              </button>

              <button
                onClick={() => updateCateringModel({ vendorModel: "in_house_concession", franchiseMarginPercent: 42 })}
                className={`p-3 rounded-lg border text-left transition-all ${
                  matchdayOps.catering.vendorModel === "in_house_concession"
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-secondary/40"
                }`}
              >
                <div className="font-semibold text-xs text-text-primary">In-House Operations (42%)</div>
                <div className="text-[11px] text-text-secondary mt-1">
                  Higher margin potential, requires direct supply chain & cold storage.
                </div>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Average Spend / Attendee:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateCateringModel({
                        averageSpendPerFanInr: Math.max(150, matchdayOps.catering.averageSpendPerFanInr - 25),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-surface-secondary border border-border hover:bg-surface-secondary/80 text-xs"
                  >
                    - ₹25
                  </button>
                  <span className="font-mono font-bold text-text-primary w-16 text-center">
                    ₹{matchdayOps.catering.averageSpendPerFanInr}
                  </span>
                  <button
                    onClick={() =>
                      updateCateringModel({
                        averageSpendPerFanInr: Math.min(800, matchdayOps.catering.averageSpendPerFanInr + 25),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-surface-secondary border border-border hover:bg-surface-secondary/80 text-xs"
                  >
                    + ₹25
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Stalls & Mobile Kiosks:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateCateringModel({
                        stallsCount: Math.max(20, matchdayOps.catering.stallsCount - 5),
                        satisfactionRating: Math.max(60, matchdayOps.catering.satisfactionRating - 2),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-surface-secondary border border-border hover:bg-surface-secondary/80 text-xs"
                  >
                    - 5
                  </button>
                  <span className="font-mono font-bold text-text-primary w-16 text-center">
                    {matchdayOps.catering.stallsCount}
                  </span>
                  <button
                    onClick={() =>
                      updateCateringModel({
                        stallsCount: Math.min(120, matchdayOps.catering.stallsCount + 5),
                        satisfactionRating: Math.min(99, matchdayOps.catering.satisfactionRating + 2),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-surface-secondary border border-border hover:bg-surface-secondary/80 text-xs"
                  >
                    + 5
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Catering Economics Overview
            </h3>
            <div className="p-4 rounded-lg bg-surface-secondary/50 space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Estimated Crowd / Match:</span>
                <span className="font-mono text-text-primary">{avgCrowd.toLocaleString()} fans</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Gross F&B Turnover / Match:</span>
                <span className="font-mono text-text-primary">
                  ₹{(totalCateringGrossPerMatch / 10000000).toFixed(2)} Cr
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Franchise Net Royalty:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₹{clubCateringTakePerMatchCr.toFixed(2)} Cr / game
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-text-primary">
                <span>Total 7-Match Home Net Revenue:</span>
                <span className="font-mono text-emerald-400">₹{clubCateringSeasonCr.toFixed(2)} Cr</span>
              </div>
            </div>
            <div className="text-[11px] text-text-secondary leading-relaxed">
              * Higher stall counts alleviate halftime concourse queueing, directly boosting customer satisfaction and per-capita spend.
            </div>
          </div>
        </div>
      )}

      {/* 3. EVENT PRODUCTION TAB */}
      {activeTab === "event" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
            Stadium Entertainment & Match Production Budget
          </h3>
          <p className="text-xs text-text-secondary">
            Fine-tune pyrotechnics, dynamic laser light shows, DJ consoles, cheer units, and post-match sanitation standards.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Light and Sound */}
            <div className="rounded-lg border border-border p-4 bg-surface-secondary/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 text-accent" />
                  <span className="font-semibold text-xs text-text-primary">Laser & Stadium Floodlight Show</span>
                </div>
                <div className="text-[11px] text-text-secondary">Synchronized LED light shows for 4s, 6s and wickets</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateEventExpense("lightAndSoundPerMatchCr", -0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{matchdayOps.eventExpenses.lightAndSoundPerMatchCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateEventExpense("lightAndSoundPerMatchCr", 0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  +
                </button>
              </div>
            </div>

            {/* Pyro */}
            <div className="rounded-lg border border-border p-4 bg-surface-secondary/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-amber-500" />
                  <span className="font-semibold text-xs text-text-primary">Fireworks & Boundary Pyrotechnics</span>
                </div>
                <div className="text-[11px] text-text-secondary">CO2 jets, flame projectors, and victory fireworks</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateEventExpense("fireworksAndPyroCr", -0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{matchdayOps.eventExpenses.fireworksAndPyroCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateEventExpense("fireworksAndPyroCr", 0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  +
                </button>
              </div>
            </div>

            {/* Fan DJs & Cheer */}
            <div className="rounded-lg border border-border p-4 bg-surface-secondary/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-purple-400" />
                  <span className="font-semibold text-xs text-text-primary">Fan Zone DJs & Cheerleaders</span>
                </div>
                <div className="text-[11px] text-text-secondary">Resident stadium DJs, brass band, & mascot team</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateEventExpense("fanEngageDJsAndCheerCr", -0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{matchdayOps.eventExpenses.fanEngageDJsAndCheerCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateEventExpense("fanEngageDJsAndCheerCr", 0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  +
                </button>
              </div>
            </div>

            {/* Sanitation */}
            <div className="rounded-lg border border-border p-4 bg-surface-secondary/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="size-4 text-emerald-400" />
                  <span className="font-semibold text-xs text-text-primary">Sanitation & Post-Match Cleanup</span>
                </div>
                <div className="text-[11px] text-text-secondary">Grandstand waste disposal & municipal eco-credits</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateEventExpense("sanitationAndCleanupCr", -0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{matchdayOps.eventExpenses.sanitationAndCleanupCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateEventExpense("sanitationAndCleanupCr", 0.05)}
                  className="px-2 py-1 rounded bg-surface border border-border text-xs hover:bg-surface-secondary"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
