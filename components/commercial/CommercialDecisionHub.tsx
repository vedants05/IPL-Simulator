"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowRight, BadgeIndianRupee, BarChart3, Check, ChevronRight,
  CircleDollarSign, Handshake, Heart, Package, Radio, ShieldCheck, ShoppingBag,
  Sparkles, Ticket, TrendingUp, Users, Wallet,
} from "lucide-react";
import {
  calculateTicketingProjection,
  postCommercialTransaction,
  type CommercialState,
  type OperationCategory,
  type SponsorshipDeal,
} from "@/lib/logic/commercialSystem";
import type { TeamSupporterView } from "@/lib/logic/supporters";

type HubPage = "matchday" | "partnerships" | "retail" | "operations" | "finance";
type Props = {
  page: HubPage;
  state: CommercialState;
  stadiumCapacity: number;
  stadiumName: string;
  supporterView?: TeamSupporterView;
  onNavigateToSupporters?: () => void;
  onUpdateState: (state: CommercialState) => void;
};

const cr = (value: number) => `₹${value.toFixed(2)} Cr`;
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const panel = "rounded-xl border border-border bg-surface shadow-sm";
const eyebrow = "font-space-mono text-[8px] font-bold uppercase tracking-[.14em] text-text-secondary";

function Metric({ label, value, note, tone = "text-text-primary" }: { label: string; value: string; note: string; tone?: string }) {
  return <div className={`${panel} min-w-0 px-3 py-2`}><p className={eyebrow}>{label}</p><p className={`mt-0.5 truncate font-anton text-xl leading-none ${tone}`}>{value}</p><p className="mt-0.5 truncate text-[8px] text-text-secondary">{note}</p></div>;
}

function PageHeader({ icon: Icon, kicker, title, copy, action }: { icon: typeof Ticket; kicker: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="flex h-full shrink-0 items-center justify-between overflow-hidden rounded-xl border border-border bg-[linear-gradient(105deg,var(--surface),color-mix(in_srgb,var(--accent)_9%,var(--surface)))] px-4 shadow-sm"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent"><Icon size={18}/></span><div className="min-w-0"><p className="font-space-mono text-[8px] font-bold uppercase tracking-[.18em] text-accent">{kicker}</p><h2 className="truncate font-anton text-[22px] uppercase leading-none text-text-primary">{title}</h2><p className="mt-0.5 truncate text-[9px] text-text-secondary">{copy}</p></div></div>{action}</header>;
}

function Choice({ active, title, value, detail, onClick, disabled }: { active: boolean; title: string; value: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-0 flex-col justify-between rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-border bg-surface-secondary/25 hover:border-accent/45"}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-text-primary">{title}</span><span className={`flex size-4 items-center justify-center rounded-full border ${active ? "border-accent bg-accent text-white" : "border-border"}`}>{active && <Check size={10}/>}</span></div><p className="mt-2 font-space-mono text-[10px] font-bold text-accent">{value}</p><p className="mt-1 text-[8px] leading-snug text-text-secondary">{detail}</p></button>;
}

export default function CommercialDecisionHub(props: Props) {
  if (props.page === "matchday") return <MatchdayDesk {...props}/>;
  if (props.page === "partnerships") return <PartnershipDesk {...props}/>;
  if (props.page === "retail") return <RetailDesk {...props}/>;
  if (props.page === "operations") return <OperationsDesk {...props}/>;
  return <FinanceDesk {...props}/>;
}

function MatchdayDesk({ state, stadiumCapacity, stadiumName, supporterView, onNavigateToSupporters, onUpdateState }: Props) {
  const context = supporterView ? { overallHappiness: supporterView.overallHappiness, squadApproval: supporterView.categoryApproval.squad, homeAtmosphere: supporterView.homeAtmosphere, topPlayerApproval: supporterView.popularPlayers[0]?.approval } : undefined;
  const projection = calculateTicketingProjection(state.ticketing, stadiumCapacity, context);
  const baseline = state.ticketing.tiers.reduce((sum, tier) => sum + tier.basePriceInr * tier.capacityShare, 0);
  const current = state.ticketing.tiers.reduce((sum, tier) => sum + tier.currentPriceInr * tier.capacityShare, 0);
  const activePricing = current < baseline * .94 ? "access" : current > baseline * 1.11 ? "yield" : "balanced";
  const applyPricing = (id: "access" | "balanced" | "yield", multiplier: number) => {
    const tiers = state.ticketing.tiers.map((tier) => ({ ...tier, currentPriceInr: Math.round(tier.basePriceInr * multiplier / 50) * 50 }));
    const nextTicketing = { ...state.ticketing, tiers };
    const nextProjection = calculateTicketingProjection(nextTicketing, stadiumCapacity, context);
    onUpdateState({ ...state, ticketing: { ...nextTicketing, gateReceiptsSeasonTotalCr: nextProjection.gateReceiptsSeasonTotalCr, projectedGateReceiptsCr: nextProjection.gateReceiptsSeasonTotalCr } });
  };
  const corporateMood = supporterView?.groups.find((group) => group.id === "corporate")?.happiness ?? 65;
  const actual = state.ticketing.actualGateReceiptsCr ?? 0;
  const loungeAverage = state.hospitality.lounges.reduce((sum, lounge) => sum + lounge.dayPassPriceInr, 0) / Math.max(1, state.hospitality.lounges.length);
  const hospitalityStrategy = loungeAverage < 12_000 ? "access" : loungeAverage > 16_000 ? "exclusive" : "balanced";
  const applyHospitality = (strategy: "access" | "balanced" | "exclusive") => {
    const priceMultiplier = strategy === "access" ? .82 : strategy === "exclusive" ? 1.28 : 1;
    const demandAdjustment = strategy === "access" ? 9 : strategy === "exclusive" ? -12 : 0;
    const basePrices: Record<string, number> = { "captains-lounge": 12_500, "presidents-suite": 18_000, "dugout-terrace": 8_500 };
    const lounges = state.hospitality.lounges.map((lounge) => ({
      ...lounge,
      dayPassPriceInr: Math.round((basePrices[lounge.id] ?? lounge.dayPassPriceInr) * priceMultiplier / 100) * 100,
      averageOccupancyPercent: Math.max(45, Math.min(98, Math.round(58 + corporateMood * .38 + demandAdjustment))),
    }));
    const demandShare = Math.max(.25, Math.min(1, .45 + corporateMood / 140 + (strategy === "access" ? .1 : strategy === "exclusive" ? -.12 : 0)));
    const leaseTarget = Math.round(state.hospitality.boxes.length * demandShare);
    const boxes = state.hospitality.boxes.map((box, index) => ({ ...box, leasedSeasonally: index < leaseTarget }));
    const totalHospitalityRevenueCr = Number((boxes.filter((box) => box.leasedSeasonally).reduce((sum, box) => sum + box.leaseAmountSeasonCr, 0) + lounges.reduce((sum, lounge) => sum + lounge.capacity * lounge.averageOccupancyPercent / 100 * lounge.dayPassPriceInr * 7 / 10_000_000, 0)).toFixed(2));
    onUpdateState({ ...state, hospitality: { ...state.hospitality, boxes, lounges, totalHospitalityRevenueCr, vipRetentionRatePercent: Math.max(35, Math.min(98, Math.round(corporateMood + (strategy === "access" ? 8 : strategy === "exclusive" ? -6 : 2)))) } });
  };
  return <div className="grid h-full min-h-0 grid-rows-[64px_72px_minmax(0,1fr)] gap-3">
    <PageHeader icon={Ticket} kicker="Matchday revenue room" title="Demand, Access & Experience" copy={`${stadiumName} · decisions lock into live attendance and match settlements`} action={onNavigateToSupporters && <button onClick={onNavigateToSupporters} className="flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-accent"><Heart size={12}/> Supporters <ChevronRight size={11}/></button>}/>
    <section className="grid grid-cols-4 gap-3"><Metric label="Forecast occupancy" value={`${projection.projectedOccupancyPercent}%`} note={`${projection.regularMatchdaySeats.toLocaleString()} public seats`} tone="text-cyan-400"/><Metric label="Average home gate" value={cr(projection.averageGatePerHomeMatchCr)} note={`${money(projection.weightedBasePriceInr)} weighted ticket`} tone="text-emerald-400"/><Metric label="Realised gate" value={cr(actual)} note={`${state.ticketing.settledMatchIds?.length ?? 0} home matches settled`} tone="text-amber-400"/><Metric label="Demand effect" value={`${(projection.supporterDemandModifierPercent ?? 0) >= 0 ? "+" : ""}${projection.supporterDemandModifierPercent ?? 0}%`} note={`Supporter mood ${supporterView?.overallHappiness ?? 65}/100`} tone="text-rose-400"/></section>
    <main className="grid min-h-0 grid-cols-[1.15fr_.85fr] gap-3">
      <section className={`${panel} grid min-h-0 grid-rows-[auto_1fr] p-4`}><div><p className={eyebrow}>Pricing mandate</p><h3 className="font-anton text-xl uppercase">Choose the gate strategy</h3><p className="text-[9px] text-text-secondary">One clear policy replaces constant tier-by-tier price clicking.</p></div><div className="mt-3 grid min-h-0 grid-cols-3 gap-3"><Choice active={activePricing === "access"} title="Supporter Access" value="−12% price" detail="Prioritise fuller stands, atmosphere and long-term supporter trust." onClick={() => applyPricing("access", .88)}/><Choice active={activePricing === "balanced"} title="Balanced Gate" value="Market price" detail="Protect attendance while keeping dependable matchday yield." onClick={() => applyPricing("balanced", 1)}/><Choice active={activePricing === "yield"} title="Premium Yield" value="+18% price" detail="Higher revenue per seat with a meaningful occupancy risk." onClick={() => applyPricing("yield", 1.18)}/></div></section>
      <section className={`${panel} grid min-h-0 grid-rows-[auto_1fr] p-4`}><div><p className={eyebrow}>Hospitality mandate</p><h3 className="font-anton text-xl uppercase">Price against demand</h3></div><div className="mt-3 grid grid-rows-3 gap-2"><Choice active={hospitalityStrategy === "access"} title="Fill the lounges" value="Accessible pricing" detail="Maximise occupancy and corporate renewal." onClick={() => applyHospitality("access")}/><Choice active={hospitalityStrategy === "balanced"} title="Protect the yield" value="Market pricing" detail="Balance box take-up and day-pass margin." onClick={() => applyHospitality("balanced")}/><Choice active={hospitalityStrategy === "exclusive"} title="Executive scarcity" value="Premium pricing" detail="Higher yield with visible vacancy risk." onClick={() => applyHospitality("exclusive")}/></div></section>
    </main>
  </div>;
}

function PartnershipDesk({ state, stadiumName, onUpdateState }: Props) {
  const [selected, setSelected] = useState(state.sponsorships.deals[0]?.id ?? "");
  const deal = state.sponsorships.deals.find((entry) => entry.id === selected) ?? state.sponsorships.deals[0];
  const offerValue = deal ? Number((deal.annualValueCr * (.92 + state.marketing.brandEquityScore / 500) * (.9 + deal.satisfactionPercent / 500)).toFixed(2)) : 0;
  const renew = (target: SponsorshipDeal) => {
    const deals = state.sponsorships.deals.map((entry) => entry.id === target.id ? { ...entry, annualValueCr: offerValue, yearsRemaining: 3, satisfactionPercent: Math.max(60, entry.satisfactionPercent - 3) } : entry);
    onUpdateState({ ...state, sponsorships: { ...state.sponsorships, deals, totalAnnualSponsorshipCr: Number(deals.reduce((sum, entry) => sum + entry.annualValueCr, 0).toFixed(2)) } });
  };
  return <div className="grid h-full min-h-0 grid-rows-[64px_72px_minmax(0,1fr)] gap-3"><PageHeader icon={Handshake} kicker="Partnership office" title="Contracts, Leverage & Renewal" copy={`${stadiumName} · partner offers react to brand strength and satisfaction`}/><section className="grid grid-cols-4 gap-3"><Metric label="Annual portfolio" value={cr(state.sponsorships.totalAnnualSponsorshipCr)} note={`${state.sponsorships.deals.length} active partners`} tone="text-emerald-400"/><Metric label="Brand leverage" value={`${state.marketing.brandEquityScore}/100`} note="Controls offer quality" tone="text-cyan-400"/><Metric label="Renewals due" value={`${state.sponsorships.deals.filter((entry) => entry.yearsRemaining <= 1).length}`} note="Contracts with one year left" tone="text-amber-400"/><Metric label="Bonus upside" value={cr(state.sponsorships.deals.reduce((sum, entry) => sum + entry.bonusAmountCr, 0))} note="Performance-contingent" tone="text-purple-400"/></section><main className="grid min-h-0 grid-cols-[.9fr_1.1fr] gap-3"><section className={`${panel} min-h-0 p-3`}><p className={`${eyebrow} mb-2`}>Partner portfolio</p><div className="grid h-[calc(100%-18px)] grid-rows-6 gap-1.5">{state.sponsorships.deals.slice(0,6).map((entry) => <button key={entry.id} onClick={() => setSelected(entry.id)} className={`grid grid-cols-[1fr_auto] items-center rounded-lg border px-3 text-left ${selected === entry.id ? "border-accent bg-accent/10" : "border-border bg-surface-secondary/20"}`}><span className="min-w-0"><b className="block truncate text-[9px]">{entry.partnerName}</b><span className="font-space-mono text-[7px] uppercase text-text-secondary">{entry.category.replaceAll("_", " ")} · {entry.yearsRemaining}y</span></span><b className="font-space-mono text-[9px] text-emerald-400">{cr(entry.annualValueCr)}</b></button>)}</div></section>{deal && <section className={`${panel} flex min-h-0 flex-col p-5`}><div className="flex items-start justify-between"><div><p className={eyebrow}>Negotiation dossier</p><h3 className="mt-1 font-anton text-2xl uppercase">{deal.partnerName}</h3><p className="text-[9px] text-text-secondary">The partner—not the player—sets the commercial offer.</p></div><span className="rounded-lg bg-emerald-500/10 px-3 py-2 font-space-mono text-[9px] font-bold text-emerald-400">{deal.satisfactionPercent}% satisfied</span></div><div className="my-4 grid grid-cols-3 gap-2"><Metric label="Current" value={cr(deal.annualValueCr)} note={`${deal.yearsRemaining} years left`}/><Metric label="Offer" value={cr(offerValue)} note="Three-year term" tone="text-accent"/><Metric label="Bonus" value={cr(deal.bonusAmountCr)} note={deal.bonusTrigger}/></div><div className="mt-auto rounded-xl border border-accent/25 bg-accent/5 p-4"><div className="flex items-center justify-between"><div><p className={eyebrow}>Formal renewal proposal</p><p className="mt-1 text-[10px] font-bold">Three seasons · {cr(offerValue)} annually</p></div><button onClick={() => renew(deal)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-space-mono text-[8px] font-bold uppercase text-white">Accept offer <ArrowRight size={12}/></button></div></div></section>}</main></div>;
}

function RetailDesk({ state, supporterView, onUpdateState }: Props) {
  const popularity = supporterView?.popularPlayers[0]?.approval ?? 65;
  const mood = supporterView?.overallHappiness ?? 65;
  const [strategy, setStrategy] = useState<"volume" | "balanced" | "premium">("balanced");
  const applyRetail = (nextStrategy: typeof strategy, margin: number, demand: number) => {
    setStrategy(nextStrategy);
    const fanFactor = .7 + mood / 200 + popularity / 300;
    const catalog = state.merchandising.catalog.map((item) => {
      const retailPriceInr = Math.round(item.productionCostInr * margin / 10) * 10;
      const unitsSoldSeason = Math.min(item.stockLevel, Math.round(item.projectedAnnualSales * demand * fanFactor));
      return { ...item, retailPriceInr, unitsSoldSeason };
    });
    const revenue = catalog.reduce((sum, item) => sum + item.retailPriceInr * item.unitsSoldSeason / 10_000_000, 0);
    const cost = catalog.reduce((sum, item) => sum + item.productionCostInr * item.unitsSoldSeason / 10_000_000, 0);
    onUpdateState({ ...state, merchandising: { ...state.merchandising, catalog, totalMerchRevenueCr: Number(revenue.toFixed(2)), totalMerchCostCr: Number(cost.toFixed(2)), grossMerchProfitCr: Number((revenue-cost).toFixed(2)) } });
  };
  const reorder = () => {
    const costCr = Number((state.merchandising.catalog.reduce((sum, item) => sum + item.productionCostInr * 1500, 0) / 10_000_000).toFixed(2));
    if (state.finance.currentCashBalanceCr < costCr) return;
    const stocked = { ...state, merchandising: { ...state.merchandising, catalog: state.merchandising.catalog.map((item) => ({ ...item, stockLevel: item.stockLevel + 1500 })) } };
    onUpdateState(postCommercialTransaction(stocked, { id: `tx-stock-${state.season}-${state.finance.transactions.length}`, date: `${state.season}-03-01`, type: "debit", category: "merchandise", description: "Retail inventory production order", amountCr: costCr }));
  };
  const toggleCampaign = (id: string) => {
    const campaigns = state.marketing.campaigns.map((item) => item.id === id ? { ...item, active: !item.active } : item);
    const annualMarketingBudgetCr = Number(campaigns.filter((item) => item.active).reduce((sum, item) => sum + item.budgetCr, 0).toFixed(2));
    onUpdateState({ ...state, marketing: { ...state.marketing, campaigns, annualMarketingBudgetCr } });
  };
  return <div className="grid h-full min-h-0 grid-rows-[64px_72px_minmax(0,1fr)] gap-3"><PageHeader icon={ShoppingBag} kicker="Retail & growth studio" title="Demand, Inventory & Reach" copy="Supporter appetite and price elasticity now determine sell-through" action={<button onClick={reorder} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-white"><Package size={12}/> Order inventory</button>}/><section className="grid grid-cols-4 gap-3"><Metric label="Retail revenue" value={cr(state.merchandising.totalMerchRevenueCr)} note="Demand-adjusted sales" tone="text-emerald-400"/><Metric label="Gross profit" value={cr(state.merchandising.grossMerchProfitCr)} note="After production cost" tone="text-cyan-400"/><Metric label="Supporter pulse" value={`${mood}/100`} note={`Star pull ${popularity}/100`} tone="text-rose-400"/><Metric label="Campaign spend" value={cr(state.marketing.annualMarketingBudgetCr)} note={`${state.marketing.campaigns.filter((item) => item.active).length} live campaigns`} tone="text-amber-400"/></section><main className="grid min-h-0 grid-cols-[1fr_1fr] gap-3"><section className={`${panel} grid min-h-0 grid-rows-[auto_1fr] p-4`}><div><p className={eyebrow}>Retail mandate</p><h3 className="font-anton text-xl uppercase">Choose positioning</h3></div><div className="mt-3 grid grid-cols-3 gap-2"><Choice active={strategy === "volume"} title="Mass Market" value="2.05× cost" detail="More units, thinner margin." onClick={() => applyRetail("volume",2.05,1.12)}/><Choice active={strategy === "balanced"} title="Core Range" value="2.75× cost" detail="Balanced margin and reach." onClick={() => applyRetail("balanced",2.75,.94)}/><Choice active={strategy === "premium"} title="Premium Drop" value="3.55× cost" detail="High margin, lower volume." onClick={() => applyRetail("premium",3.55,.72)}/></div></section><section className={`${panel} min-h-0 p-4`}><div className="flex items-center justify-between"><div><p className={eyebrow}>Campaign slate</p><h3 className="font-anton text-xl uppercase">Fund outcomes</h3></div><span className="text-[8px] text-text-secondary">Diminishing reach returns</span></div><div className="mt-3 grid h-[calc(100%-40px)] grid-rows-3 gap-2">{state.marketing.campaigns.slice(0,3).map((campaign) => <button key={campaign.id} onClick={() => toggleCampaign(campaign.id)} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 text-left ${campaign.active ? "border-accent/50 bg-accent/8" : "border-border bg-surface-secondary/20 opacity-65"}`}><span className={`flex size-7 items-center justify-center rounded-lg ${campaign.active ? "bg-accent text-white" : "bg-surface-secondary"}`}><Radio size={13}/></span><span><b className="block text-[9px]">{campaign.name}</b><span className="text-[7px] text-text-secondary">{campaign.channel.replaceAll("_", " ")}</span></span><b className="font-space-mono text-[8px]">{cr(campaign.budgetCr)}</b></button>)}</div></section></main></div>;
}

function OperationsDesk({ state, onUpdateState }: Props) {
  const [category, setCategory] = useState<OperationCategory>("sports_science");
  const programme = state.operations.programmes[category];
  const overheadPolicy = state.operatingCosts.administrativeCorporateCr < 10 ? "lean" : state.operatingCosts.administrativeCorporateCr > 15 ? "premium" : "balanced";
  const applyOverheadPolicy = (policy: "lean" | "balanced" | "premium") => {
    const presets = {
      lean: { coachingStaffSalariesCr: 13.2, travelAndHotelsCr: 10.8, stadiumAndTurfUpkeepCr: 9.4, administrativeCorporateCr: 8.6 },
      balanced: { coachingStaffSalariesCr: 16.5, travelAndHotelsCr: 14.2, stadiumAndTurfUpkeepCr: 11.8, administrativeCorporateCr: 12.4 },
      premium: { coachingStaffSalariesCr: 20.5, travelAndHotelsCr: 18.6, stadiumAndTurfUpkeepCr: 15.2, administrativeCorporateCr: 17.5 },
    }[policy];
    const operatingCosts = { ...state.operatingCosts, ...presets };
    operatingCosts.totalOperatingCostsCr = Number((operatingCosts.squadSalariesCr + operatingCosts.coachingStaffSalariesCr + operatingCosts.travelAndHotelsCr + operatingCosts.stadiumAndTurfUpkeepCr + operatingCosts.administrativeCorporateCr).toFixed(2));
    onUpdateState({ ...state, operatingCosts });
  };
  const sign = (tierId: string) => {
    const tier = programme.tierOptions.find((entry) => entry.id === tierId);
    if (!tier || tier.id === programme.activeTierId || state.finance.currentCashBalanceCr < tier.setupCostCr || state.marketing.brandEquityScore < tier.reputationRequired) return;
    const programmes = { ...state.operations.programmes, [category]: { ...programme, activeTierId: tierId } };
    const totalAnnualOperatingInvestmentCr = Number(Object.values(programmes).reduce((sum, item) => sum + (item.tierOptions.find((entry) => entry.id === item.activeTierId)?.annualCostCr ?? 0), 0).toFixed(2));
    let next = { ...state, operations: { programmes, totalAnnualOperatingInvestmentCr } };
    if (tier.setupCostCr > 0) next = postCommercialTransaction(next, { id: `tx-operation-${state.season}-${category}-${tier.id}`, date: `${state.season}-03-01`, type: "debit", category: "operations", description: `${tier.providerOrPartner} setup and retainer`, amountCr: tier.setupCostCr });
    onUpdateState(next);
  };
  return <div className="grid h-full min-h-0 grid-rows-[64px_72px_minmax(0,1fr)] gap-3"><PageHeader icon={Activity} kicker="Club operations" title="Performance Investment Board" copy="Sporting departments are funded here; their effects resolve in their own systems"/><section className="grid grid-cols-4 gap-3">{(Object.keys(state.operations.programmes) as OperationCategory[]).map((key) => { const item=state.operations.programmes[key]; const tier=item.tierOptions.find((entry)=>entry.id===item.activeTierId)!; return <button key={key} onClick={()=>setCategory(key)} className={`${panel} p-3 text-left ${category===key ? "border-accent ring-1 ring-accent/30" : ""}`}><p className={eyebrow}>{item.name}</p><p className="mt-1 truncate text-[10px] font-bold">{tier.name}</p><p className="mt-1 font-space-mono text-[9px] text-accent">{cr(tier.annualCostCr)}/yr</p></button>;})}</section><main className={`${panel} grid min-h-0 grid-cols-[.72fr_1.28fr] gap-4 p-4`}><section className="flex min-h-0 flex-col rounded-xl bg-surface-secondary/25 p-4"><p className={eyebrow}>Selected department</p><h3 className="mt-1 font-anton text-2xl uppercase">{programme.name}</h3><p className="mt-2 text-[9px] leading-relaxed text-text-secondary">Contracts are gated by reputation and available cash. Setup fees are charged immediately; annual costs remain in the forecast.</p><div className="mt-3 rounded-lg border border-border p-3"><p className={eyebrow}>Available cash</p><p className="mt-1 font-anton text-2xl text-emerald-400">{cr(state.finance.currentCashBalanceCr)}</p></div><div className="mt-auto"><p className={`${eyebrow} mb-2`}>Club overhead policy</p><div className="grid grid-cols-3 gap-1.5">{(["lean","balanced","premium"] as const).map((policy)=><button key={policy} onClick={()=>applyOverheadPolicy(policy)} className={`rounded-lg border py-2 font-space-mono text-[7px] font-bold uppercase ${overheadPolicy===policy ? "border-accent bg-accent text-white" : "border-border bg-surface"}`}>{policy}</button>)}</div></div></section><section className="grid min-h-0 grid-cols-3 gap-3">{programme.tierOptions.map((tier) => { const active=tier.id===programme.activeTierId; const eligible=state.marketing.brandEquityScore>=tier.reputationRequired && state.finance.currentCashBalanceCr>=tier.setupCostCr; return <div key={tier.id} className={`flex min-h-0 flex-col rounded-xl border p-4 ${active ? "border-accent bg-accent/8" : "border-border bg-surface-secondary/20"}`}><div className="flex items-center justify-between"><span className="rounded bg-surface-secondary px-2 py-1 font-space-mono text-[7px] font-bold uppercase">{tier.providerOrPartner}</span>{active && <Check size={14} className="text-accent"/>}</div><h4 className="mt-3 text-[11px] font-bold">{tier.name}</h4><p className="mt-1 font-space-mono text-[9px] text-accent">{cr(tier.annualCostCr)}/yr · {cr(tier.setupCostCr)} setup</p><p className="mt-2 text-[8px] leading-relaxed text-text-secondary">{tier.impactSummary}</p><button disabled={active||!eligible} onClick={()=>sign(tier.id)} className="mt-auto rounded-lg bg-accent px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-white disabled:bg-surface-secondary disabled:text-text-secondary">{active ? "Active contract" : !eligible ? `Needs ${tier.reputationRequired} brand / cash` : "Sign contract"}</button></div>;})}</section></main></div>;
}

function FinanceDesk({ state }: Props) {
  const [scenario, setScenario] = useState(4);
  const prizes: Record<number, number> = {1:20,2:12.5,3:7,4:6.5,5:0};
  const projectedPrize = prizes[scenario] ?? 0;
  const forecastBroadcast = state.broadcast.centralPoolShareCr + state.broadcast.tvViewershipBonusCr + state.broadcast.overseasRightsShareCr + projectedPrize;
  const projectedGate = state.ticketing.projectedGateReceiptsCr ?? state.ticketing.gateReceiptsSeasonTotalCr;
  return <div className="grid h-full min-h-0 grid-rows-[64px_72px_minmax(0,1fr)] gap-3"><PageHeader icon={Wallet} kicker="Finance & rights" title="Cash, Forecast & Audit" copy="Forecast scenarios never alter recognised income or cash"/><section className="grid grid-cols-4 gap-3"><Metric label="Cash balance" value={cr(state.finance.currentCashBalanceCr)} note="Posted transactions only" tone="text-emerald-400"/><Metric label="Projected finish" value={`P${scenario}`} note={`${cr(projectedPrize)} possible prize`} tone="text-amber-400"/><Metric label="Broadcast forecast" value={cr(forecastBroadcast)} note="Central pool, rights and scenario" tone="text-cyan-400"/><Metric label="Projected gate" value={cr(projectedGate)} note={`${cr(state.ticketing.actualGateReceiptsCr ?? 0)} realised`} tone="text-purple-400"/></section><main className="grid min-h-0 grid-cols-[.72fr_1.28fr] gap-3"><section className={`${panel} p-4`}><p className={eyebrow}>Scenario laboratory</p><h3 className="font-anton text-xl uppercase">Prize outlook</h3><p className="mt-1 text-[8px] text-text-secondary">Planning only—selecting a finish cannot create revenue.</p><div className="mt-4 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((rank)=><button key={rank} onClick={()=>setScenario(rank)} className={`rounded-lg border py-3 font-anton text-lg ${scenario===rank ? "border-accent bg-accent text-white" : "border-border bg-surface-secondary/30"}`}>P{rank}</button>)}</div><div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4"><p className={eyebrow}>Scenario end cash</p><p className="mt-1 font-anton text-3xl text-accent">{cr(state.finance.projectedEndSeasonCashCr + projectedPrize - state.broadcast.currentProjectedPrizeCr)}</p></div></section><section className={`${panel} flex min-h-0 flex-col p-4`}><div className="flex items-center justify-between"><div><p className={eyebrow}>Verified ledger</p><h3 className="font-anton text-xl uppercase">Latest movements</h3></div><ShieldCheck size={18} className="text-emerald-400"/></div><div className="mt-3 grid min-h-0 flex-1 grid-rows-6 gap-1.5">{state.finance.transactions.slice(0,6).map((entry)=><div key={entry.id} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-lg border border-border bg-surface-secondary/20 px-3"><span className="font-space-mono text-[7px] text-text-secondary">{entry.date}</span><span className="truncate text-[8px] font-semibold">{entry.description}</span><b className={`font-space-mono text-[8px] ${entry.type==="credit" ? "text-emerald-400" : "text-rose-400"}`}>{entry.type==="credit" ? "+" : "−"}{cr(entry.amountCr)}</b></div>)}</div></section></main></div>;
}
