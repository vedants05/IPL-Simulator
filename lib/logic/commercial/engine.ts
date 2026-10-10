import type { Player } from "../../types";
import { createDefaultCommercialState, OPERATION_PROGRAMME_DEFINITIONS, type CommercialState, type OperationCategory } from "../commercialDefaults";
import { getMiniAuctionContractPrice } from "../miniAuctionRetention";
import type { BusinessContext, BusinessState, Command, Desk, Experience, FixturePlan, MatchForecast, Payment, Result } from "./types";
export * from "./types";
export const inr = (cr: number) => Math.round(cr * 10000000);
export const cr = (rupees: number) => rupees / 10000000;
export function contractPayroll(players: Player[], teamId: string, season: number) {
    return Math.round(players.reduce((sum, p) => sum + ((p.currentTeamId === teamId && p.openingContractSeason === season ? p.openingContractPrice : undefined) ?? p.iplHistory.find(h => h.season === String(season) && h.teamId === teamId)?.price ?? getMiniAuctionContractPrice(p, teamId, season) ?? p.basePrice), 0) * 100000);
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const desks: Desk[] = ["matchday", "partnerships", "retail", "operations", "finance"];
export const storageKey = (saveId: string, team: string, season: number) => `ipl_commercial_state_${saveId}_${team.toLowerCase()}_${season}`;
const subscribers = new Set<() => void>();
export function subscribeBusiness(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
export function notifyBusiness() {
    subscribers.forEach(listener => listener());
    if (typeof window !== "undefined")
        window.dispatchEvent(new Event("ipl-commercial-changed"));
}
function post(s: BusinessState, entry: Experience["ledger"][number]) {
    if (s.experience.ledger.some(tx => tx.id === entry.id))
        return;
    if (![entry.amount, entry.expense ?? 0, entry.revenue ?? 0].every(Number.isSafeInteger))
        throw new Error("Invalid financial amount.");
    s.experience.ledger.push(entry);
    s.experience.cash += entry.amount;
}
function payment(s: BusinessState, p: Omit<Payment, "status">) {
    if (!s.experience.payments.some(entry => entry.id === p.id))
        s.experience.payments.push({ ...p, status: "pending" });
}
function contractPayments(s: BusinessState, id: string, annual: number, category: string, description: string, start = `${s.season}-03-01`) {
    for (let month = 0; month < 3; month++) {
        const date = [`${s.season}-03-15`, `${s.season}-04-15`, `${s.season}-05-15`][month];
        const amount = month === 2 ? annual - Math.round(annual / 3) * 2 : Math.round(annual / 3);
        payment(s, { id: `${id}-${s.season}-${month}`, date: date < start ? start : date, amount, category, description, sourceId: id });
    }
}
function schedule(s: BusinessState, context: BusinessContext) {
    const x = s.experience;
    if (x.seasonClosed)
        return;
    const payroll = context.playerPayroll ?? inr(s.operatingCosts.squadSalariesCr);
    const staff = context.staffPayroll ?? inr(s.operatingCosts.coachingStaffSalariesCr);
    const overhead = inr(s.operatingCosts.stadiumAndTurfUpkeepCr + s.operatingCosts.administrativeCorporateCr);
    // Travel is owned by the logistics contract, rather than charged twice.
    for (const [id, amount, category, label] of [["squad", payroll, "payroll", "Player contract payroll"], ["staff", staff, "payroll", "Staff contract payroll"], ["overhead", overhead, "operations", "Stadium upkeep and administration"]] as const) {
        for (let i = 0; i < 3; i++) {
            const date = `${s.season}-0${3 + i}-01`;
            const value = i === 2 ? amount - Math.round(amount / 3) * 2 : Math.round(amount / 3);
            const existing = x.payments.find(p => p.id === `${id}-${s.season}-${i}`);
            if (existing?.status === "pending")
                existing.amount = -value;
            else if (!existing)
                payment(s, { id: `${id}-${s.season}-${i}`, date, amount: -value, category, description: label, sourceId: id });
        }
    }
    payment(s, { id: `rights-open-${s.season}`, date: `${s.season}-03-01`, amount: Math.round(inr(s.broadcast.centralPoolShareCr) * .5), category: "broadcast", description: "Central rights: opening distribution", sourceId: "rights" });
    payment(s, { id: `rights-mid-${s.season}`, date: `${s.season}-04-15`, amount: Math.round(inr(s.broadcast.centralPoolShareCr) * .3), category: "broadcast", description: "Central rights: seven-match milestone", sourceId: "rights", milestone: "matches7" });
    payment(s, { id: `rights-final-${s.season}`, date: `${s.season}-05-31`, amount: Math.round(inr(s.broadcast.centralPoolShareCr) * .2), category: "broadcast", description: "Central rights: tournament settlement", sourceId: "rights", milestone: "seasonend" });
    payment(s, { id: `box-leases-${s.season}`, date: `${s.season}-03-01`, amount: inr(s.hospitality.boxes.filter(b => b.leasedSeasonally).reduce((sum, b) => sum + b.leaseAmountSeasonCr, 0)), category: "hospitality", description: "Corporate box season leases", sourceId: "box-leases" });
    const membership = x.payments.find(p => p.id === `membership-${s.season}`);
    const membershipAmount = s.ticketing.seasonTickets.soldCount * s.ticketing.seasonTickets.pricePerSeasonInr;
    if (membership?.status === "pending")
        membership.amount = membershipAmount;
    else if (!membership)
        payment(s, { id: `membership-${s.season}`, date: `${s.season}-03-01`, amount: membershipAmount, category: "ticketing", description: "Season memberships", sourceId: "memberships" });
    payment(s, { id: `rights-other-${s.season}`, date: `${s.season}-05-31`, amount: inr(s.broadcast.overseasRightsShareCr + s.broadcast.tvViewershipBonusCr), category: "broadcast", description: "International rights and viewership distribution", sourceId: "rights" });
    for (const c of x.contracts.filter(c => c.status === "active" && c.starts <= s.season && c.ends >= s.season))
        contractPayments(s, c.id, c.annual, "sponsorship", `${s.sponsorships.deals.find(d => d.id === c.dealId)?.partnerName ?? c.dealId} sponsorship`);
    for (const p of x.programmes.filter(p => p.status === "active" && p.end >= x.date))
        contractPayments(s, p.id, -p.annual, "operations", `${OPERATION_PROGRAMME_DEFINITIONS[p.category].name} retainer`, p.start);
}
function offers(s: BusinessState) {
    const x = s.experience;
    if (x.seasonClosed)
        return;
    for (const deal of s.sponsorships.deals) {
        const contract = x.contracts.find(c => c.dealId === deal.id && c.status === "active");
        if (contract && contract.ends > s.season)
            continue;
        if (x.offers.some(o => o.dealId === deal.id))
            continue;
        // Valuation is fixed against the season's original portfolio, once per window.
        const factor = clamp(.82 + s.marketing.brandEquityScore / 350 + deal.satisfactionPercent / 650, .9, 1.35);
        x.offers.push({ id: `offer-${s.season}-${deal.id}`, dealId: deal.id, annual: Math.round(inr(deal.annualValueCr) * factor), term: 3, bonus: inr(deal.bonusAmountCr), expires: `${s.season}-06-30`, responseDate: x.date, rounds: 0, status: "open", reason: "Valued from club brand, partner satisfaction and commercial slot." });
    }
}
export function initializeBusiness(seed: CommercialState, date: string, migrated = false): BusinessState {
    const s = copy(seed) as BusinessState;
    const opening = inr(seed.finance.startingCashBalanceCr);
    const x: Experience = { version: 2, revision: 0, date, opening, cash: opening, ledger: [], payments: [], offers: [], contracts: [], orders: [], campaigns: [], programmes: [], policies: { gate: "balanced", hospitality: "balanced", retail: "balanced", multiplier: 1, service: "enhanced" }, fixtures: [], reports: [], decisions: [], processed: [], history: [], delegation: Object.fromEntries(desks.map(d => [d, { mode: "recommend", cap: inr(3), reserve: inr(30), maxTerm: 3, allowedPolicies: ["access", "balanced", "premium"], manualCategories: ["shirt_front", "stadium_naming"] }])) as Experience["delegation"], reminders: {}, initialStock: {}, deliveries: {}, lastSales: {}, lostSales: {}, seasonClosed: false };
    s.experience = x;
    const legacyClosed = migrated && seed.finance.transactions.some(t => t.id.includes("final-tranche"));
    x.seasonClosed = legacyClosed;
    for (const item of s.merchandising.catalog) {
        if (!migrated)
            item.unitsSoldSeason = 0;
        x.initialStock[item.id] = item.stockLevel + (migrated ? item.unitsSoldSeason : 0);
    }
    for (const deal of s.sponsorships.deals)
        x.contracts.push({ id: `contract-${s.season}-${deal.id}`, dealId: deal.id, starts: s.season, ends: s.season + Math.max(0, deal.yearsRemaining - (legacyClosed ? 0 : 1)), annual: inr(deal.annualValueCr), bonus: inr(deal.bonusAmountCr), condition: deal.bonusTrigger.includes("Final") ? "final" : deal.bonusTrigger.includes("Playoff") || deal.bonusTrigger.includes("Top-4") ? "playoffs" : "none", status: deal.yearsRemaining > 0 ? "active" : "expired" });
    for (const [category, p] of Object.entries(s.operations.programmes)) {
        const tier = p.tierOptions.find(t => t.id === p.activeTierId)!;
        x.programmes.push({ id: `programme-${s.season}-${category}`, category: category as OperationCategory, tier: tier.id, start: `${s.season}-03-01`, end: `${s.season}-12-31`, annual: inr(tier.annualCostCr), setup: 0, status: "active" });
    }
    if (migrated) {
        for (const tx of seed.finance.transactions)
            post(s, { id: tx.id, date: tx.date, amount: inr(tx.amountCr) * (tx.type === "credit" ? 1 : -1), category: tx.category, description: tx.description, sourceId: "legacy", revenue: tx.type === "credit" ? inr(tx.amountCr) : 0, expense: tx.type === "debit" ? inr(tx.amountCr) : 0 });
        post(s, { id: "migration-reconciliation", date, amount: inr(seed.finance.currentCashBalanceCr) - x.cash, category: "adjustment", description: "Opening reconciliation: preserves cash from the previous commercial system", sourceId: "migration" });
        x.migration = "Previous cash and transaction history preserved; legacy totals are archived in the backup.";
        x.processed = [...(seed.ticketing.settledMatchIds ?? []).map(id => `match-${id}`)];
    }
    schedule(s, { date, capacity: 45000 });
    if (migrated) {
        // Past obligations were represented by the old opening balance; do not charge them again.
        x.payments.filter(p => p.date <= date && !p.milestone).forEach(p => { p.status = "paid"; });
        for (const p of x.payments.filter(p => p.milestone))
            if (seed.finance.transactions.some(t => (p.milestone === "matches7" && t.id.includes("tranche2")) || (p.milestone === "seasonend" && t.id.includes("final-tranche"))))
                p.status = "paid";
    }
    else {
        for (const p of x.payments.filter(p => p.date <= date && !p.milestone).sort((a, b) => b.amount - a.amount))
            settlePayment(s, p);
    }
    offers(s);
    return reconcile(s);
}
function settlePayment(s: BusinessState, p: Payment) {
    if (p.status !== "pending")
        return;
    post(s, { id: p.id, date: p.date, amount: p.amount, category: p.category, description: p.description, sourceId: p.sourceId, revenue: p.amount > 0 ? p.amount : 0, expense: p.amount < 0 ? -p.amount : 0 });
    p.status = "paid";
}
export function reconcile(s: BusinessState): BusinessState {
    const x = s.experience;
    x.cash = x.opening + x.ledger.reduce((sum, t) => sum + t.amount, 0);
    const income = x.ledger.reduce((sum, t) => sum + (t.revenue ?? 0), 0), expense = x.ledger.reduce((sum, t) => sum + (t.expense ?? 0), 0);
    const remaining = x.payments.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
    s.finance = { ...s.finance, startingCashBalanceCr: cr(x.opening), currentCashBalanceCr: cr(x.cash), totalIncomeCr: cr(income), totalExpenditureCr: cr(expense), netOperatingProfitCr: cr(income - expense), profitMarginPercent: income ? 100 * (income - expense) / income : 0, projectedEndSeasonCashCr: cr(x.cash + remaining), transactions: [...x.ledger].reverse().map(t => ({ id: t.id, date: t.date, type: t.amount >= 0 ? "credit" : "debit", category: t.category as CommercialState["finance"]["transactions"][number]["category"], description: t.description, amountCr: cr(Math.abs(t.amount)) })) };
    s.merchandising.totalMerchRevenueCr = cr(x.ledger.filter(t => t.category === "merchandise").reduce((sum, t) => sum + (t.revenue ?? 0), 0));
    s.merchandising.totalMerchCostCr = cr(x.ledger.filter(t => t.category === "merchandise").reduce((sum, t) => sum + (t.expense ?? 0), 0));
    s.merchandising.grossMerchProfitCr = s.merchandising.totalMerchRevenueCr - s.merchandising.totalMerchCostCr;
    s.sponsorships.totalAnnualSponsorshipCr = cr(x.contracts.filter(c => c.status === "active" && c.starts <= s.season && c.ends >= s.season).reduce((sum, c) => sum + c.annual, 0));
    return s;
}
export function forecastMatch(s: BusinessState, fixture: FixturePlan, context?: BusinessContext): MatchForecast {
    const x = s.experience, capacity = Math.max(0, Math.round(fixture.capacity));
    const vip = Math.min(Math.floor(capacity * .12), s.hospitality.boxes.reduce((sum, b) => sum + b.capacity, 0) + s.hospitality.lounges.reduce((sum, l) => sum + l.capacity, 0) + s.hospitality.premiumPackages.reduce((sum, p) => sum + p.soldPerMatch, 0));
    const members = Math.min(s.ticketing.seasonTickets.soldCount, Math.max(0, capacity - vip));
    const publicSeats = Math.max(0, capacity - vip - members);
    const policy = fixture.policy ?? x.policies.gate;
    const multiplier = fixture.multiplier ?? x.policies.multiplier;
    const base = s.ticketing.tiers.reduce((sum, t) => sum + t.basePriceInr * t.capacityShare, 0);
    const weighted = s.ticketing.tiers.reduce((sum, t) => sum + (fixture.ticketPrices?.[t.id] ?? t.currentPriceInr) * t.capacityShare, 0) * multiplier;
    const ratio = weighted / Math.max(1, base);
    const opp = fixture.opponentId.toLowerCase();
    const category = Object.values(s.ticketing.matchCategories).find(c => c.opponentTeamIds.includes(opp)) ?? s.ticketing.matchCategories.silver;
    const supporters = context?.supporters ?? x.supporters;
    const campaignDemand = x.campaigns.filter(c => c.status === "active" && c.objective === "attendance" && c.start <= fixture.date && c.end >= fixture.date).reduce((sum, c) => sum + Math.sqrt(cr(c.spent)) * .025 * audienceEffect(c.audience, c.objective), 0);
    const serviceLevel = fixture.service ?? x.policies.service;
    const factors = [{ label: "Opponent interest", value: category.demandBonus * .003 }, { label: "Price", value: ratio > 1 ? -(ratio - 1) * .85 : (1 - ratio) * .30 }, { label: "Supporter mood", value: ((supporters?.overallHappiness ?? supporters?.supporterHappiness ?? 65) - 65) * .0014 }, { label: "Squad and star appeal", value: ((supporters?.squadApproval ?? 65) - 65) * .0008 + ((supporters?.topPlayerApproval ?? 65) - 65) * .0006 }, { label: "Atmosphere", value: ((supporters?.homeAtmosphere ?? 65) - 65) * .0005 }, { label: "Service experience", value: serviceLevel === "elite" ? .018 : serviceLevel === "enhanced" ? .008 : 0 }, { label: "Attendance campaigns", value: Math.min(.08, campaignDemand) }, { label: "Weekend", value: [0, 6].includes(new Date(`${fixture.date}T12:00:00Z`).getUTCDay()) ? .025 : 0 }];
    const occupancy = clamp(.80 + factors.reduce((sum, f) => sum + f.value, 0), .20, .99);
    const sold = Math.round(publicSeats * occupancy);
    const hp = fixture.hospitality ?? x.policies.hospitality;
    const hm = hp === "access" ? .85 : hp === "premium" ? 1.25 : 1;
    const prices = fixture.hospitalityPrices ?? x.policies.hospitalityPrices;
    const referenceHospitality = s.hospitality.lounges.reduce((sum, l) => sum + l.capacity * l.dayPassPriceInr, 0) + s.hospitality.premiumPackages.reduce((sum, l) => sum + l.soldPerMatch * l.pricePerPersonInr, 0);
    const chosenHospitality = s.hospitality.lounges.reduce((sum, l) => sum + l.capacity * (prices?.[l.id] ?? l.dayPassPriceInr), 0) + s.hospitality.premiumPackages.reduce((sum, l) => sum + l.soldPerMatch * (prices?.[l.id] ?? l.pricePerPersonInr), 0);
    const vipOccupancy = clamp(.84 * Math.pow(Math.max(.2, chosenHospitality * hm / Math.max(1, referenceHospitality)), -1.25) + ((supporters?.overallHappiness ?? 65) - 65) * .001, .01, .98);
    const vipSold = Math.round(vip * vipOccupancy);
    const gate = Math.round(sold * weighted * category.priceMultiplier);
    const loungeValue = s.hospitality.lounges.reduce((sum, l) => sum + l.capacity * (prices?.[l.id] ?? l.dayPassPriceInr), 0);
    const packageValue = s.hospitality.premiumPackages.reduce((sum, l) => sum + l.soldPerMatch * (prices?.[l.id] ?? l.pricePerPersonInr), 0);
    const configuredVip = s.hospitality.boxes.reduce((sum, b) => sum + b.capacity, 0) + s.hospitality.lounges.reduce((sum, l) => sum + l.capacity, 0) + s.hospitality.premiumPackages.reduce((sum, l) => sum + l.soldPerMatch, 0);
    const hospitality = Math.round((loungeValue + packageValue) * Math.min(1, vip / Math.max(1, configuredVip)) * vipOccupancy * hm);
    const attendance = sold + members + vipSold;
    const inHouse = (fixture.catering ?? x.policies.catering ?? s.matchdayOps.catering.vendorModel) === "in_house_concession";
    const concessions = Math.round(attendance * s.matchdayOps.catering.averageSpendPerFanInr * (inHouse ? 1 : s.matchdayOps.catering.franchiseMarginPercent / 100));
    const service = fixture.service ?? x.policies.service;
    const cost = inr(service === "elite" ? 1.25 : service === "enhanced" ? .95 : .75) + (fixture.eventBudget ?? x.policies.eventBudget ?? 0) + (inHouse ? Math.round(attendance * s.matchdayOps.catering.averageSpendPerFanInr * .72) : 0);
    return { attendance, occupancy: 100 * attendance / Math.max(1, capacity), gate, hospitality, concessions, cost, net: gate + hospitality + concessions - cost, publicSeats, vipSeats: vip, members, range: [Math.max(0, Math.round(attendance * .94)), Math.min(capacity, Math.round(attendance * 1.06))], factors: [...factors, { label: `${policy} policy`, value: 0 }] };
}
export function summary(s: BusinessState, context?: BusinessContext, prize = 0) {
    const x = s.experience;
    const remaining = x.payments.filter(p => p.status === "pending");
    const fixtureCash = x.seasonClosed ? 0 : x.fixtures.filter(f => !f.played && !f.cancelled && !f.neutral && !x.processed.includes(`match-${f.id}`)).reduce((sum, f) => sum + forecastMatch(s, f, context).net, 0);
    const days = x.seasonClosed ? 0 : Math.max(0, Math.min(92, Math.round((Date.parse(`${s.season}-05-31`) - Date.parse(x.date)) / 86400000)));
    const retail = retailForecast(s, context);
    const stockProfit = retail.reduce((sum, r) => sum + Math.min(r.stock, r.daily * days) * (r.price - r.cost), 0);
    const campaignCost = x.campaigns.filter(c => c.status === "active" || c.status === "paused").reduce((sum, c) => sum + Math.max(0, c.budget - c.spent), 0);
    const near = remaining.filter(p => p.amount < 0 && p.date <= addDays(x.date, 30)).reduce((sum, p) => sum - p.amount, 0);
    const reserve = Math.max(...Object.values(x.delegation).map(d => d.reserve));
    const actualIncome = x.ledger.reduce((sum, t) => sum + (t.revenue ?? 0), 0), actualExpense = x.ledger.reduce((sum, t) => sum + (t.expense ?? 0), 0);
    // Inventory purchase cash is already posted. Future sales bring full revenue, not margin.
    const stockRevenue = retail.reduce((sum, r) => sum + Math.min(r.stock, r.daily * days) * r.price, 0);
    return { cash: x.cash, uncommitted: x.cash - near - reserve - campaignCost, actualIncome, actualExpense, profit: actualIncome - actualExpense, pending: remaining, near, reserve, fixtureCash, retailRevenue: stockRevenue, retailProfit: stockProfit, campaignCost, closing: x.cash + remaining.reduce((sum, p) => sum + p.amount, 0) + fixtureCash + stockRevenue - campaignCost + prize };
}
export function retailForecast(s: BusinessState, context?: BusinessContext) {
    const supporters = context?.supporters ?? s.experience.supporters;
    const mood = supporters?.overallHappiness ?? supporters?.supporterHappiness ?? 65, stars = supporters?.topPlayerApproval ?? 65;
    const demandFactor = clamp(.65 + mood / 150 + stars / 400, .5, 1.6);
    const campaignBoost = s.experience.campaigns.filter(c => c.status === "active" && c.spent > 0 && c.start <= s.experience.date && c.end >= s.experience.date && c.objective === "sales").reduce((sum, c) => sum + Math.sqrt(cr(c.spent)) * .04 * audienceEffect(c.audience, c.objective), 0);
    return s.merchandising.catalog.map(item => {
        const reference = item.productionCostInr * 2.75;
        const elasticity = Math.pow(Math.max(.2, item.retailPriceInr / reference), -1.65);
        return { id: item.id, name: item.name, price: item.retailPriceInr, cost: item.productionCostInr, stock: item.stockLevel, daily: Math.max(0, Math.round(item.projectedAnnualSales / 365 * demandFactor * elasticity * (1 + Math.min(.25, campaignBoost)))), margin: item.retailPriceInr - item.productionCostInr };
    });
}
function decision(s: BusinessState, desk: Desk, title: string, detail: string, cost = 0, automatic = false) { s.experience.decisions.push({ id: `decision-${s.season}-${s.experience.date}-${s.experience.decisions.length + 1}`, date: s.experience.date, desk, title, detail, cost, automatic }); }
export function executeCommand(source: BusinessState, command: Command, context: BusinessContext, expectedRevision = source.experience.revision, automatic = false): Result {
    if (expectedRevision !== source.experience.revision)
        return { ok: false, message: "The business changed while you were editing. Refresh the preview and try again." };
    if (source.experience.seasonClosed && !["delegate", "reminder", "campaignStatus", "cancelProgramme", "cancelSponsor"].includes(command.type))
        return { ok: false, message: "This season is closed. Review the statement or advance to the next season." };
    const s = copy(source), x = s.experience;
    const fail = (message: string): Result => ({ ok: false, message });
    const cash = (cost: number) => Number.isSafeInteger(cost) && cost >= 0 && x.cash - cost >= 0;
    const nextId = (prefix: string) => `${prefix}-${s.season}-${x.date}-${x.decisions.length + 1}`;
    let message = "Decision saved.";
    if (command.type === "pricing") {
        if (!Number.isFinite(command.multiplier) || command.multiplier < .5 || command.multiplier > 2)
            return fail("Ticket multiplier must be between 0.5 and 2.");
        if (command.tiers && Object.entries(command.tiers).some(([id, p]) => !s.ticketing.tiers.some(t => t.id === id) || !Number.isSafeInteger(p) || p < 100 || p > 50000))
            return fail("Ticket prices must be whole rupees between 100 and 50,000.");
        const targets = x.fixtures.filter(f => !f.played && !f.cancelled && !f.neutral && !x.processed.includes(`match-${f.id}`) && f.date > x.date && (command.scope === "future" || f.id === command.scope));
        if (command.scope !== "future" && !targets.length)
            return fail("This fixture is locked or completed. Choose a future fixture.");
        if (command.eventBudget !== undefined && (!Number.isSafeInteger(command.eventBudget) || command.eventBudget < 0 || command.eventBudget > inr(2)))
            return fail("Additional event budget must be between zero and ₹2 Cr.");
        if (command.hospitalityPrices && Object.entries(command.hospitalityPrices).some(([id, price]) => ![...s.hospitality.lounges, ...s.hospitality.premiumPackages].some(p => p.id === id) || !Number.isSafeInteger(price) || price < 100 || price > 200000))
            return fail("Hospitality prices must be whole rupees from 100 to 200,000 for an existing package.");
        if (command.allocations) {
            if (x.date >= `${s.season}-03-01` || command.scope !== "future")
                return fail("Seat allocation changes are available for all fixtures during preseason only.");
            const shares = s.ticketing.tiers.map(t => command.allocations?.[t.id] ?? t.capacityShare);
            if (shares.some(n => !Number.isFinite(n) || n < 0 || n > 1) || Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > .00001)
                return fail("Ticket tier allocations must total 100% of public seating.");
            s.ticketing.tiers = s.ticketing.tiers.map((t, i) => ({ ...t, capacityShare: shares[i] }));
        }
        if (command.tiers && command.scope === "future")
            s.ticketing.tiers = s.ticketing.tiers.map(t => ({ ...t, currentPriceInr: command.tiers?.[t.id] ?? t.currentPriceInr }));
        if (command.scope === "future")
            x.policies = { ...x.policies, gate: command.policy, multiplier: command.multiplier, hospitality: command.hospitality, service: command.service, catering: command.catering ?? x.policies.catering, eventBudget: command.eventBudget ?? x.policies.eventBudget, hospitalityPrices: command.hospitalityPrices ?? x.policies.hospitalityPrices };
        targets.forEach(f => { f.policy = command.policy; f.multiplier = command.multiplier; f.hospitality = command.hospitality; f.service = command.service; f.ticketPrices = command.tiers ?? (command.scope === "future" ? undefined : f.ticketPrices); f.catering = command.catering ?? f.catering; f.eventBudget = command.eventBudget ?? f.eventBudget; f.hospitalityPrices = command.hospitalityPrices ?? f.hospitalityPrices; f.forecast = forecastMatch(s, f, context); });
        decision(s, "matchday", "Matchday plan applied", `${targets.length} future fixtures; ${command.policy} gate, ${command.hospitality} hospitality, ${command.service} service`, 0, automatic);
        message = "Matchday plan saved for eligible future fixtures.";
    }
    else if (command.type === "boxLease") {
        if (x.date >= `${s.season}-03-01`)
            return fail("Corporate leases are committed at season opening; review the next preseason window.");
        const box = s.hospitality.boxes.find(b => b.id === command.id);
        if (!box || !Number.isSafeInteger(command.annual) || command.annual < 0 || command.annual > inr(10))
            return fail("Choose an existing box group and a lease up to ₹10 Cr.");
        box.leasedSeasonally = command.leased;
        box.leaseAmountSeasonCr = cr(command.annual);
        const p = x.payments.find(p => p.id === `box-leases-${s.season}`);
        if (p?.status === "pending")
            p.amount = inr(s.hospitality.boxes.filter(b => b.leasedSeasonally).reduce((sum, b) => sum + b.leaseAmountSeasonCr, 0));
        decision(s, "matchday", "Corporate lease terms saved", `${box.name}; ${command.leased ? "season lease" : "unleased"}`);
    }
    else if (command.type === "memberships") {
        if (x.date >= `${s.season}-03-01`)
            return fail("Season memberships are committed when the season opens.");
        if (!Number.isSafeInteger(command.seats) || command.seats < 0 || command.seats > context.capacity * .3 || !Number.isSafeInteger(command.price) || command.price < 1000 || command.price > 100000)
            return fail("Allocate up to 30% of capacity and a price between 1,000 and 100,000 rupees.");
        s.ticketing.seasonTickets = { ...s.ticketing.seasonTickets, allocatedSeats: command.seats, pricePerSeasonInr: command.price, soldCount: Math.round(command.seats * .9), totalRevenueCr: cr(Math.round(command.seats * .9) * command.price) };
        decision(s, "matchday", "Membership allocation saved", `${command.seats} seats at ₹${command.price}`);
    }
    else if (command.type === "retail") {
        const factor = command.policy === "access" ? 2.05 : command.policy === "premium" ? 3.55 : 2.75;
        if (command.prices && Object.entries(command.prices).some(([id, p]) => !s.merchandising.catalog.some(i => i.id === id) || !Number.isSafeInteger(p) || p < 1 || p > 100000))
            return fail("Product prices must be whole rupees between 1 and 100,000.");
        x.policies.retail = command.policy;
        s.merchandising.catalog = s.merchandising.catalog.map(i => ({ ...i, retailPriceInr: command.prices?.[i.id] ?? Math.round(i.productionCostInr * factor / 10) * 10 }));
        decision(s, "retail", "Retail prices updated", `${command.policy} positioning; completed sales unchanged`, 0, automatic);
    }
    else if (command.type === "order") {
        if (!Object.keys(command.lines).length || Object.entries(command.lines).some(([id, n]) => !s.merchandising.catalog.some(i => i.id === id) || !Number.isSafeInteger(n) || n < 0 || n > 100000))
            return fail("Choose valid products and whole quantities up to 100,000.");
        const cost = Math.round(s.merchandising.catalog.reduce((sum, i) => sum + (command.lines[i.id] ?? 0) * i.productionCostInr, 0) * (command.express ? 1.1 : 1));
        if (!cost)
            return fail("Select at least one unit to order.");
        if (!cash(cost))
            return fail("Insufficient cash for this order. Reduce quantities or use standard delivery.");
        const id = nextId("order");
        x.orders.push({ id, placed: x.date, arrival: addDays(x.date, command.express ? 3 : 7), lines: command.lines, cost, status: "transit" });
        post(s, { id, date: x.date, amount: -cost, category: "inventory", description: "Inventory production and delivery", sourceId: id });
        decision(s, "retail", "Inventory ordered", `Delivery ${addDays(x.date, command.express ? 3 : 7)}`, cost, automatic);
        message = "Order placed; stock will arrive on the delivery date.";
    }
    else if (command.type === "accept" || command.type === "counter") {
        const offer = x.offers.find(o => o.id === command.offerId);
        if (!offer || offer.status !== "open" || offer.expires < x.date || offer.responseDate > x.date)
            return fail("This offer is unavailable, expired or awaiting a response.");
        if (command.type === "counter") {
            if (offer.rounds >= 2)
                return fail("The partner has reached its two-round negotiation limit.");
            offer.rounds++;
            offer.responseDate = addDays(x.date, 2);
            if (command.lever === "term") {
                offer.term = Math.min(5, offer.term + 1);
                offer.annual = Math.round(offer.annual * 1.04);
                offer.reason = "Longer term: a 4% annual increase in exchange for another season.";
            }
            if (command.lever === "fee") {
                offer.annual = Math.round(offer.annual * (s.marketing.brandEquityScore >= 70 ? 1.025 : 1));
                offer.bonus = Math.round(offer.bonus * .8);
                offer.reason = s.marketing.brandEquityScore >= 70 ? "Stronger guarantee: 2.5% more annual fee and 20% less bonus upside." : "Partner held the guarantee; reduced bonus flexibility. Consider the existing terms.";
            }
            if (command.lever === "bonus") {
                offer.annual = Math.round(offer.annual * .95);
                offer.bonus = Math.round(offer.bonus * 1.3);
                offer.reason = "Performance weighting: 5% lower guarantee and 30% higher bonus.";
            }
            decision(s, "partnerships", "Counteroffer submitted", offer.reason);
            message = `Partner responds ${offer.responseDate}.`;
        }
        else {
            offer.status = "accepted";
            const previous = x.contracts.find(c => c.dealId === offer.dealId && c.status === "active");
            const start = previous && previous.ends >= s.season ? s.season + 1 : s.season;
            const id = nextId("contract");
            x.contracts.push({ id, dealId: offer.dealId, starts: start, ends: start + offer.term - 1, annual: offer.annual, bonus: offer.bonus, condition: previous?.condition ?? "playoffs", status: "active" });
            x.offers.filter(o => o.dealId === offer.dealId && o.id !== offer.id).forEach(o => { o.status = "declined"; });
            if (start === s.season)
                contractPayments(s, id, offer.annual, "sponsorship", "New sponsorship agreement", x.date);
            decision(s, "partnerships", "Sponsorship signed", `${offer.term} seasons from ${start}; guaranteed ₹${cr(offer.annual).toFixed(2)} Cr annually`, 0, automatic);
            message = "Contract signed. Its payments and expiry are now scheduled.";
        }
    }
    else if (command.type === "cancelSponsor") {
        const c = x.contracts.find(c => c.id === command.contractId && c.status === "active");
        if (!c)
            return fail("Contract is no longer active.");
        const fee = Math.round(c.annual * .1);
        if (!cash(fee))
            return fail("Insufficient cash for the 10% annual cancellation fee.");
        c.status = "cancelled";
        x.payments.filter(p => p.sourceId === c.id && p.status === "pending").forEach(p => { p.status = "cancelled"; });
        post(s, { id: nextId("cancel"), date: x.date, amount: -fee, category: "sponsorship", description: "Sponsorship early termination fee", sourceId: c.id, expense: fee });
        decision(s, "partnerships", "Sponsor contract cancelled", "Future receipts stopped; 10% annual termination fee", fee);
    }
    else if (command.type === "campaign") {
        if (!validDate(command.start) || !validDate(command.end) || command.start <= x.date || command.end < command.start || command.end > `${s.season}-12-31`)
            return fail("Choose valid campaign dates within this season, starting on the next game day or later.");
        if (!command.name.trim() || command.name.length > 80 || !Number.isSafeInteger(command.budget) || command.budget <= 0 || command.budget > inr(20))
            return fail("Give the campaign a name and a budget up to ₹20 Cr.");
        if (summary(s, context).uncommitted < command.budget)
            return fail("This campaign exceeds cash available after near-term commitments and reserve.");
        x.campaigns.push({ id: nextId("campaign"), name: command.name.trim(), audience: command.audience, objective: command.objective, start: command.start, end: command.end, budget: command.budget, spent: 0, reach: 0, attributedUnits: 0, status: "active" });
        decision(s, "retail", "Campaign scheduled", `${command.start} to ${command.end}; ₹${cr(command.budget).toFixed(2)} Cr commitment`);
    }
    else if (command.type === "campaignStatus") {
        const c = x.campaigns.find(c => c.id === command.id);
        if (!c || c.status === "completed" || c.status === "cancelled")
            return fail("This campaign has ended.");
        c.status = command.status;
        decision(s, "retail", `Campaign ${command.status}`, c.name);
    }
    else if (command.type === "programme") {
        const definition = OPERATION_PROGRAMME_DEFINITIONS[command.category];
        const tier = definition?.tierOptions.find(t => t.id === command.tier);
        if (!tier)
            return fail("Programme tier does not exist.");
        if (s.marketing.brandEquityScore < tier.reputationRequired)
            return fail(`Requires brand strength ${tier.reputationRequired}; current ${s.marketing.brandEquityScore}.`);
        const active = x.programmes.find(p => p.category === command.category && p.status === "active");
        if (active?.tier === tier.id)
            return fail("This service is already contracted.");
        const fee = active ? Math.round(active.annual * .1) : 0;
        const cost = inr(tier.setupCostCr) + fee;
        if (!cash(cost))
            return fail("Insufficient cash for setup and termination costs.");
        if (active) {
            active.status = "cancelled";
            x.payments.filter(p => p.sourceId === active.id && p.status === "pending").forEach(p => { p.status = "cancelled"; });
        }
        const id = nextId("programme"), start = addDays(x.date, 3), annual = inr(tier.annualCostCr);
        x.programmes.push({ id, category: command.category, tier: tier.id, start, end: `${s.season}-12-31`, setup: cost, annual, status: "active" });
        post(s, { id, date: x.date, amount: -cost, category: "operations", description: `${tier.name} setup and termination`, sourceId: id, expense: cost });
        contractPayments(s, id, -annual, "operations", `${tier.name} retainer`, start);
        s.operations.programmes[command.category].activeTierId = tier.id;
        decision(s, "operations", "Service contract signed", `${tier.name}; active ${start}; ₹${cr(annual).toFixed(2)} Cr retainer`, cost, automatic);
        message = `Contract signed; service begins ${start}.`;
    }
    else if (command.type === "cancelProgramme") {
        const p = x.programmes.find(p => p.id === command.id && p.status === "active");
        if (!p)
            return fail("Programme is no longer active.");
        const fee = Math.round(p.annual * .1);
        if (!cash(fee))
            return fail("Insufficient cash for termination.");
        p.status = "cancelled";
        x.payments.filter(t => t.sourceId === p.id && t.status === "pending").forEach(t => { t.status = "cancelled"; });
        post(s, { id: nextId("terminate"), date: x.date, amount: -fee, category: "operations", description: "Service contract termination", sourceId: p.id, expense: fee });
        decision(s, "operations", "Programme cancelled", "Benefits stopped; 10% annual termination fee", fee);
    }
    else if (command.type === "delegate") {
        const d = command.settings;
        if (!desks.includes(command.desk) || ![d.cap, d.reserve].every(n => Number.isSafeInteger(n) && n >= 0) || d.maxTerm < 1 || d.maxTerm > 5 || !d.allowedPolicies.length)
            return fail("Use non-negative limits, at least one permitted policy and a term from 1–5 seasons.");
        x.delegation[command.desk] = d;
        decision(s, command.desk, "Delegation updated", `${d.mode}; cash reserve ₹${cr(d.reserve).toFixed(2)} Cr`);
    }
    else if (command.type === "reminder") {
        x.reminders[command.id] = command.until;
    }
    x.revision++;
    return { ok: true, state: reconcile(s), message };
}
export function advanceBusiness(source: BusinessState, context: BusinessContext): BusinessState {
    const s = copy(source), x = s.experience;
    if (context.supporters)
        x.supporters = copy(context.supporters);
    if (context.fixtures) {
        const map = new Map(x.fixtures.map(f => [f.id, f]));
        x.fixtures = context.fixtures.map(f => ({ ...map.get(f.id), ...f }));
    }
    schedule(s, context);
    offers(s);
    automate(s, context);
    if (context.date > x.date) {
        let date = addDays(x.date, 1);
        for (let guard = 0; date <= context.date && guard < 800; guard++, date = addDays(date, 1)) {
            x.date = date;
            for (const p of x.payments.filter(p => p.status === "pending" && p.date <= date && !p.milestone))
                settlePayment(s, p);
            for (const o of x.orders.filter(o => o.status === "transit" && o.arrival <= date)) {
                for (const [id, n] of Object.entries(o.lines)) {
                    const item = s.merchandising.catalog.find(i => i.id === id);
                    if (item) {
                        item.stockLevel += n;
                        x.deliveries[id] = (x.deliveries[id] ?? 0) + n;
                    }
                }
                o.status = "delivered";
            }
            for (const c of x.campaigns.filter(c => c.status === "active" && c.start <= date && c.end >= date)) {
                const duration = Math.max(1, Math.round((Date.parse(c.end) - Date.parse(c.start)) / 86400000) + 1);
                const spend = Math.min(c.budget - c.spent, Math.round(c.budget / duration));
                if (spend > 0) {
                    post(s, { id: `${c.id}-${date}`, date, amount: -spend, category: "marketing", description: `${c.name}: daily campaign delivery`, sourceId: c.id, expense: spend });
                    c.spent += spend;
                    c.reach += Math.round(Math.sqrt(cr(spend)) * 250000 * audienceEffect(c.audience, c.objective));
                    if (c.objective === "brand") {
                        s.marketing.brandEquityScore = clamp(s.marketing.brandEquityScore + cr(spend) * .08, 0, 100);
                        s.marketing.globalFollowersMillions += Math.sqrt(cr(spend)) * .0005 * audienceEffect(c.audience, c.objective);
                    }
                }
            }
            x.campaigns.filter(c => c.end < date && ["active", "paused"].includes(c.status)).forEach(c => { c.status = "completed"; });
            if (!x.seasonClosed && date >= `${s.season}-03-01` && date <= `${s.season}-05-31`) {
                const rows = retailForecast(s, context);
                let revenue = 0, cost = 0;
                for (const r of rows) {
                    const item = s.merchandising.catalog.find(i => i.id === r.id)!;
                    const sold = Math.min(item.stockLevel, r.daily);
                    item.stockLevel -= sold;
                    item.unitsSoldSeason += sold;
                    x.lastSales[item.id] = sold;
                    x.lostSales[item.id] = (x.lostSales[item.id] ?? 0) + r.daily - sold;
                    revenue += sold * r.price;
                    cost += sold * r.cost;
                }
                if (revenue)
                    post(s, { id: `retail-${date}`, date, amount: revenue, category: "merchandise", description: "Daily retail sales and cost of goods sold", sourceId: `sales-${date}`, revenue, expense: cost });
                const active = x.campaigns.filter(c => c.status === "active" && c.objective === "sales" && c.start <= date && c.end >= date);
                const baseline = retailForecast({ ...s, experience: { ...x, campaigns: [] } }, context);
                const incremental = rows.reduce((sum, r, i) => sum + Math.max(0, Math.min(r.daily, r.stock) - Math.min(baseline[i].daily, r.stock)), 0);
                const weight = active.reduce((sum, c) => sum + Math.sqrt(cr(c.spent)) * audienceEffect(c.audience, c.objective), 0);
                active.forEach(c => { c.attributedUnits += Math.floor(incremental * Math.sqrt(cr(c.spent)) * audienceEffect(c.audience, c.objective) / Math.max(.0001, weight)); });
            }
            x.offers.filter(o => o.status === "open" && o.expires < date).forEach(o => { o.status = "expired"; });
            x.programmes.filter(p => p.status === "active" && p.end < date).forEach(p => { p.status = "expired"; });
            automate(s, context);
        }
        x.date = context.date;
    }
    if (JSON.stringify(s) !== JSON.stringify(source))
        s.experience.revision++;
    if (x.seasonClosed) {
        const statement = x.history.find(h => h.season === s.season);
        if (statement) {
            const totals = summary(s);
            Object.assign(statement, { closing: x.cash, revenue: totals.actualIncome, expense: totals.actualExpense, decisions: x.decisions.length });
        }
    }
    return reconcile(s);
}
function automate(s: BusinessState, context: BusinessContext) {
    // Run on each game date, so fast-forward and single-day progression agree.
    for (const desk of desks) {
        const current = s.experience;
        const d = current.delegation[desk];
        const totals = summary(s, context);
        const withinLimits = (cost: number) => cost <= d.cap && current.cash - cost - totals.near - totals.campaignCost >= d.reserve;
        if (d.mode !== "auto" || current.seasonClosed || current.processed.includes(`auto-${desk}-${current.date}`))
            continue;
        let cmd: Command | undefined;
        if (desk === "retail" && !current.orders.some(o => o.status === "transit") && current.date >= `${s.season}-03-01` && current.date <= `${s.season}-05-24`) {
            const rows = retailForecast(s, context);
            const lines = Object.fromEntries(rows.filter(r => r.stock < r.daily * 7).map(r => [r.id, Math.max(0, r.daily * 21 - r.stock)]));
            const cost = rows.reduce((sum, r) => sum + (lines[r.id] ?? 0) * r.cost, 0);
            if (cost > 0 && withinLimits(cost))
                cmd = { type: "order", lines, express: false };
        }
        if (desk === "partnerships") {
            const offer = current.offers.find(o => o.status === "open" && o.expires >= current.date && o.responseDate <= current.date && o.term <= d.maxTerm && !d.manualCategories.includes(s.sponsorships.deals.find(t => t.id === o.dealId)?.category ?? ""));
            if (offer)
                cmd = { type: "accept", offerId: offer.id };
        }
        if (desk === "matchday") {
            const f = current.fixtures.filter(f => !f.played && !f.cancelled && f.date > current.date && f.date <= addDays(current.date, 7) && !current.processed.includes(`auto-plan-${f.id}`))[0];
            if (f) {
                const options = d.allowedPolicies.map(policy => ({ policy, multiplier: policy === "access" ? .88 : policy === "premium" ? 1.18 : 1 })).map(option => ({ ...option, value: forecastMatch(s, { ...f, ...option }, context) })).sort((a, b) => b.value.net - a.value.net);
                const best = options[0];
                if (best && withinLimits(best.value.cost)) {
                    cmd = { type: "pricing", policy: best.policy, multiplier: best.multiplier, hospitality: current.policies.hospitality, service: current.policies.service, scope: f.id };
                }
            }
        }
        if (desk === "operations") {
            const expired = current.programmes.find(p => p.end < current.date && p.status !== "cancelled" && !current.programmes.some(n => n.category === p.category && n.start > p.start && n.status === "active"));
            if (expired) {
                const tier = OPERATION_PROGRAMME_DEFINITIONS[expired.category].tierOptions.find(t => t.id === expired.tier);
                const cost = tier ? inr(tier.setupCostCr) + (expired.status === "active" ? Math.round(expired.annual * .1) : 0) : Infinity;
                if (tier && withinLimits(cost) && s.marketing.brandEquityScore >= tier.reputationRequired)
                    cmd = { type: "programme", category: expired.category, tier: expired.tier };
            }
        }
        if (cmd) {
            const result = executeCommand(s, cmd, context, current.revision, true);
            if (result.ok) {
                // Keep the experience reference used by the calendar loop stable.
                Object.assign(current, result.state.experience);
                Object.assign(s, result.state, { experience: current });
                current.processed.push(`auto-${desk}-${current.date}`);
                if (cmd.type === "pricing")
                    current.processed.push(`auto-plan-${cmd.scope}`);
            }
        }
    }
}
export function settleMatch(source: BusinessState, fixture: FixturePlan, context: BusinessContext): BusinessState {
    if (source.experience.processed.includes(`match-${fixture.id}`) || fixture.neutral)
        return source;
    const s = advanceBusiness(source, { ...context, date: fixture.date }), x = s.experience;
    const saved = x.fixtures.find(f => f.id === fixture.id);
    const f = { ...saved, ...fixture, policy: saved?.policy ?? fixture.policy, multiplier: saved?.multiplier ?? fixture.multiplier, hospitality: saved?.hospitality ?? fixture.hospitality, service: saved?.service ?? fixture.service };
    if (f.cancelled) {
        x.processed.push(`match-${f.id}`);
        x.revision++;
        return s;
    }
    const actual = forecastMatch(s, f, context), forecast = saved?.forecast ?? actual;
    for (const [kind, amount, description] of [["gate", actual.gate, "Gate receipts"], ["hospitality", actual.hospitality, "Hospitality receipts"], ["concessions", actual.concessions, "Concession commission"], ["cost", -actual.cost, "Matchday service and production"]] as const)
        post(s, { id: `match-${f.id}-${kind}`, date: f.date, amount, category: kind === "gate" ? "ticketing" : kind === "cost" ? "operations" : "hospitality", description: `${description} vs ${f.opponent}`, sourceId: f.id, revenue: amount > 0 ? amount : 0, expense: amount < 0 ? -amount : 0 });
    if (f.abandoned) {
        const refund = Math.round(actual.gate * .5);
        post(s, { id: `match-${f.id}-refund`, date: f.date, amount: -refund, category: "ticketing", description: `Abandoned fixture: 50% public ticket refund vs ${f.opponent}`, sourceId: f.id, revenue: -refund });
        actual.gate -= refund;
        actual.net -= refund;
    }
    x.processed.push(`match-${f.id}`);
    x.reports.push({ fixture: { ...f, played: true }, forecast, actual, settled: f.date });
    if (saved)
        saved.played = true;
    s.ticketing.actualGateReceiptsCr = cr(x.reports.reduce((sum, r) => sum + r.actual.gate, 0));
    s.ticketing.settledMatchIds = x.reports.map(r => r.fixture.id);
    x.revision++;
    return reconcile(s);
}
export function finishSeason(source: BusinessState, finish: number, date: string): BusinessState {
    if (source.experience.seasonClosed)
        return source;
    const s = copy(source), x = s.experience, prize = inr(({ 1: 20, 2: 12.5, 3: 7, 4: 6.5 } as Record<number, number>)[finish] ?? 0);
    post(s, { id: `rights-final-${s.season}`, date, amount: Math.round(inr(s.broadcast.centralPoolShareCr) * .2), category: "broadcast", description: "Final central rights distribution", sourceId: "rights", revenue: Math.round(inr(s.broadcast.centralPoolShareCr) * .2) });
    const finalPayment = x.payments.find(p => p.id === `rights-final-${s.season}`);
    if (finalPayment)
        finalPayment.status = "paid";
    if (prize)
        post(s, { id: `prize-${s.season}`, date, amount: prize, category: "prize_money", description: `Tournament finish P${finish}`, sourceId: "season", revenue: prize });
    for (const c of x.contracts.filter(c => c.status === "active" && c.starts <= s.season && c.ends >= s.season)) {
        const earned = c.condition === "final" ? finish <= 2 : c.condition === "playoffs" ? finish <= 4 : c.condition === "champion" ? finish === 1 : false;
        if (earned && c.bonus)
            post(s, { id: `bonus-${c.id}-${s.season}`, date, amount: c.bonus, category: "sponsorship", description: "Earned sponsor performance bonus", sourceId: c.id, revenue: c.bonus });
    }
    x.date = date;
    x.seasonClosed = true;
    x.payments.filter(p => p.status === "pending" && p.milestone === "matches7").forEach(p => { p.status = "cancelled"; });
    s.marketing.brandEquityScore = clamp(s.marketing.brandEquityScore + (finish <= 2 ? 3 : finish <= 4 ? 1 : finish >= 8 ? -2 : 0), 0, 100);
    s.broadcast.competitionPrizeMoneyCr = cr(prize);
    const report = summary(s);
    x.history.push({ season: s.season, opening: x.opening, closing: x.cash, revenue: report.actualIncome, expense: report.actualExpense, matches: x.reports.length, finish, decisions: x.decisions.length });
    x.revision++;
    return reconcile(s);
}
export function rollover(previous: BusinessState, season: number, date: string, capacity: number): BusinessState {
    const s = initializeBusiness(createDefaultCommercialState(previous.teamId, season, capacity), date), x = s.experience, p = previous.experience;
    x.opening = p.cash;
    x.cash = p.cash;
    x.ledger = [];
    x.payments = copy(p.payments.filter(payment => payment.status === "pending" && !payment.milestone));
    x.contracts = copy(p.contracts).map(c => ({ ...c, status: c.ends < season && c.status === "active" ? "expired" : c.status }));
    x.programmes = copy(p.programmes).map(c => ({ ...c, status: c.end < date ? "expired" : c.status }));
    x.orders = copy(p.orders.filter(o => o.status === "transit"));
    x.policies = copy(p.policies);
    x.history = copy(p.history);
    x.delegation = copy(p.delegation);
    x.supporters = copy(p.supporters ?? {});
    x.campaigns = copy(p.campaigns.filter(c => c.end >= date && c.status === "active"));
    s.merchandising.catalog = copy(previous.merchandising.catalog).map(i => ({ ...i, unitsSoldSeason: 0 }));
    x.initialStock = Object.fromEntries(s.merchandising.catalog.map(i => [i.id, i.stockLevel]));
    s.sponsorships.deals = copy(previous.sponsorships.deals);
    s.ticketing.tiers = copy(previous.ticketing.tiers);
    s.hospitality = copy(previous.hospitality);
    s.matchdayOps = copy(previous.matchdayOps);
    s.marketing.brandEquityScore = previous.marketing.brandEquityScore;
    s.marketing.globalFollowersMillions = previous.marketing.globalFollowersMillions;
    s.broadcast.centralPoolShareCr = previous.broadcast.centralPoolShareCr;
    s.broadcast.overseasRightsShareCr = previous.broadcast.overseasRightsShareCr;
    s.broadcast.tvViewershipBonusCr = previous.broadcast.tvViewershipBonusCr;
    x.offers = [];
    schedule(s, { date, capacity });
    offers(s);
    return reconcile(s);
}
export function activeTier(s: BusinessState, category: OperationCategory) { return s.experience.programmes.find(p => p.category === category && p.status === "active" && p.start <= s.experience.date && p.end >= s.experience.date)?.tier; }
export function serviceEffects(s: BusinessState) {
    const medical = activeTier(s, "sports_science"), scouting = activeTier(s, "scouting_network"), camp = activeTier(s, "prep_camps"), travel = activeTier(s, "logistics_travel");
    return { injury: medical === "global_high_performance" ? { occurrenceChanceMultiplier: .6, recoveryDurationMultiplier: .65, worseningChanceMultiplier: .45 } : medical === "institute_partnership" ? { occurrenceChanceMultiplier: .8, recoveryDurationMultiplier: .82, worseningChanceMultiplier: .7 } : { occurrenceChanceMultiplier: 1, recoveryDurationMultiplier: 1, worseningChanceMultiplier: 1 }, scoutingConfidence: scouting === "global_academy_network" ? 12 : scouting === "national_analytics" ? 6 : 0, preparation: camp === "camp_overseas_tour" ? 4 : camp === "camp_specialized" ? 2 : 0, travelRecovery: travel === "travel_private_charter" ? 2 : 0 };
}
export function combinedInjuryEffects(s: BusinessState) {
    const effects = serviceEffects(s), early = s.experience.date <= `${s.season}-04-15`;
    return { ...effects.injury, occurrenceChanceMultiplier: effects.injury.occurrenceChanceMultiplier * (1 - (early ? effects.preparation : 0) / 100), recoveryDurationMultiplier: effects.injury.recoveryDurationMultiplier * (1 - effects.travelRecovery / 100) };
}
export function audienceEffect(audience: "local" | "digital" | "youth", objective: "sales" | "attendance" | "brand") {
    return objective === "attendance" ? (audience === "local" ? 1.25 : audience === "digital" ? .8 : 1) : objective === "brand" ? (audience === "digital" ? 1.25 : audience === "local" ? .8 : 1) : (audience === "youth" ? 1.15 : audience === "digital" ? 1 : .9);
}
export function supporterCommercialImpact(s: BusinessState) {
    const recent = s.experience.reports.slice(-5);
    const average = (fn: (r: typeof recent[number]) => number) => recent.length ? recent.reduce((sum, r) => sum + fn(r), 0) / recent.length : 0;
    return { pricing: average(r => r.fixture.policy === "access" ? 1.4 : r.fixture.policy === "premium" ? -1.6 : 0), service: average(r => r.fixture.service === "elite" ? 1.2 : r.fixture.service === "enhanced" ? .4 : 0), outreach: Math.min(2, s.experience.campaigns.filter(c => c.objective === "brand").reduce((sum, c) => sum + cr(c.spent) * .3, 0)), cashDiscipline: summary(s).uncommitted < 0 ? -2 : 0 };
}
export function attention(s: BusinessState, context?: BusinessContext) {
    const x = s.experience;
    const rows: {
        id: string;
        desk: Desk;
        title: string;
        detail: string;
        date: string;
        priority: number;
    }[] = [];
    for (const o of x.offers.filter(o => o.status === "open"))
        rows.push({ id: o.id, desk: "partnerships", title: "Sponsor offer awaiting review", detail: s.sponsorships.deals.find(d => d.id === o.dealId)?.partnerName ?? o.dealId, date: o.expires, priority: 1 });
    const next = x.fixtures.filter(f => !f.played && !f.cancelled && f.date >= x.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next)
        rows.push({ id: `prepare-${next.id}`, desk: "matchday", title: `Prepare home match vs ${next.opponent}`, detail: "Review pricing, hospitality and expected attendance", date: next.date, priority: 2 });
    for (const r of retailForecast(s, context).filter(r => r.stock < r.daily * 7))
        rows.push({ id: `stock-${r.id}`, desk: "retail", title: `Stock running low: ${r.name}`, detail: `${r.stock} available; ${r.daily} expected daily demand`, date: addDays(x.date, Math.floor(r.stock / Math.max(1, r.daily))), priority: 1 });
    for (const p of x.programmes.filter(p => p.status === "active" && p.end <= addDays(x.date, 30)))
        rows.push({ id: `renew-${p.id}`, desk: "operations", title: "Service contract approaching expiry", detail: OPERATION_PROGRAMME_DEFINITIONS[p.category].name, date: p.end, priority: 1 });
    if (summary(s, context).uncommitted < 0)
        rows.push({ id: "cash-reserve", desk: "finance", title: "Near-term cash reserve under pressure", detail: "Review upcoming obligations and outstanding receipts", date: x.date, priority: 0 });
    return rows.filter(r => !x.reminders[r.id] || x.reminders[r.id] <= x.date).sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date));
}
export function loadBusiness(saveId: string, team: string, season: number, capacity = 45000, squad?: Parameters<typeof createDefaultCommercialState>[3], date = `${season}-02-01`): BusinessState {
    const defaults = () => {
        const seed = createDefaultCommercialState(team, season, capacity, squad);
        if (squad?.length)
            seed.operatingCosts.squadSalariesCr = cr(contractPayroll(squad, team, season));
        return initializeBusiness(seed, date);
    };
    if (typeof localStorage === "undefined")
        return defaults();
    const key = storageKey(saveId, team, season), legacy = `ipl_commercial_state_${team.toLowerCase()}_${season}`;
    const raw = localStorage.getItem(key) ?? localStorage.getItem(legacy);
    if (raw) {
        const parsed = JSON.parse(raw) as BusinessState;
        if (parsed.teamId?.toLowerCase() !== team.toLowerCase() || parsed.season !== season || !parsed.ticketing || !parsed.merchandising)
            throw new Error("Commercial save does not match this career or is incomplete. Its data has been preserved.");
        if (parsed.experience?.version === 2) {
            const x = parsed.experience;
            if (!Number.isSafeInteger(x.opening) || !Number.isSafeInteger(x.revision) || !validDate(x.date) || ![x.ledger, x.payments, x.contracts, x.offers, x.campaigns, x.orders, x.programmes, x.fixtures, x.reports, x.decisions, x.history, x.processed].every(Array.isArray) || !x.delegation || !x.policies || !x.ledger.every(t => Number.isSafeInteger(t.amount) && Number.isSafeInteger(t.expense ?? 0) && Number.isSafeInteger(t.revenue ?? 0)) || new Set(x.ledger.map(t => t.id)).size !== x.ledger.length || !parsed.merchandising.catalog.every(i => Number.isSafeInteger(i.stockLevel) && i.stockLevel >= 0))
                throw new Error("Commercial ledger validation failed. Existing data has been preserved.");
            parsed.teamId = team;
            return reconcile(parsed);
        }
        // Back up before migrating and keep the source if backup cannot be written.
        localStorage.setItem(`${key}_backup_v1`, raw);
        if (!parsed.finance || !Number.isFinite(parsed.finance.currentCashBalanceCr) || !Array.isArray(parsed.finance.transactions) || !parsed.finance.transactions.every(t => Number.isFinite(t.amountCr) && t.amountCr >= 0))
            throw new Error("Legacy finance records are invalid. The original save and backup have been retained.");
        const migrated = initializeBusiness(parsed, date, true);
        localStorage.setItem(key, JSON.stringify(migrated));
        return migrated;
    }
    const previousKeys = Object.keys(localStorage).filter(k => k.startsWith(`ipl_commercial_state_${saveId}_${team.toLowerCase()}_`) && !k.includes("backup")).map(k => ({ key: k, season: Number(k.split("_").pop()) })).filter(k => k.season < season).sort((a, b) => b.season - a.season);
    if (previousKeys[0]) {
        const previous = JSON.parse(localStorage.getItem(previousKeys[0].key)!);
        if (previous.experience?.version === 2)
            return rollover(previous, season, date, capacity);
    }
    return defaults();
}
export function saveBusiness(saveId: string, state: BusinessState, expectedRevision?: number) {
    if (typeof localStorage === "undefined")
        return;
    const key = storageKey(saveId, state.teamId, state.season), raw = localStorage.getItem(key);
    if (expectedRevision !== undefined && raw) {
        const stored = JSON.parse(raw) as BusinessState;
        if (stored.experience?.revision !== expectedRevision)
            throw new Error("Another update changed this career. Reload the preview before committing.");
    }
    localStorage.setItem(key, JSON.stringify(reconcile(state)));
    notifyBusiness();
}
export function effectiveCapacity(saveId: string, teamId: string, fallback: number) {
    if (typeof localStorage === "undefined")
        return fallback;
    try {
        const value = JSON.parse(localStorage.getItem(`ipl-stadium-builder:${saveId}:${teamId.toLowerCase()}:v2`) ?? "null");
        if (Array.isArray(value?.modules)) {
            const total = value.modules.reduce((sum: number, m: {
                capacity?: number;
            }) => sum + Math.max(0, m.capacity ?? 0), 0);
            if (Number.isFinite(total))
                return total;
        }
    }
    catch { /* Preserve the established venue capacity on an invalid builder record. */ }
    return fallback;
}
