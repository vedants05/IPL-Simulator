"use client";

import { useState } from "react";
import {
  Megaphone,
  TrendingUp,
  Share2,
  Users,
  Target,
  Sparkles,
  CheckCircle,
  XCircle,
  Radio,
  Tv,
  Globe,
  Plus,
  Minus,
} from "lucide-react";
import type {
  CommercialState,
  MarketingCampaign,
  PlayerPromoActivation,
} from "@/lib/logic/commercialSystem";

interface MarketingSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  onUpdateState: (nextState: CommercialState) => void;
}

const CHANNEL_LABELS: Record<MarketingCampaign["channel"], { label: string; icon: any }> = {
  city_billboards: { label: "City Metro & Hoardings", icon: Tv },
  digital_social: { label: "Digital & Social Media", icon: Share2 },
  grassroots_clinics: { label: "Grassroots Coaching Clinics", icon: Users },
  celebrity_collab: { label: "Celebrity & Influencer Collab", icon: Sparkles },
};

export default function MarketingSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  onUpdateState,
}: MarketingSubpageProps) {
  const { marketing } = state;
  const [activeTab, setActiveTab] = useState<"campaigns" | "players" | "brand">("campaigns");

  const handleToggleCampaign = (campaignId: string) => {
    const nextCampaigns = marketing.campaigns.map((c) => {
      if (c.id === campaignId) {
        return { ...c, active: !c.active };
      }
      return c;
    });

    const activeBudget = Number(
      nextCampaigns.filter((c) => c.active).reduce((sum, c) => sum + c.budgetCr, 0).toFixed(2)
    );

    const nextState: CommercialState = {
      ...state,
      marketing: {
        ...marketing,
        campaigns: nextCampaigns,
        annualMarketingBudgetCr: activeBudget,
      },
    };
    onUpdateState(nextState);
  };

  const handleAdjustBudget = (campaignId: string, deltaCr: number) => {
    const nextCampaigns = marketing.campaigns.map((c) => {
      if (c.id === campaignId) {
        const nextBudget = Math.max(0.5, Math.min(15.0, Number((c.budgetCr + deltaCr).toFixed(2))));
        const factor = nextBudget / c.budgetCr;
        return {
          ...c,
          budgetCr: nextBudget,
          reachImpressionsMillions: Number((c.reachImpressionsMillions * factor).toFixed(1)),
          fanAcquisitionEstimate: Math.round(c.fanAcquisitionEstimate * factor),
        };
      }
      return c;
    });

    const activeBudget = Number(
      nextCampaigns.filter((c) => c.active).reduce((sum, c) => sum + c.budgetCr, 0).toFixed(2)
    );

    const nextState: CommercialState = {
      ...state,
      marketing: {
        ...marketing,
        campaigns: nextCampaigns,
        annualMarketingBudgetCr: activeBudget,
      },
    };
    onUpdateState(nextState);
  };

  const totalAcquiredFans = marketing.campaigns
    .filter((c) => c.active)
    .reduce((sum, c) => sum + c.fanAcquisitionEstimate, 0);

  const totalImpressions = marketing.campaigns
    .filter((c) => c.active)
    .reduce((sum, c) => sum + c.reachImpressionsMillions, 0);

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Brand Equity Score
            </span>
            <Target className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            {marketing.brandEquityScore} / 100
          </p>
          <p className="mt-1 text-xs text-text-secondary">Global sports franchise valuation tier</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Global Social Followers
            </span>
            <Globe className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {marketing.globalFollowersMillions.toFixed(1)}M
          </p>
          <p className="mt-1 text-xs text-text-secondary">Instagram, X, YouTube & Threads</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Committed Budget
            </span>
            <Megaphone className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            ₹{marketing.annualMarketingBudgetCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Active promotional spend</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Fan Acquisition Target
            </span>
            <Users className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            +{totalAcquiredFans.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-text-secondary">From {totalImpressions.toFixed(0)}M ad impressions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "campaigns"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Advertising Campaigns ({marketing.campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("players")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "players"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Player Brand Activations ({marketing.promotions.length})
        </button>
        <button
          onClick={() => setActiveTab("brand")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "brand"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Brand Equity Drivers
        </button>
      </div>

      {/* 1. CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketing.campaigns.map((camp) => {
            const channelMeta = CHANNEL_LABELS[camp.channel] || { label: camp.channel, icon: Megaphone };
            const Icon = channelMeta.icon;

            return (
              <div
                key={camp.id}
                className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${
                  camp.active
                    ? "border-accent/40 bg-surface"
                    : "border-border bg-surface-secondary/20 opacity-70"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Icon className="size-3.5 text-accent" />
                      <span>{channelMeta.label}</span>
                    </div>
                    <button
                      onClick={() => handleToggleCampaign(camp.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        camp.active
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-zinc-700/40 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {camp.active ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                      {camp.active ? "Active" : "Paused"}
                    </button>
                  </div>

                  <h4 className="mt-2 font-bold text-sm text-text-primary">{camp.name}</h4>
                  <p className="text-xs italic text-accent mt-0.5">&ldquo;{camp.tagline}&rdquo;</p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-border/50 pt-2">
                    <div>
                      <span className="text-[10px] text-text-secondary uppercase">Projected Reach</span>
                      <p className="font-mono font-semibold text-text-primary">
                        {camp.reachImpressionsMillions}M Impressions
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary uppercase">Fan Growth</span>
                      <p className="font-mono font-semibold text-emerald-400">
                        +{camp.fanAcquisitionEstimate.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Campaign Budget:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjustBudget(camp.id, -0.5)}
                      className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-text-primary text-xs">
                      ₹{camp.budgetCr.toFixed(2)} Cr
                    </span>
                    <button
                      onClick={() => handleAdjustBudget(camp.id, 0.5)}
                      className="size-6 flex items-center justify-center rounded bg-surface-secondary border border-border text-xs hover:bg-surface-secondary/80"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. PLAYERS */}
      {activeTab === "players" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div>
            <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
              Squad Ambassador Contract Rights
            </h3>
            <p className="text-xs text-text-secondary">
              Marquee cricketers designated for franchise digital commercials, meet-and-greets, and viral media campaigns.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {marketing.promotions.map((promo) => (
              <div key={promo.playerId} className="rounded-lg border border-border p-4 bg-surface-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="size-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                    {promo.playerName.charAt(0)}
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    +{promo.socialReachBoostPercent}% Engagement
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-text-primary">{promo.playerName}</h4>
                  <p className="text-xs text-text-secondary">Club Commercial Icon</p>
                </div>

                <div className="border-t border-border/50 pt-2 text-xs flex justify-between text-text-secondary">
                  <span>Contract Days Remaining:</span>
                  <span className="font-mono font-bold text-text-primary">{promo.brandAmbassadorDaysRemaining} Days</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BRAND DRIVERS */}
      {activeTab === "brand" && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <h3 className="font-anton text-lg uppercase tracking-wide text-text-primary">
            Franchise Brand Equity Pillars
          </h3>
          <p className="text-xs text-text-secondary">
            Strategic parameters that determine merchandise sales velocity, sponsorship tiering, and television viewership ratings.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
              <span className="text-xs font-semibold text-text-primary">1. Historic Legacy & Titles</span>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Trophies and playoff appearances create generational fandom, buffering matchday attendance even during rebuilding cycles.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
              <span className="text-xs font-semibold text-text-primary">2. Marquee Player Stature</span>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Superstar players dramatically escalate social followings, global overseas jersey demand, and commercial broadcast viewership.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
              <span className="text-xs font-semibold text-text-primary">3. City Community Roots</span>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Regional fan anthems, metro activations, and school grassroots camps forge unbreakable regional identity and sellout gate crowds.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
