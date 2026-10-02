// Compatibility boundary for existing season and legacy page integrations.
export type * from "./commercialDefaults";
export { calculateTicketingProjection, createDefaultCommercialState, OPERATION_PROGRAMME_DEFINITIONS } from "./commercialDefaults";
import type { Player } from "../types";
import { advanceBusiness, combinedInjuryEffects, cr, finishSeason, initializeBusiness, inr, loadBusiness, reconcile, saveBusiness, settleMatch, storageKey } from "./commercial/engine";
import type { BusinessState } from "./commercial/types";
import type { CommercialState, LedgerTransaction, SupporterCommercialContext } from "./commercialDefaults";
export const getCommercialStorageKey = storageKey;
export function loadCommercialState(saveId: string, teamId: string, season: number, capacity = 45000, squad?: Player[], date?: string) { return loadBusiness(saveId, teamId, season, capacity, squad, date); }
export function syncCommercialFinance(state: CommercialState): BusinessState { return reconcile("experience" in state ? state as BusinessState : initializeBusiness(state, `${state.season}-02-01`, true)); }
export function saveCommercialState(saveId: string, state: CommercialState) { saveBusiness(saveId, syncCommercialFinance(state)); }
export function postCommercialTransaction(state: CommercialState, tx: LedgerTransaction): BusinessState {
    const s = JSON.parse(JSON.stringify(syncCommercialFinance(state))) as BusinessState;
    if (s.experience.ledger.some(t => t.id === tx.id))
        return s;
    const amount = inr(tx.amountCr);
    if (!Number.isSafeInteger(amount) || amount < 0)
        throw new Error("Transaction amount must be non-negative.");
    s.experience.ledger.push({ id: tx.id, date: tx.date, amount: tx.type === "credit" ? amount : -amount, category: tx.category, description: tx.description, sourceId: tx.id, revenue: tx.type === "credit" ? amount : 0, expense: tx.type === "debit" ? amount : 0 });
    s.experience.revision++;
    return reconcile(s);
}
export interface MatchdaySettlementResult {
    gateReceiptCr: number;
    hospitalityTakeCr: number;
    matchdayCostCr: number;
    netMatchdayCashCr: number;
    attendance: number;
    occupancyPercent: number;
}
export function processHomeMatchCommercialSettlement(saveId: string, teamId: string, season: number, matchId: string, matchDate: string, opponentId: string, opponentName: string, capacity: number, squad?: Player[], supporters?: SupporterCommercialContext): MatchdaySettlementResult | null {
    if (matchId.includes("playoff_"))
        return null;
    const s = loadBusiness(saveId, teamId, season, capacity, squad, matchDate);
    if (s.experience.processed.includes(`match-${matchId}`))
        return null;
    const next = settleMatch(s, { id: matchId, date: matchDate, opponentId, opponent: opponentName, capacity }, { date: matchDate, capacity, supporters });
    saveBusiness(saveId, next);
    const r = next.experience.reports.find(r => r.fixture.id === matchId)?.actual;
    if (!r)
        return null;
    return { gateReceiptCr: cr(r.gate), hospitalityTakeCr: cr(r.hospitality + r.concessions), matchdayCostCr: cr(r.cost), netMatchdayCashCr: cr(r.net), attendance: r.attendance, occupancyPercent: Math.round(r.occupancy) };
}
export function checkAndReleaseBcciTranches(saveId: string, teamId: string, season: number, played: number, date: string, capacity: number, squad?: Player[]) {
    if (played < 7)
        return;
    const s = loadBusiness(saveId, teamId, season, capacity, squad, date), id = `rights-mid-${season}`;
    if (s.experience.ledger.some(t => t.id === id || t.id === `tx-bcci-tranche2-${season}`))
        return;
    const amount = Math.round(inr(s.broadcast.centralPoolShareCr) * .3);
    s.experience.ledger.push({ id, date, amount, category: "broadcast", description: "Central rights: midseason distribution", sourceId: "rights", revenue: amount });
    s.experience.revision++;
    const milestone = s.experience.payments.find(p => p.id === id);
    if (milestone)
        milestone.status = "paid";
    saveBusiness(saveId, reconcile(s));
}
export function processSeasonEndCommercialSettlement(saveId: string, teamId: string, season: number, rank: number, capacity: number, squad?: Player[], date?: string) {
    const s = loadBusiness(saveId, teamId, season, capacity, squad);
    if (s.experience.seasonClosed)
        return;
    const settled = date ?? (s.experience.date > `${season}-05-31` ? s.experience.date : `${season}-05-31`);
    saveBusiness(saveId, finishSeason(advanceBusiness(s, { date: settled, capacity }), rank, settled));
}
export function getInjurySystemModifiersFromCommercial(saveId: string, teamId: string, season: number, capacity = 45000) { return combinedInjuryEffects(loadBusiness(saveId, teamId, season, capacity)); }
