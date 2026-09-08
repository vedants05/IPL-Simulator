"use client";

import { useState } from "react";
import {
  Crown,
  Building,
  GlassWater,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Percent,
  Plus,
  Minus,
} from "lucide-react";
import type {
  CommercialState,
  CorporateBox,
  LoungeSuite,
  PremiumExperiencePackage,
} from "@/lib/logic/commercialSystem";

interface HospitalitySubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

export default function HospitalitySubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: HospitalitySubpageProps) {
  const { hospitality } = state;
  const [activeTab, setActiveTab] = useState<"boxes" | "lounges" | "packages">("boxes");

  // Recalculate total hospitality revenue
  const recalculateHospitalityState = (
    boxes: CorporateBox[],
    lounges: LoungeSuite[],
    packages: PremiumExperiencePackage[]
  ): CommercialState => {
    const boxRev = boxes
      .filter((b) => b.leasedSeasonally)
      .reduce((sum, b) => sum + b.leaseAmountSeasonCr, 0);

    const loungeRev = lounges.reduce((sum, l) => sum + l.revenueSeasonCr, 0);

    const pkgRev = packages.reduce((sum, p) => {
      const matchRev = (p.pricePerPersonInr * p.soldPerMatch) / 10000000;
      return sum + matchRev * 7;
    }, 0);

    const totalRev = Number((boxRev + loungeRev + pkgRev).toFixed(2));

    return {
      ...state,
      hospitality: {
        ...hospitality,
        boxes,
        lounges,
        premiumPackages: packages,
        totalHospitalityRevenueCr: totalRev,
      },
    };
  };

  const handleToggleBoxLease = (boxId: string) => {
    const nextBoxes = hospitality.boxes.map((box) => {
      if (box.id === boxId) {
        return { ...box, leasedSeasonally: !box.leasedSeasonally };
      }
      return box;
    });
    onUpdateState(recalculateHospitalityState(nextBoxes, hospitality.lounges, hospitality.premiumPackages));
  };

  const handleBoxLeasePrice = (boxId: string, deltaCr: number) => {
    const nextBoxes = hospitality.boxes.map((box) => {
      if (box.id === boxId) {
        const nextPrice = Math.max(0.4, Math.min(3.5, Number((box.leaseAmountSeasonCr + deltaCr).toFixed(2))));
        return { ...box, leaseAmountSeasonCr: nextPrice };
      }
      return box;
    });
    onUpdateState(recalculateHospitalityState(nextBoxes, hospitality.lounges, hospitality.premiumPackages));
  };

  const handleLoungePrice = (loungeId: string, deltaInr: number) => {
    const nextLounges = hospitality.lounges.map((l) => {
      if (l.id === loungeId) {
        const nextPrice = Math.max(4000, Math.min(45000, l.dayPassPriceInr + deltaInr));
        const seasonRev = Number(
          (((l.capacity * (l.averageOccupancyPercent / 100) * nextPrice) / 10000000) * 7).toFixed(2)
        );
        return {
          ...l,
          dayPassPriceInr: nextPrice,
          revenueSeasonCr: seasonRev,
        };
      }
      return l;
    });
    onUpdateState(recalculateHospitalityState(hospitality.boxes, nextLounges, hospitality.premiumPackages));
  };

  const handlePackagePrice = (pkgId: string, deltaInr: number) => {
    const nextPkgs = hospitality.premiumPackages.map((p) => {
      if (p.id === pkgId) {
        const nextPrice = Math.max(5000, Math.min(80000, p.pricePerPersonInr + deltaInr));
        return { ...p, pricePerPersonInr: nextPrice };
      }
      return p;
    });
    onUpdateState(recalculateHospitalityState(hospitality.boxes, hospitality.lounges, nextPkgs));
  };

  const leasedBoxesCount = hospitality.boxes.filter((b) => b.leasedSeasonally).length;
  const totalBoxesCount = hospitality.boxes.length;
  const corporateBoxRevenue = hospitality.boxes
    .filter((b) => b.leasedSeasonally)
    .reduce((sum, b) => sum + b.leaseAmountSeasonCr, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Total Hospitality Revenue
            </span>
            <Crown className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{hospitality.totalHospitalityRevenueCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Across boxes, suites & VIP experiences</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Corporate Boxes Leased
            </span>
            <Building className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            {leasedBoxesCount} / {totalBoxesCount}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            ₹{corporateBoxRevenue.toFixed(2)} Cr season box revenue
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              VIP Client Retention
            </span>
            <Percent className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            {hospitality.vipRetentionRatePercent}%
          </p>
          <p className="mt-1 text-xs text-text-secondary">Multi-year corporate renewals</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Stadium Enclosure
            </span>
            <GlassWater className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {hospitality.lounges.length} Club Suites
          </p>
          <p className="mt-1 text-xs text-text-secondary">At {stadiumName}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("boxes")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "boxes"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Corporate Luxury Boxes ({leasedBoxesCount}/{totalBoxesCount})
        </button>
        <button
          onClick={() => setActiveTab("lounges")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "lounges"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Club Lounges & Suites ({hospitality.lounges.length})
        </button>
        <button
          onClick={() => setActiveTab("packages")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "packages"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          VIP Experience Packages ({hospitality.premiumPackages.length})
        </button>
      </div>

      {/* 1. CORPORATE BOXES */}
      {activeTab === "boxes" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
                Corporate Hospitality Boxes & Suites
              </h3>
              <p className="text-xs text-text-secondary">
                Long-term premium boxes leased to major conglomerates, high-net-worth patrons, and team partners.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-text-secondary">Occupancy Rate: </span>
              <span className="font-mono text-xs font-bold text-accent">
                {Math.round((leasedBoxesCount / Math.max(1, totalBoxesCount)) * 100)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitality.boxes.map((box) => (
              <div
                key={box.id}
                className={`rounded-lg border p-4 transition-all ${
                  box.leasedSeasonally
                    ? "border-accent/40 bg-surface-secondary/40"
                    : "border-border bg-surface-secondary/15 opacity-75"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-text-primary">{box.name}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Client: <span className="text-text-primary font-medium">{box.clientName}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleBoxLease(box.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                      box.leasedSeasonally
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    }`}
                  >
                    {box.leasedSeasonally ? (
                      <>
                        <CheckCircle2 className="size-3" /> Leased
                      </>
                    ) : (
                      <>
                        <XCircle className="size-3" /> Vacant
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Capacity</span>
                    <p className="font-mono font-semibold text-text-primary">{box.capacity} Guests</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Catering Tier</span>
                    <p className="font-medium text-text-primary capitalize">
                      {box.cateringTier.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Season Lease</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <button
                        onClick={() => handleBoxLeasePrice(box.id, -0.05)}
                        className="size-5 flex items-center justify-center rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        ₹{box.leaseAmountSeasonCr.toFixed(2)}Cr
                      </span>
                      <button
                        onClick={() => handleBoxLeasePrice(box.id, 0.05)}
                        className="size-5 flex items-center justify-center rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CLUB LOUNGES */}
      {activeTab === "lounges" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div>
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Premium Lounges & Member Suites
            </h3>
            <p className="text-xs text-text-secondary">
              High-capacity luxury enclosures featuring gourmet catering, air-conditioned seating, and private bars with matchday day passes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitality.lounges.map((lounge) => (
              <div key={lounge.id} className="rounded-lg border border-border p-4 bg-surface-secondary/40 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-text-primary">{lounge.name}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Capacity: {lounge.capacity} VIP Seats
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ₹{lounge.revenueSeasonCr.toFixed(2)} Cr
                    </span>
                    <p className="text-[10px] text-text-secondary">Season Turnover</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Average Occupancy</span>
                    <p className="font-mono font-semibold text-accent">{lounge.averageOccupancyPercent}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Day Pass Rate</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={() => handleLoungePrice(lounge.id, -500)}
                        className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        -₹500
                      </button>
                      <span className="font-mono font-bold text-text-primary">
                        ₹{lounge.dayPassPriceInr.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleLoungePrice(lounge.id, 500)}
                        className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        +₹500
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VIP PACKAGES */}
      {activeTab === "packages" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div>
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Exclusive VIP Matchday Packages
            </h3>
            <p className="text-xs text-text-secondary">
              Ultra-premium curated experiential packages for high-profile fans, tourists, and executive entertainment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitality.premiumPackages.map((pkg) => {
              const packageSeasonGross = ((pkg.pricePerPersonInr * pkg.soldPerMatch * 7) / 10000000).toFixed(2);
              return (
                <div key={pkg.id} className="rounded-lg border border-border p-4 bg-surface-secondary/30 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{pkg.title}</h4>
                      <p className="text-xs text-text-secondary mt-1">{pkg.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        ₹{packageSeasonGross} Cr
                      </span>
                      <p className="text-[10px] text-text-secondary">Gross (7 games)</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary">
                      Inclusions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.inclusions.map((inc, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[10px] rounded bg-surface border border-border text-text-secondary"
                        >
                          {inc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-border/50">
                    <span className="text-text-secondary">
                      Sold / Match: <span className="font-mono font-semibold text-text-primary">{pkg.soldPerMatch} passes</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePackagePrice(pkg.id, -1000)}
                        className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        -₹1k
                      </button>
                      <span className="font-mono font-bold text-text-primary">
                        ₹{pkg.pricePerPersonInr.toLocaleString()} / person
                      </span>
                      <button
                        onClick={() => handlePackagePrice(pkg.id, 1000)}
                        className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        +₹1k
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
