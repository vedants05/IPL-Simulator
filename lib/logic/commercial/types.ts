import type { CommercialState, OperationCategory, SupporterCommercialContext } from "../commercialDefaults";
export type Desk = "matchday" | "partnerships" | "retail" | "operations" | "finance";
export type Policy = "access" | "balanced" | "premium";
export interface CashEntry {
    id: string;
    date: string;
    amount: number;
    category: string;
    description: string;
    sourceId: string;
    expense?: number;
    revenue?: number;
}
export interface Payment {
    id: string;
    date: string;
    amount: number;
    category: string;
    description: string;
    sourceId: string;
    status: "pending" | "paid" | "cancelled";
    milestone?: "matches7" | "seasonend";
}
export interface Offer {
    id: string;
    dealId: string;
    annual: number;
    term: number;
    expires: string;
    responseDate: string;
    rounds: number;
    status: "open" | "accepted" | "declined" | "expired";
    bonus: number;
    reason: string;
}
export interface Contract {
    id: string;
    dealId: string;
    starts: number;
    ends: number;
    annual: number;
    bonus: number;
    condition: "final" | "playoffs" | "champion" | "none";
    status: "active" | "cancelled" | "expired";
}
export interface Order {
    id: string;
    placed: string;
    arrival: string;
    lines: Record<string, number>;
    cost: number;
    status: "transit" | "delivered";
}
export interface Campaign {
    id: string;
    name: string;
    audience: "local" | "digital" | "youth";
    objective: "sales" | "attendance" | "brand";
    start: string;
    end: string;
    budget: number;
    spent: number;
    reach: number;
    attributedUnits: number;
    status: "active" | "paused" | "completed" | "cancelled";
}
export interface Programme {
    id: string;
    category: OperationCategory;
    tier: string;
    start: string;
    end: string;
    setup: number;
    annual: number;
    status: "active" | "cancelled" | "expired";
}
export interface FixturePlan {
    id: string;
    date: string;
    opponentId: string;
    opponent: string;
    capacity: number;
    neutral?: boolean;
    cancelled?: boolean;
    abandoned?: boolean;
    played?: boolean;
    policy?: Policy;
    multiplier?: number;
    hospitality?: Policy;
    service?: "standard" | "enhanced" | "elite";
    forecast?: MatchForecast;
    ticketPrices?: Record<string, number>;
    hospitalityPrices?: Record<string, number>;
    catering?: "franchise_commission" | "in_house_concession";
    eventBudget?: number;
}
export interface MatchForecast {
    attendance: number;
    occupancy: number;
    gate: number;
    hospitality: number;
    concessions: number;
    cost: number;
    net: number;
    publicSeats: number;
    vipSeats: number;
    members: number;
    range: [
        number,
        number
    ];
    factors: {
        label: string;
        value: number;
    }[];
}
export interface MatchReport {
    fixture: FixturePlan;
    forecast: MatchForecast;
    actual: MatchForecast;
    settled: string;
}
export interface Decision {
    id: string;
    date: string;
    desk: Desk;
    title: string;
    detail: string;
    cost: number;
    automatic?: boolean;
}
export interface Delegation {
    mode: "manual" | "recommend" | "auto";
    cap: number;
    reserve: number;
    maxTerm: number;
    allowedPolicies: Policy[];
    manualCategories: string[];
}
export interface SeasonStatement {
    season: number;
    opening: number;
    closing: number;
    revenue: number;
    expense: number;
    matches: number;
    finish: number;
    decisions: number;
}
export interface Experience {
    version: 2;
    revision: number;
    date: string;
    opening: number;
    cash: number;
    ledger: CashEntry[];
    payments: Payment[];
    offers: Offer[];
    contracts: Contract[];
    orders: Order[];
    campaigns: Campaign[];
    programmes: Programme[];
    policies: {
        gate: Policy;
        hospitality: Policy;
        retail: Policy;
        multiplier: number;
        service: "standard" | "enhanced" | "elite";
        catering?: FixturePlan["catering"];
        eventBudget?: number;
        hospitalityPrices?: Record<string, number>;
    };
    fixtures: FixturePlan[];
    reports: MatchReport[];
    decisions: Decision[];
    processed: string[];
    history: SeasonStatement[];
    delegation: Record<Desk, Delegation>;
    reminders: Record<string, string>;
    initialStock: Record<string, number>;
    deliveries: Record<string, number>;
    lastSales: Record<string, number>;
    lostSales: Record<string, number>;
    seasonClosed: boolean;
    supporters?: SupporterCommercialContext;
    migration?: string;
}
export type BusinessState = CommercialState & {
    experience: Experience;
};
export interface BusinessContext {
    date: string;
    capacity: number;
    supporters?: SupporterCommercialContext;
    playerPayroll?: number;
    staffPayroll?: number;
    fixtures?: FixturePlan[];
}
export type Command = {
    type: "pricing";
    policy: Policy;
    multiplier: number;
    scope: "future" | string;
    hospitality: Policy;
    service: Experience["policies"]["service"];
    tiers?: Record<string, number>;
    catering?: FixturePlan["catering"];
    eventBudget?: number;
    hospitalityPrices?: Record<string, number>;
    allocations?: Record<string, number>;
} | {
    type: "boxLease";
    id: string;
    annual: number;
    leased: boolean;
} | {
    type: "memberships";
    seats: number;
    price: number;
} | {
    type: "retail";
    policy: Policy;
    prices?: Record<string, number>;
} | {
    type: "order";
    lines: Record<string, number>;
    express: boolean;
} | {
    type: "accept";
    offerId: string;
} | {
    type: "counter";
    offerId: string;
    lever: "term" | "fee" | "bonus";
} | {
    type: "cancelSponsor";
    contractId: string;
} | {
    type: "campaign";
    name: string;
    audience: Campaign["audience"];
    objective: Campaign["objective"];
    start: string;
    end: string;
    budget: number;
} | {
    type: "campaignStatus";
    id: string;
    status: "active" | "paused" | "cancelled";
} | {
    type: "programme";
    category: OperationCategory;
    tier: string;
} | {
    type: "cancelProgramme";
    id: string;
} | {
    type: "delegate";
    desk: Desk;
    settings: Delegation;
} | {
    type: "reminder";
    id: string;
    until: string;
};
export type Result = {
    ok: true;
    state: BusinessState;
    message: string;
} | {
    ok: false;
    message: string;
};
