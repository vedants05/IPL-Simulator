"use client";

import { useState } from "react";
import {
  Tv,
  Trophy,
  Globe,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Layers,
  Sparkles,
} from "lucide-react";
import type { CommercialState } from "@/lib/logic/commercialSystem";

interface BroadcastSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const PRIZE_MONEY_TABLE = [
  { rank: 1, title: "IPL Champions", prizeCr: 20.0, description: "Trophy, gold medals & champions purse" },
  { rank: 2, title: "Runners-Up", prizeCr: 12.5, description: "Finalists purse & silver medals" },
  { rank: 3, title: "3rd Place (Qualifier 2)", prizeCr: 7.0, description: "Playoffs podium finish" },
  { rank: 4, title: "4th Place (Eliminator)", prizeCr: 6.5, description: "Playoffs qualification bonus" },
  { rank: 5, title: "5th-10th (League Stage)", prizeCr: 0.0, description: "Central pool share only" },
];

export default function BroadcastSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: BroadcastSubpageProps) {
  const { broadcast } = state;
  const [projectedRank, setProjectedRank] = useState<number>(2);

  const handleSelectRank = (rank: number) => {
    setProjectedRank(rank);
    const target = PRIZE_MONEY_TABLE.find((p) => p.rank === rank) || PRIZE_MONEY_TABLE[4];
    const newPrize = target.prizeCr;
    const newTotal = Number(
      (
        broadcast.centralPoolShareCr +
        broadcast.tvViewershipBonusCr +
        broadcast.overseasRightsShareCr +
        newPrize
      ).toFixed(2)
    );

    const nextState: CommercialState = {
      ...state,
      broadcast: {
        ...broadcast,
        currentProjectedPrizeCr: newPrize,
        totalBroadcastIncomeCr: newTotal,
      },
    };
    onUpdateState(nextState);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Total Broadcast & Prize
            </span>
            <Tv className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{broadcast.totalBroadcastIncomeCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Largest commercial revenue pillar</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              BCCI Media Rights Pool
            </span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            ₹{broadcast.centralPoolShareCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Guaranteed franchise central distribution</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              TV Viewership & Global
            </span>
            <Globe className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            ₹{(broadcast.tvViewershipBonusCr + broadcast.overseasRightsShareCr).toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">TRP ratings & international feeds</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Projected Prize Money
            </span>
            <Trophy className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{broadcast.currentProjectedPrizeCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Based on projected finish</p>
        </div>
      </div>

      {/* Central Pool Breakdown */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
          BCCI Central Revenue Distribution Structure
        </h3>
        <p className="text-xs text-text-secondary">
          The BCCI pools aggregate broadcast, digital streaming, and title sponsorship rights across the entire IPL season and distributes equal 50% shares to all 10 franchises.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-lg border border-border bg-surface-secondary/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-text-primary">Domestic Linear Television</span>
              <span className="font-mono font-bold text-accent">₹240.00 Cr</span>
            </div>
            <p className="text-[11px] text-text-secondary">
              Subcontinental exclusive cable & satellite broadcast rights (Star Sports network).
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-surface-secondary/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-text-primary">Domestic Digital OTT Streaming</span>
              <span className="font-mono font-bold text-accent">₹200.00 Cr</span>
            </div>
            <p className="text-[11px] text-text-secondary">
              4K mobile and smart television streaming distribution (JioCinema / Viacom18).
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-surface-secondary/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-text-primary">Global Rights & TRP Incentives</span>
              <span className="font-mono font-bold text-emerald-400">
                ₹{(broadcast.tvViewershipBonusCr + broadcast.overseasRightsShareCr).toFixed(2)} Cr
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">
              International feeds (Willow TV, Sky Sports UK, SuperSport) plus prime time viewership bonus.
            </p>
          </div>
        </div>
      </div>

      {/* Competition Prize Money Scale */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Competition Prize Money Projection
            </h3>
            <p className="text-xs text-text-secondary">
              Official BCCI prize purses awarded upon final standings at the conclusion of the IPL Playoffs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {PRIZE_MONEY_TABLE.map((item) => {
            const isSelected = projectedRank === item.rank;
            return (
              <button
                key={item.rank}
                onClick={() => handleSelectRank(item.rank)}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500"
                    : "border-border bg-surface hover:border-border-hover"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-space-mono text-xs font-bold text-text-secondary">
                    {item.rank <= 4 ? `Rank #${item.rank}` : "Rank #5-10"}
                  </span>
                  {isSelected && <Trophy className="size-4 text-amber-400" />}
                </div>
                <h4 className="mt-1 font-bold text-xs text-text-primary">{item.title}</h4>
                <p className="mt-2 font-mono font-bold text-base text-amber-400">
                  {item.prizeCr > 0 ? `₹${item.prizeCr.toFixed(1)} Cr` : "₹0 Cr"}
                </p>
                <p className="mt-1 text-[10px] text-text-secondary truncate">{item.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
