"use client";

import { DollarSign, Minus, Percent, Plus, Ticket, TrendingUp, Users } from "lucide-react";
import { calculateTicketingProjection, type CommercialState, type TicketingState, type TicketPricingTier } from "@/lib/logic/commercialSystem";

interface Props { state: CommercialState; stadiumCapacity: number; stadiumName: string; onUpdateState: (state: CommercialState) => void; }
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function TicketingSubpage({ state, stadiumCapacity, stadiumName, onUpdateState }: Props) {
  const { ticketing } = state;
  const projection = calculateTicketingProjection(ticketing, stadiumCapacity);
  const update = (next: TicketingState) => {
    const totals = calculateTicketingProjection(next, stadiumCapacity);
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
  const kpis = [
    ["Stadium capacity", stadiumCapacity.toLocaleString("en-GB"), stadiumName, Users, "text-accent"],
    ["Projected occupancy", `${projection.projectedOccupancyPercent}%`, `${projection.regularMatchdaySeats.toLocaleString("en-GB")} matchday seats`, Percent, "text-blue-400"],
    ["Average home gate", `₹${projection.averageGatePerHomeMatchCr.toFixed(2)} Cr`, `${money(projection.weightedBasePriceInr)} weighted price`, DollarSign, "text-emerald-400"],
    ["Season ticketing", `₹${projection.totalTicketingRevenueCr.toFixed(2)} Cr`, "Gate receipts + memberships", TrendingUp, "text-amber-400"],
  ] as const;

  return <div className="grid min-h-[650px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
    <section className="grid grid-cols-4 gap-3">{kpis.map(([label, value, detail, Icon, tone]) => <div key={label} className="rounded-lg border-2 border-border bg-surface p-3"><div className="flex items-center justify-between"><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{label}</span><Icon className={`size-4 ${tone}`} /></div><div className="mt-2 font-anton text-[20px] leading-none text-text-primary">{value}</div><div className="mt-1 truncate text-[9px] text-text-secondary">{detail}</div></div>)}</section>

    <div className="grid min-h-0 grid-cols-[minmax(0,1.7fr)_minmax(260px,.8fr)] gap-4">
      <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4"><div className="flex items-center justify-between border-b border-border pb-2"><div><h2 className="font-anton text-[17px] uppercase text-text-primary">Matchday pricing</h2><p className="text-[9px] text-text-secondary">Prices feed the shared attendance and gate projection.</p></div><span className="rounded bg-accent/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">4 tiers</span></div>
        <div className="mt-3 grid min-h-0 flex-1 grid-rows-4 gap-2">{ticketing.tiers.map((tier) => { const seats = Math.round(projection.regularMatchdaySeats * tier.capacityShare); const delta = tier.currentPriceInr - tier.basePriceInr; return <div key={tier.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded border border-border/70 bg-surface-secondary/30 px-3 py-2"><div className="min-w-0"><div className="truncate text-[10px] font-bold text-text-primary">{tier.label}</div><div className="mt-0.5 font-space-mono text-[7px] text-text-secondary">{Math.round(tier.capacityShare * 100)}% · {seats.toLocaleString("en-GB")} seats · base {money(tier.basePriceInr)}</div></div><div className="text-right"><div className="font-space-mono text-[11px] font-bold text-text-primary">{money(tier.currentPriceInr)}</div><div className={`font-space-mono text-[7px] ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-text-secondary"}`}>{delta === 0 ? "At baseline" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`}</div></div><div className="flex gap-1"><button type="button" onClick={() => changePrice(tier.id, -100)} aria-label={`Reduce ${tier.label} price`} className="flex size-7 items-center justify-center rounded border border-border hover:border-accent"><Minus className="size-3" /></button><button type="button" onClick={() => changePrice(tier.id, 100)} aria-label={`Increase ${tier.label} price`} className="flex size-7 items-center justify-center rounded border border-border hover:border-accent"><Plus className="size-3" /></button></div></div>; })}</div>
      </section>

      <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4"><div className="flex items-center justify-between border-b border-border pb-2"><h2 className="font-anton text-[17px] uppercase text-text-primary">Season memberships</h2><Ticket className="size-4 text-accent" /></div><div className="mt-3 grid flex-1 grid-rows-4 gap-2 text-[9px]">
        <div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3"><span className="text-text-secondary">Allocated quota</span><b>{ticketing.seasonTickets.allocatedSeats.toLocaleString("en-GB")} ({Math.round(ticketing.seasonTickets.allocatedSeats / stadiumCapacity * 100)}%)</b></div><div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3"><span className="text-text-secondary">Members</span><b>{ticketing.seasonTickets.soldCount.toLocaleString("en-GB")}</b></div><div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3"><span className="text-text-secondary">Renewal</span><b className="text-emerald-400">{ticketing.seasonTickets.renewalRate}%</b></div><div className="flex items-center justify-between rounded bg-surface-secondary/35 px-3"><span className="text-text-secondary">Upfront revenue</span><b className="text-accent">₹{ticketing.seasonTickets.totalRevenueCr.toFixed(2)} Cr</b></div></div>
        <div className="mt-3 space-y-2 border-t border-border pt-3"><div className="flex items-center justify-between"><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Quota</span><div className="flex gap-1"><button type="button" onClick={() => changeQuota(-2)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">−2%</button><button type="button" onClick={() => changeQuota(2)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">+2%</button></div></div><div className="flex items-center justify-between"><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Price · {money(ticketing.seasonTickets.pricePerSeasonInr)}</span><div className="flex gap-1"><button type="button" onClick={() => changeMembershipPrice(-500)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">−₹500</button><button type="button" onClick={() => changeMembershipPrice(500)} className="rounded border border-border px-2 py-1 text-[8px] font-bold">+₹500</button></div></div></div>
      </section>
    </div>

    <section className="rounded-lg border-2 border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-anton text-[17px] uppercase text-text-primary">Fixture demand bands</h2><p className="text-[9px] text-text-secondary">Ready for opponents and dates to drive demand later.</p></div><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Mix: 20% / 35% / 45%</span></div><div className="grid grid-cols-3 gap-3">{Object.values(ticketing.matchCategories).map((category) => <div key={category.id} className="rounded border border-border/70 bg-surface-secondary/30 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-text-primary">{category.label}</span><span className="rounded bg-accent/10 px-2 py-0.5 font-space-mono text-[8px] font-bold text-accent">{category.priceMultiplier}×</span></div><div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-space-mono text-[8px]"><span className="text-text-secondary">Demand uplift</span><b className="text-emerald-400">+{category.demandBonus}%</b></div></div>)}</div></section>
  </div>;
}
