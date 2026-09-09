"use client";

import { useState } from "react";
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Package,
  Globe,
  Tag,
  Plus,
  Minus,
  Sparkles,
  Layers,
  ArrowUpRight,
  Heart,
  ChevronRight,
  Users,
} from "lucide-react";
import type { CommercialState, MerchandiseItem } from "@/lib/logic/commercialSystem";
import type { TeamSupporterView } from "@/lib/logic/supporters";

interface MerchandisingSubpageProps {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  supporterView?: TeamSupporterView;
  onNavigateToSupporters?: () => void;
  onUpdateState: (nextState: CommercialState) => void;
}

export default function MerchandisingSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  supporterView,
  onNavigateToSupporters,
  onUpdateState,
}: MerchandisingSubpageProps) {
  const { merchandising } = state;
  const [selectedCategory, setSelectedCategory] = useState<"all" | MerchandiseItem["category"]>("all");

  const recalculateMerchState = (catalog: MerchandiseItem[], ecommerceShare: number): CommercialState => {
    let totalRev = 0;
    let totalCost = 0;

    for (const item of catalog) {
      const rev = (item.retailPriceInr * item.unitsSoldSeason) / 10000000;
      const cost = (item.productionCostInr * item.unitsSoldSeason) / 10000000;
      totalRev += rev;
      totalCost += cost;
    }

    totalRev = Number(totalRev.toFixed(2));
    totalCost = Number(totalCost.toFixed(2));
    const profit = Number((totalRev - totalCost).toFixed(2));

    return {
      ...state,
      merchandising: {
        ...merchandising,
        catalog,
        ecommerceSharePercent: ecommerceShare,
        totalMerchRevenueCr: totalRev,
        totalMerchCostCr: totalCost,
        grossMerchProfitCr: profit,
      },
    };
  };

  const handlePriceChange = (itemId: string, deltaInr: number) => {
    const nextCatalog = merchandising.catalog.map((item) => {
      if (item.id === itemId) {
        const nextPrice = Math.max(item.productionCostInr + 50, item.retailPriceInr + deltaInr);
        return { ...item, retailPriceInr: nextPrice };
      }
      return item;
    });
    onUpdateState(recalculateMerchState(nextCatalog, merchandising.ecommerceSharePercent));
  };

  const handleRestock = (itemId: string, addQuantity: number) => {
    const nextCatalog = merchandising.catalog.map((item) => {
      if (item.id === itemId) {
        return { ...item, stockLevel: item.stockLevel + addQuantity };
      }
      return item;
    });
    onUpdateState(recalculateMerchState(nextCatalog, merchandising.ecommerceSharePercent));
  };

  const totalUnitsSold = merchandising.catalog.reduce((sum, item) => sum + item.unitsSoldSeason, 0);
  const profitMarginPercent = Number(
    ((merchandising.grossMerchProfitCr / Math.max(1, merchandising.totalMerchRevenueCr)) * 100).toFixed(1)
  );

  const filteredCatalog =
    selectedCategory === "all"
      ? merchandising.catalog
      : merchandising.catalog.filter((i) => i.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Header Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Merch Revenue
            </span>
            <ShoppingBag className="size-4 text-accent" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-text-primary">
            ₹{merchandising.totalMerchRevenueCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Total season retail sales</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Gross Merch Profit
            </span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-emerald-400">
            ₹{merchandising.grossMerchProfitCr.toFixed(2)} Cr
          </p>
          <p className="mt-1 text-xs text-text-secondary">Margin: {profitMarginPercent}%</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Units Sold Season
            </span>
            <Package className="size-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-cyan-400">
            {totalUnitsSold.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Across {merchandising.catalog.length} SKUs</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Channel Split
            </span>
            <Globe className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-anton text-2xl uppercase tracking-wide text-amber-400">
            {merchandising.ecommerceSharePercent}% Online
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {100 - merchandising.ecommerceSharePercent}% Matchday Megastore
          </p>
        </div>
      </div>

      {/* Star Player Kit Demand & Supporter Synergy */}
      {supporterView && (
        <div className="rounded-lg border border-border/80 bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded bg-amber-500/10 text-amber-400">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Fan-Favorite Star Kits & Retail Synergy
                </h3>
                <p className="text-[10px] text-text-secondary">
                  Star player popularity and supporter sentiment dynamically boost replica kit sales and official merchandise turnover.
                </p>
              </div>
            </div>
            {onNavigateToSupporters && (
              <button
                type="button"
                onClick={onNavigateToSupporters}
                className="flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2.5 py-1 font-space-mono text-[8px] font-bold uppercase text-accent hover:bg-accent/20 transition-colors"
              >
                View Supporters Page <ChevronRight className="size-3" />
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(supporterView.popularPlayers && supporterView.popularPlayers.length > 0
              ? supporterView.popularPlayers.slice(0, 4)
              : [
                  { id: "star-1", name: "Marquee Star", approval: 85, trend: 5 },
                  { id: "star-2", name: "Vice Captain", approval: 78, trend: 2 },
                  { id: "star-3", name: "Strike Bowler", approval: 74, trend: 0 },
                  { id: "star-4", name: "Key Finisher", approval: 70, trend: 1 },
                ]
            ).map((player, idx) => {
              const volumeUplift = player.approval >= 85 ? "+35%" : player.approval >= 75 ? "+22%" : player.approval >= 65 ? "+12%" : "+5%";
              const tierBadge = idx === 0 ? "Top Kit Seller" : idx === 1 ? "Secondary Magnet" : "Squad Favorite";
              return (
                <div key={player.id} className="rounded border border-border/60 bg-surface-secondary/30 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-space-mono text-[7px] uppercase font-bold text-accent">{tierBadge}</span>
                    <span className="font-space-mono text-[7px] font-bold text-emerald-400">{volumeUplift} Kit Volume</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-text-primary truncate">{player.name}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[9px] text-text-secondary">
                    <span>Approval: <b className="text-text-primary">{player.approval}%</b></span>
                    <span className="font-space-mono text-[8px] text-text-secondary">Jersey Tier #{idx + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedCategory === "all"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Full Catalog ({merchandising.catalog.length})
        </button>
        <button
          onClick={() => setSelectedCategory("apparel")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedCategory === "apparel"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Apparel & Kits
        </button>
        <button
          onClick={() => setSelectedCategory("headwear")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedCategory === "headwear"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Caps & Headwear
        </button>
        <button
          onClick={() => setSelectedCategory("equipment")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedCategory === "equipment"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Cricket Equipment
        </button>
        <button
          onClick={() => setSelectedCategory("souvenirs")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            selectedCategory === "souvenirs"
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:text-text-primary"
          }`}
        >
          Souvenirs & Fan Gear
        </button>
      </div>

      {/* Product Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCatalog.map((item) => {
          const itemRevCr = ((item.retailPriceInr * item.unitsSoldSeason) / 10000000).toFixed(2);
          const itemUnitMargin = item.retailPriceInr - item.productionCostInr;
          const itemMarginPct = Math.round((itemUnitMargin / item.retailPriceInr) * 100);

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${
                item.isMarqueePlayerSpecial
                  ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                  : "border-border bg-surface hover:border-accent/50"
              }`}
            >
              <div>
                {/* Header Badge */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-secondary border border-border text-text-secondary capitalize">
                    {item.category}
                  </span>
                  {item.isMarqueePlayerSpecial && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      <Sparkles className="size-3" /> Marquee Player Edition
                    </span>
                  )}
                </div>

                {/* Name */}
                <h4 className="mt-2 font-bold text-sm text-text-primary">{item.name}</h4>

                {/* Pricing & Unit Economics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Retail Price</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <button
                        onClick={() => handlePriceChange(item.id, -50)}
                        className="size-5 flex items-center justify-center rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-text-primary">
                        ₹{item.retailPriceInr.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handlePriceChange(item.id, 50)}
                        className="size-5 flex items-center justify-center rounded bg-surface border border-border text-[10px] hover:bg-surface-secondary"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Unit Margin</span>
                    <p className="font-mono font-semibold text-emerald-400 mt-1">
                      +₹{itemUnitMargin} ({itemMarginPct}%)
                    </p>
                  </div>
                </div>

                {/* Sales & Inventory */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Units Sold</span>
                    <p className="font-mono font-semibold text-text-primary">
                      {item.unitsSoldSeason.toLocaleString()} / {item.projectedAnnualSales.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Season Turnover</span>
                    <p className="font-mono font-bold text-accent">₹{itemRevCr} Cr</p>
                  </div>
                </div>
              </div>

              {/* Restock Bar */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-text-secondary">Stock: </span>
                  <span
                    className={`font-mono font-semibold ${
                      item.stockLevel < 2000 ? "text-red-400" : "text-text-primary"
                    }`}
                  >
                    {item.stockLevel.toLocaleString()} units
                  </span>
                </div>

                <button
                  onClick={() => handleRestock(item.id, 2500)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-surface-secondary border border-border hover:bg-surface-secondary/80 text-text-primary flex items-center gap-1"
                >
                  <Plus className="size-3" /> Restock (+2.5k)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
