"use client";

import { useState } from "react";
import {
  HeartPulse,
  Building,
  Binoculars,
  ShoppingBag,
  ArrowUpCircle,
  Clock,
  Wrench,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type {
  CommercialState,
  FacilityType,
  ClubFacility,
  FacilityLevel,
} from "@/lib/logic/commercialSystem";

interface FacilitiesSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const FACILITY_ICONS: Record<FacilityType, any> = {
  medical: HeartPulse,
  admin: Building,
  scouting: Binoculars,
  commercial: ShoppingBag,
};

const FACILITY_COLORS: Record<FacilityType, { iconColor: string; bgBadge: string; textBadge: string }> = {
  medical: { iconColor: "text-rose-400", bgBadge: "bg-rose-500/10", textBadge: "text-rose-400" },
  admin: { iconColor: "text-blue-400", bgBadge: "bg-blue-500/10", textBadge: "text-blue-400" },
  scouting: { iconColor: "text-amber-400", bgBadge: "bg-amber-500/10", textBadge: "text-amber-400" },
  commercial: { iconColor: "text-emerald-400", bgBadge: "bg-emerald-500/10", textBadge: "text-emerald-400" },
};

export default function FacilitiesSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: FacilitiesSubpageProps) {
  const { facilities } = state;
  const [selectedFacility, setSelectedFacility] = useState<FacilityType>("medical");

  const recalculateMaintenance = (facMap: Record<FacilityType, ClubFacility>): number => {
    return Number(
      Object.values(facMap)
        .reduce((sum, f) => {
          const lvl = f.levels.find((l) => l.level === f.currentLevel);
          return sum + (lvl?.annualMaintenanceCr ?? 1.0);
        }, 0)
        .toFixed(2)
    );
  };

  const handleStartUpgrade = (type: FacilityType) => {
    const facility = facilities.facilities[type];
    if (facility.currentLevel >= facility.maxLevel || facility.isUpgrading) return;

    const nextLvl = facility.currentLevel + 1;
    const targetConfig = facility.levels.find((l) => l.level === nextLvl);
    if (!targetConfig) return;

    const updatedFacility: ClubFacility = {
      ...facility,
      isUpgrading: true,
      upgradeTargetLevel: nextLvl,
      upgradeDaysRemaining: targetConfig.constructionDays,
    };

    const nextFacilitiesMap = {
      ...facilities.facilities,
      [type]: updatedFacility,
    };

    const nextState: CommercialState = {
      ...state,
      facilities: {
        facilities: nextFacilitiesMap,
        totalAnnualMaintenanceCr: recalculateMaintenance(nextFacilitiesMap),
      },
    };
    onUpdateState(nextState);
  };

  const handleInstantComplete = (type: FacilityType) => {
    const facility = facilities.facilities[type];
    if (facility.currentLevel >= facility.maxLevel) return;

    const newLevel = facility.isUpgrading ? (facility.upgradeTargetLevel ?? facility.currentLevel + 1) : facility.currentLevel + 1;

    const updatedFacility: ClubFacility = {
      ...facility,
      currentLevel: newLevel,
      isUpgrading: false,
      upgradeTargetLevel: undefined,
      upgradeDaysRemaining: undefined,
    };

    const nextFacilitiesMap = {
      ...facilities.facilities,
      [type]: updatedFacility,
    };

    const nextState: CommercialState = {
      ...state,
      facilities: {
        facilities: nextFacilitiesMap,
        totalAnnualMaintenanceCr: recalculateMaintenance(nextFacilitiesMap),
      },
    };
    onUpdateState(nextState);
  };

  const totalLevels = Object.values(facilities.facilities).reduce((sum, f) => sum + f.currentLevel, 0);
  const maxPossibleLevels = Object.values(facilities.facilities).reduce((sum, f) => sum + f.maxLevel, 0);
  const activeUpgradesCount = Object.values(facilities.facilities).filter((f) => f.isUpgrading).length;

  const currentFac = facilities.facilities[selectedFacility];
  const activeLevelConfig = currentFac.levels.find((l) => l.level === currentFac.currentLevel);
  const nextLevelConfig = currentFac.levels.find((l) => l.level === currentFac.currentLevel + 1);

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Infrastructure Index
            </span>
            <Building className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            {totalLevels} / {maxPossibleLevels} Levels
          </p>
          <p className="mt-1 text-xs text-text-secondary">Across 4 core franchise departments</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Annual Upkeep
            </span>
            <Wrench className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{facilities.totalAnnualMaintenanceCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Fixed maintenance & staff operating costs</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Active Construction
            </span>
            <Clock className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {activeUpgradesCount} Projects
          </p>
          <p className="mt-1 text-xs text-text-secondary">Under expansion at {stadiumName}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Infrastructure Scope
            </span>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            Commercial & Org
          </p>
          <p className="mt-1 text-xs text-text-secondary">Strictly operational (No training system)</p>
        </div>
      </div>

      {/* Facility Selection Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(facilities.facilities) as FacilityType[]).map((type) => {
          const f = facilities.facilities[type];
          const Icon = FACILITY_ICONS[type];
          const meta = FACILITY_COLORS[type];
          const isSelected = selectedFacility === type;

          return (
            <button
              key={type}
              onClick={() => setSelectedFacility(type)}
              className={`p-3.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-surface hover:border-border-hover"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`size-5 ${meta.iconColor}`} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.bgBadge} ${meta.textBadge}`}>
                  Lvl {f.currentLevel}/5
                </span>
              </div>
              <h4 className="mt-2 text-xs font-bold text-text-primary capitalize">{f.name}</h4>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <div
                    key={lvl}
                    className={`h-1.5 flex-1 rounded-full ${
                      lvl <= f.currentLevel ? "bg-accent" : "bg-surface-secondary"
                    }`}
                  />
                ))}
              </div>
              {f.isUpgrading && (
                <div className="mt-2 text-[10px] text-cyan-400 flex items-center gap-1 font-mono">
                  <Clock className="size-3" /> Upgrading to L{f.upgradeTargetLevel}...
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Facility Detail */}
      <div className="rounded-lg border border-border bg-surface p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase font-bold text-accent">
                Facility Tier {currentFac.currentLevel} of {currentFac.maxLevel}
              </span>
              {currentFac.isUpgrading && (
                <span className="px-2 py-0.5 text-[10px] rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  Construction in progress ({currentFac.upgradeDaysRemaining} days remaining)
                </span>
              )}
            </div>
            <h3 className="mt-1 font-anton text-2xl uppercase tracking-wide text-text-primary">
              {activeLevelConfig?.name}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Annual Departmental Maintenance: ₹{activeLevelConfig?.annualMaintenanceCr.toFixed(2)} Cr / yr
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentFac.currentLevel < currentFac.maxLevel && (
              <>
                {!currentFac.isUpgrading ? (
                  <button
                    onClick={() => handleStartUpgrade(selectedFacility)}
                    className="px-4 py-2 text-xs font-semibold rounded bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <ArrowUpCircle className="size-4" /> Start Upgrade (₹{nextLevelConfig?.upgradeCostCr.toFixed(2)} Cr)
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstantComplete(selectedFacility)}
                    className="px-4 py-2 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="size-4" /> Complete Construction
                  </button>
                )}
              </>
            )}
            {currentFac.currentLevel >= currentFac.maxLevel && (
              <span className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Pinnacle Facility Level
              </span>
            )}
          </div>
        </div>

        {/* Current Active Benefits */}
        <div>
          <h4 className="font-space-mono text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            Active Operational Benefits (Tier {currentFac.currentLevel})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeLevelConfig?.benefits.map((benefit, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-surface-secondary/40 flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs text-text-primary">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Tier Roadmap */}
        {nextLevelConfig && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-space-mono text-xs font-bold uppercase tracking-wider text-accent">
                Next Tier Preview: Level {nextLevelConfig.level} - {nextLevelConfig.name}
              </h4>
              <span className="text-xs text-text-secondary font-mono">
                Duration: {nextLevelConfig.constructionDays} Days | Capital: ₹{nextLevelConfig.upgradeCostCr.toFixed(2)} Cr
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nextLevelConfig.benefits.map((benefit, i) => (
                <div key={i} className="p-3 rounded-lg border border-accent/20 bg-accent/5 flex items-start gap-2">
                  <Sparkles className="size-4 text-accent shrink-0 mt-0.5" />
                  <span className="text-xs text-text-primary">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
