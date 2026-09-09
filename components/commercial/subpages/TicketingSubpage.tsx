"use client";

import { DollarSign, Heart, Minus, Percent, Plus, Sparkles, Ticket, TrendingUp, Users, ChevronRight } from "lucide-react";
import { calculateTicketingProjection, type CommercialState, type TicketingState, type TicketPricingTier } from "@/lib/logic/commercialSystem";
import type { TeamSupporterView } from "@/lib/logic/supporters";

interface Props {
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  supporterView?: TeamSupporterView;
  onNavigateToSupporters?: () => void;
  onUpdateState: (state: CommercialState) => void;
}
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function TicketingSubpage({
  state,
  stadiumCapacity,
  stadiumName,
  supporterView,
  onNavigateToSupporters,
  onUpdateState,
}: Props) {
  const { ticketing } = state;
  const supporterContext = supporterView
    ? {
        supporterHappiness: supporterView.overallHappiness,
        squadApproval: supporterView.categoryApproval.squad,
        homeAtmosphere: supporterView.homeAtmosphere,
        topPlayerApproval: supporterView.popularPlayers?.[0]?.approval,
      }
    : undefined;

  const projection = calculateTicketingProjection(ticketing, stadiumCapacity, supporterContext);
  const update = (next: TicketingState) => {
    const totals = calculateTicketingProjection(next, stadiumCapacity, supporterContext);
    onUpdateState({ ...state, ticketing: { ...next, gateReceiptsSeasonTotalCr: totals.gateReceiptsSeasonTotalCr } });
  };
  const changePrice = (id: TicketPricingTier["id"], delta: number) => update({ ...ticketing, tiers: ticketing.tiers.map((tier) => tier.id === id ? { ...tier, currentPriceInr: Math.max(200, Math.min(25_000, tier.currentPriceInr + delta)) } : tier) });
  const changeQuota = (delta: number) => {
    const allocatedSeats = Math.max(1_000, Math.min(Math.round(stadiumCapacity * .4), ticketing.seasonTickets.allocatedSeats + Math.round(stadiumCapacity * delta / 100)));
    const soldCount = Math.round(allocatedSeats * .94);
    update({ ...ticketing, seasonTickets: { ...ticketing.seasonTickets, allocatedSeats, soldCount, totalRevenueCr: Number((soldCount * ticketing.seasonTickets.pricePerSeasonInr / 10_000_000).toFixed(2)) } });
  };
  const changeMembershipPrice = (delta: number) => {
    const pricePerSeasonInr = Math.max(5_000, Math.min(100_000, ticketing.seasonTickets.pricePerSeasonInr + delta));
    update({ ...ticketing, seasonTickets: { ...ticketing.seasonTickets, pricePerSeasonInr, totalRevenueCr: Number((ticketing.seasonTickets.soldCount * pricePerSeasonInr / 10_000_000).toFixed(2)) } });
  };

  const topPlayer = supporterView?.popularPlayers?.[0];
  const supporterGateBonus = supporterView
    ? Number((((supporterView.overallHappiness - 50) * 0.4) + (((topPlayer?.approval ?? 50) - 50) * 0.2)).toFixed(1))
    : 0;

  const kpis = [
    ["Stadium capacity", stadiumCapacity.toLocaleString("en-GB"), stadiumName, Users, "text-accent"],
    ["Projected occupancy", `${projection.projectedOccupancyPercent}%`, `${projection.regularMatchdaySeats.toLocaleString("en-GB")} matchday seats`, Percent, "text-blue-400"],
    ["Average home gate", `₹${projection.averageGatePerHomeMatchCr.toFixed(2)} Cr`, `${money(projection.weightedBasePriceInr)} weighted price`, DollarSign, "text-emerald-400"],
    ["Season ticketing", `₹${projection.totalTicketingRevenueCr.toFixed(2)} Cr`, "Gate receipts + memberships", TrendingUp, "text-amber-400"],
  ] as const;

  return (
    <div className="grid min-h-[650px] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4">
      {/* Top summary KPIs */}
      <section className="grid grid-cols-4 gap-3">
        {kpis.map(([label, value, detail, Icon, tone]) => (
          <div key={label} className="rounded-lg border-2 border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{label}</span>
              <Icon className={`size-4 ${tone}`} />
            </div>
            <div className="mt-2 font-anton text-[20px] leading-none text-text-primary">{value}</div>
            <div className="mt-1 truncate text-[9px] text-text-secondary">{detail}</div>
          </div>
        ))}
      </section>

      {/* Supporter Sentiment & Crowd Elasticity Banner */}
      {supporterView && (
        <section className="rounded-lg border border-border/80 bg-surface p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded bg-rose-500/10 text-rose-400">
                <Heart className="size-4 fill-rose-400/20" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Supporter Dynamics & Matchday Demand Synergy
                </h3>
                <p className="text-[10px] text-text-secondary">
                  Fan happiness and star player approval dynamically adjust crowd elasticity and box-office turnouts.
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

          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border/50 bg-surface-secondary/30 p-2">
              <span className="font-space-mono text-[7px] uppercase text-text-secondary">Supporter Mood</span>
              <div className="mt-0.5 text-xs font-bold text-text-primary">
                {supporterView.mood} ({supporterView.overallHappiness}%)
              </div>
            </div>
            <div className="rounded border border-border/50 bg-surface-secondary/30 p-2">
              <span className="font-space-mono text-[7px] uppercase text-text-secondary">Squad Approval</span>
              <div className="mt-0.5 text-xs font-bold text-blue-400">
                {supporterView.categoryApproval.squad}%
              </div>
            </div>
            <div className="rounded border border-border/50 bg-surface-secondary/30 p-2">
              <span className="font-space-mono text-[7px] uppercase text-text-secondary">Gate Demand Pull</span>
              <div className={`mt-0.5 text-xs font-bold ${supporterGateBonus >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {supporterGateBonus >= 0 ? "+" : ""}{supporterGateBonus}% elasticity
              </div>
            </div>
            <div className="rounded border border-border/50 bg-surface-secondary/30 p-2">
              <span className="font-space-mono text-[7px] uppercase text-text-secondary">Top Crowd Puller</span>
              <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-amber-400 truncate">
                <Sparkles className="size-3 shrink-0" />
                <span className="truncate">{topPlayer ? `${topPlayer.name} (${topPlayer.approval}%)` : "Squad Collective"}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid min-h-0 grid-cols-[minmax(0,1.7fr)_minmax(260px,.8fr)] gap-4">
        <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h2 className="font-anton text-[17px] uppercase text-text-primary">Matchday pricing</h2>
              <p className="text-[9px] text-text-secondary">Prices feed the shared attendance and gate projection.</p>
            </div>
            <span className="rounded bg-accent/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">4 tiers</span>
          </div>
          <div className="mt-3 grid min-h-0 flex-1 grid-rows-4 gap-2">
            {ticketing.tiers.map((tier) => {
              const seats = Math.round(projection.regularMatchdaySeats * tier.capacityShare);
              const delta = tier.currentPriceInr - tier.basePriceInr;
              return (
                <div key={tier.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded border border-border/70 bg-surface-secondary/30 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold text-text-primary">{tier.label}</div>
                    <div className="mt-0.5 font-space-mono text-[7px] text-text-secondary">
                      {Math.round(tier.capacityShare * 100)}% · {seats.toLocaleString("en-GB")} seats · base {money(tier.basePriceInr)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-space-mono text-[11px] font-bold text-text-primary">{money(tier.currentPriceInr)}</div>
                    <div className={`font-space-mono text-[7px] ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-text-secondary"}`}>
                      {delta === 0 ? "At baseline" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => changePrice(tier.id, -100)} aria-label={`Reduce ${tier.label} price`} className="flex size-7 items-center justify-center rounded border border-border hover:border-accent">
                      <Minus className="size-3" />
                    </button>
                    <button type="button" onClick={() => changePrice(tier.id, 100)} aria-label={`Increase ${tier.label} price`} className="flex size-7 items-center justify-center rounded border border-border hover:border-accent">
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="font-anton text-[17px] uppercase text-text-primary">Season memberships</h2>
            <Ticket className="size-4 text-accent" />
          </div>
          <div className="mt-3 grid flex-1 grid-rows-4 gap-2 text-[9px]">
            <div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3">
              <span className="text-text-secondary">Allocated quota</span>
              <b>{ticketing.seasonTickets.allocatedSeats.toLocaleString("en-GB")} ({Math.round(ticketing.seasonTickets.allocatedSeats / stadiumCapacity * 100)}%)</b>
            </div>
            <div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3">
              <span className="text-text-secondary">Members</span>
              <b>{ticketing.seasonTickets.soldCount.toLocaleString("en-GB")}</b>
            </div>
            <div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3">
              <span className="text-text-secondary">Renewal</span>
              <b className="text-emerald-400">{ticketing.seasonTickets.renewalRate}%</b>
            </div>
            <div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3">
              <span className="text-text-secondary">Upfront revenue</span>
              <b className="text-accent">₹{ticketing.seasonTickets.totalRevenueCr.toFixed(2)} Cr</b>
            </div>
          </div>
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Quota</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => changeQuota(-2)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">−2%</button>
                <button type="button" onClick={() => changeQuota(2)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">+2%</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Price · {money(ticketing.seasonTickets.pricePerSeasonInr)}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => changeMembershipPrice(-500)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">−₹500</button>
                <button type="button" onClick={() => changeMembershipPrice(500)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">+₹500</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border-2 border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-anton text-[17px] uppercase text-text-primary">Fixture demand bands</h2>
            <p className="text-[9px] text-text-secondary">Dynamic opponent tiers scale the ticket baseline.</p>
          </div>
          <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Mix: 20% / 35% / 45%</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(ticketing.matchCategories).map((category) => (
            <div key={category.id} className="rounded border border-border/70 bg-surface-secondary/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-text-primary">{category.label}</span>
                <span className="rounded bg-accent/10 px-2 py-0.5 font-space-mono text-[8px] font-bold text-accent">{category.priceMultiplier}×</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-space-mono text-[8px]">
                <span className="text-text-secondary">Demand uplift</span>
                <b className="text-emerald-400">+{category.demandBonus}%</b>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
