"use client";

import { useState } from "react";
import {
  DollarSign,
  Users,
  Plane,
  Building2,
  Briefcase,
  TrendingDown,
  Percent,
  Plus,
  Minus,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import type { CommercialState, OperatingCostsState } from "@/lib/logic/commercialSystem";

interface OperatingCostsSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

export default function OperatingCostsSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: OperatingCostsSubpageProps) {
  const { operatingCosts } = state;

  const updateCostItem = (key: keyof Omit<OperatingCostsState, "totalOperatingCostsCr">, delta: number) => {
    const cur = operatingCosts[key];
    const nextVal = Math.max(1.0, Number((cur + delta).toFixed(2)));

    const nextOperating: OperatingCostsState = {
      ...operatingCosts,
      [key]: nextVal,
    };

    const newTotal = Number(
      (
        nextOperating.squadSalariesCr +
        nextOperating.coachingStaffSalariesCr +
        nextOperating.travelAndHotelsCr +
        nextOperating.stadiumAndTurfUpkeepCr +
        nextOperating.administrativeCorporateCr
      ).toFixed(2)
    );

    nextOperating.totalOperatingCostsCr = newTotal;

    const nextState: CommercialState = {
      ...state,
      operatingCosts: nextOperating,
    };
    onUpdateState(nextState);
  };

  const squadSalaryPct = Math.round(
    (operatingCosts.squadSalariesCr / Math.max(1, operatingCosts.totalOperatingCostsCr)) * 100
  );

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Total Operating Costs
            </span>
            <DollarSign className="size-4 text-rose-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-rose-400">
            ₹{operatingCosts.totalOperatingCostsCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Annual franchise operating outflow</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Squad Payroll
            </span>
            <Users className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{operatingCosts.squadSalariesCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">{squadSalaryPct}% of entire club expenditure</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Travel & Logistics
            </span>
            <Plane className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            ₹{operatingCosts.travelAndHotelsCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Private charters & 5-star team suites</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Venue & Grounds Upkeep
            </span>
            <Building2 className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{operatingCosts.stadiumAndTurfUpkeepCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Pitch curator, floodlights & utilities</p>
        </div>
      </div>

      {/* Cost Center Breakdown Cards */}
      <div className="space-y-4">
        <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
          Franchise Operational Expenditure Centers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Squad Payroll */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-accent" />
                <h4 className="font-bold text-sm text-text-primary">Squad Player Contracts & Wages</h4>
              </div>
              <span className="font-mono font-bold text-sm text-text-primary">
                ₹{operatingCosts.squadSalariesCr.toFixed(2)} Cr
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Guaranteed player compensation pursuant to BCCI IPL Player Auction guidelines and retention slots.
            </p>
            <div className="p-3 rounded bg-surface-secondary/40 text-[11px] text-text-secondary flex justify-between items-center">
              <span>BCCI Salary Cap Utilization:</span>
              <span className="font-mono font-bold text-accent">Active Cap Compliant</span>
            </div>
          </div>

          {/* Coaching Staff */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-blue-400" />
                <h4 className="font-bold text-sm text-text-primary">Coaching Staff & Analysts</h4>
              </div>
              <span className="font-mono font-bold text-sm text-text-primary">
                ₹{operatingCosts.coachingStaffSalariesCr.toFixed(2)} Cr
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Salaries for Head Coach, Bowling Mentor, Batting Coach, Head Physiotherapist, and Lead Video Analyst.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-secondary">Adjust Staff Quality Allocation:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateCostItem("coachingStaffSalariesCr", -0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{operatingCosts.coachingStaffSalariesCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateCostItem("coachingStaffSalariesCr", 0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Travel & Hospitality */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Plane className="size-4 text-cyan-400" />
                <h4 className="font-bold text-sm text-text-primary">Charter Flights & Five-Star Hospitality</h4>
              </div>
              <span className="font-mono font-bold text-sm text-text-primary">
                ₹{operatingCosts.travelAndHotelsCr.toFixed(2)} Cr
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Private chartered aircraft for 7 away match expeditions across India, police escorts, and 5-star presidential team floors.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-secondary">Adjust Transit Logistics Tier:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateCostItem("travelAndHotelsCr", -0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{operatingCosts.travelAndHotelsCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateCostItem("travelAndHotelsCr", 0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Stadium & Turf Upkeep */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-amber-400" />
                <h4 className="font-bold text-sm text-text-primary">Stadium Turf, Floodlights & Ground Staff</h4>
              </div>
              <span className="font-mono font-bold text-sm text-text-primary">
                ₹{operatingCosts.stadiumAndTurfUpkeepCr.toFixed(2)} Cr
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              High-intensity LED floodlight electricity tariffs, heavy machinery rollers, soil aeration, and groundskeepers at {stadiumName}.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-secondary">Adjust Maintenance Budget:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateCostItem("stadiumAndTurfUpkeepCr", -0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{operatingCosts.stadiumAndTurfUpkeepCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateCostItem("stadiumAndTurfUpkeepCr", 0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Administration & Legal */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3 md:col-span-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-purple-400" />
                <h4 className="font-bold text-sm text-text-primary">Corporate Administration, Legal & Licensing</h4>
              </div>
              <span className="font-mono font-bold text-sm text-text-primary">
                ₹{operatingCosts.administrativeCorporateCr.toFixed(2)} Cr
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Executive head office payroll, legal retainers for player contracts, BCCI arbitration, international visas, and compliance auditing.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-secondary">Adjust Corporate Budget:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateCostItem("administrativeCorporateCr", -0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  -
                </button>
                <span className="font-mono text-xs font-bold text-text-primary w-16 text-center">
                  ₹{operatingCosts.administrativeCorporateCr.toFixed(2)} Cr
                </span>
                <button
                  onClick={() => updateCostItem("administrativeCorporateCr", 0.5)}
                  className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
