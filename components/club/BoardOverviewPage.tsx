"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Crown,
  ShieldCheck,
  UserCheck,
  Zap,
  Compass,
  Briefcase,
  DollarSign,
  Search,
  Users,
  Award,
} from "lucide-react";
import { getClubOwnership, getAllClubOwnerships, type ClubOwnershipRecord, type OwnershipArchetype } from "@/lib/data/clubOwnership";
import { getMaxScoutingAssignments } from "@/lib/logic/scoutingAssignments";
import { getTeamStaffSalaryBudgetCap, getOwnerOfferedContractYears } from "@/lib/logic/staffContracts";
import { useGameStore } from "@/lib/store/gameStore";

interface BoardOverviewPageProps {
  teamId: string;
  teamName?: string;
  mode?: "club" | "league";
}

const ARCHETYPE_LABELS: Record<OwnershipArchetype, { title: string; badgeClass: string; icon: typeof ShieldCheck }> = {
  patron_continuity: {
    title: "Patron Continuity",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: ShieldCheck,
  },
  brand_legacy: {
    title: "Brand Legacy & Titles",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Crown,
  },
  corporate_analytical: {
    title: "Corporate & Analytical",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Building2,
  },
  hands_on_volatile: {
    title: "Hands-On & Demanding",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: Zap,
  },
  private_equity: {
    title: "Private Equity",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    icon: Briefcase,
  },
  youth_innovator: {
    title: "Youth & Innovation",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    icon: Compass,
  },
};

export default function BoardOverviewPage({ teamId: initialTeamId, mode = "club" }: BoardOverviewPageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId);
  const allOwnerships = useMemo(() => getAllClubOwnerships(), []);
  const careerStaff = useGameStore((state) => state.careerStaff);
  const activeRecord: ClubOwnershipRecord = getClubOwnership(selectedTeamId);

  const archetypeInfo = ARCHETYPE_LABELS[activeRecord.ownership_archetype] ?? ARCHETYPE_LABELS.corporate_analytical;
  const ArchetypeIcon = archetypeInfo.icon;

  const maxScoutingSlots = useMemo(() => getMaxScoutingAssignments(selectedTeamId), [selectedTeamId]);
  const staffWageCapCr = useMemo(() => (
    (careerStaff.financesByTeam[selectedTeamId]?.annualBudget
      ?? getTeamStaffSalaryBudgetCap(selectedTeamId, Object.values(careerStaff.contracts))) / 10_000_000
  ).toFixed(2), [careerStaff.contracts, careerStaff.financesByTeam, selectedTeamId]);
  const maxContractYears = useMemo(() => getOwnerOfferedContractYears(selectedTeamId), [selectedTeamId]);
  const emergencyTopUpChance = useMemo(() => Math.round(activeRecord.staff_budget_flexibility * 5), [activeRecord.staff_budget_flexibility]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ==================================================================
          TOP HEADER BAR: Consortium, Principal Owner, CEO & CEO Stats
          ================================================================== */}
      <div className="flex flex-col gap-3 border-2 border-border bg-surface p-4 shadow-sm lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2 font-space-mono text-[9px] font-bold uppercase tracking-[0.2em] text-accent">
              <Building2 className="size-3.5" />
              <span>{mode === "club" ? "Franchise Ownership & Executive Board" : "League Ownership Intelligence"}</span>
            </div>
            <h1 className="mt-1 font-anton text-2xl uppercase leading-none text-text-primary lg:text-3xl">
              {activeRecord.consortium_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 font-space-mono text-[10px] text-text-secondary">
              <span className="flex items-center gap-1 font-semibold text-text-primary">
                <Crown className="size-3 text-accent" />
                Principal Owner: {activeRecord.owner_name}
              </span>
              <span>•</span>
              <span>HQ: {activeRecord.headquarters} (Est. {activeRecord.founding_year})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mode === "league" && (
              <div className="flex items-center gap-2">
                <span className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">Franchise:</span>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="border border-border bg-background px-3 py-1.5 font-space-mono text-[11px] font-bold text-text-primary focus:border-accent focus:outline-none"
                >
                  {Object.keys(allOwnerships).map((id) => (
                    <option key={id} value={id}>
                      {id} — {allOwnerships[id].consortium_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-space-mono text-[9px] font-bold uppercase ${archetypeInfo.badgeClass}`}>
              <ArchetypeIcon className="size-3.5" />
              <span>{archetypeInfo.title}</span>
            </div>
          </div>
        </div>

        {/* Ultra-Thin CEO Strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded border border-border/80 bg-background/50 px-3 py-1.5 font-space-mono text-[9px]">
          <div className="flex items-center gap-2">
            <UserCheck className="size-3.5 text-accent shrink-0" />
            <span className="font-bold text-text-primary uppercase">CEO: {activeRecord.ceo_name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] uppercase">
            <span>Involvement: <strong className="text-accent">{activeRecord.ceo_involvement}</strong>/20</span>
            <span className="text-border/70">•</span>
            <span>Patience: <strong className="text-accent">{activeRecord.ceo_patience}</strong>/20</span>
            <span className="text-border/70">•</span>
            <span>Media: <strong className="text-accent">{activeRecord.ceo_media_presence}</strong>/20</span>
            <span className="text-border/70">•</span>
            <span>Ambition: <strong className="text-accent">{activeRecord.ceo_ambition}</strong>/20</span>
          </div>
        </div>
      </div>

      {/* ==================================================================
          MAIN BOARD DETAILS & GOVERNANCE CARDS
          ================================================================== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 1: Board Vision & Historical Culture */}
        <section className="flex flex-col justify-between border-2 border-border bg-surface p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent">
              <Building2 className="size-3.5" />
              <span>Board Vision & Identity</span>
            </div>
            <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">Official Mission Statement</h3>
            <p className="mt-2 rounded border border-border/60 bg-background/50 p-3 font-barlow text-sm font-medium italic text-text-primary">
              &ldquo;{activeRecord.vision_statement}&rdquo;
            </p>
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Historical Ownership Rationale</span>
            <p className="mt-0.5 font-barlow text-xs text-text-secondary leading-snug">
              {activeRecord.rationale}
            </p>
          </div>
        </section>

        {/* Card 2: Staff Security & Contract Governance */}
        <section className="flex flex-col justify-between border-2 border-border bg-surface p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent">
              <ShieldCheck className="size-3.5" />
              <span>Staff Security & Contract Governance</span>
            </div>
            <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">Board Patience Parameters</h3>

            <dl className="mt-3 grid grid-cols-2 gap-2.5 rounded border border-border/80 bg-background/50 p-3.5 text-[10px]">
              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Patience Modifier</dt>
                <dd className={`font-anton text-lg uppercase ${activeRecord.patience_modifier >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {activeRecord.patience_modifier > 0 ? `+${activeRecord.patience_modifier}` : activeRecord.patience_modifier} pts
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Offered Contract Max</dt>
                <dd className="font-anton text-lg uppercase text-text-primary">
                  {maxContractYears} Year{maxContractYears > 1 ? "s" : ""}
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Trophy Obsession</dt>
                <dd className="font-anton text-lg uppercase text-accent">
                  {activeRecord.trophy_obsession_level} / 20
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-3 font-space-mono text-[9px] text-text-secondary">
            * High trophy obsession boards demand Finals/Title appearances to grant full confidence.
          </p>
        </section>
      </div>

      {/* ==================================================================
          FINANCIAL & SCOUTING GOVERNANCE CARDS
          ================================================================== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 3: Financial & Budget Allocation */}
        <section className="flex flex-col justify-between border-2 border-border bg-surface p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent">
              <DollarSign className="size-3.5" />
              <span>Financial & Budget Governance</span>
            </div>
            <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">Staff Wage & Extension Caps</h3>

            <dl className="mt-3 grid grid-cols-2 gap-2.5 rounded border border-border/80 bg-background/50 p-3.5 text-[10px]">
              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Annual Staff Wage Cap</dt>
                <dd className="font-anton text-lg uppercase text-accent">
                  ₹{staffWageCapCr} Cr
                </dd>
              </div>

              <p className="col-span-2 font-space-mono text-[8px] leading-relaxed text-text-secondary">
                Set from current staff wage demands, with recruitment headroom adjusted by board generosity and flexibility.
              </p>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Financial Generosity</dt>
                <dd className="font-anton text-lg uppercase text-text-primary">
                  {activeRecord.financial_generosity} / 20
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Budget Flexibility</dt>
                <dd className="font-anton text-lg uppercase text-text-primary">
                  {activeRecord.staff_budget_flexibility} / 20
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Emergency Top-Up Approval</dt>
                <dd className="font-anton text-lg uppercase text-emerald-500">
                  {emergencyTopUpChance}%
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Card 4: Youth Scouting & AI Recruitment Floor */}
        <section className="flex flex-col justify-between border-2 border-border bg-surface p-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent">
                <Search className="size-3.5" />
                <span>Scouting & AI Youth Quotas</span>
              </div>
              <div className="flex items-center gap-1 font-space-mono text-[9px] text-text-secondary">
                <Users className="size-3" />
                <span>Minimum Youth Floor</span>
              </div>
            </div>

            <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">Youth & Network Capacity</h3>

            <dl className="mt-3 grid grid-cols-2 gap-2.5 rounded border border-border/80 bg-background/50 p-3.5 text-[10px]">
              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Scouting Assignment Slots</dt>
                <dd className="font-anton text-lg uppercase text-accent">
                  {maxScoutingSlots} Active Slots
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Scouting Investment</dt>
                <dd className="font-anton text-lg uppercase text-text-primary">
                  {activeRecord.scouting_investment_level} / 20
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">AI Youth Floor Quota</dt>
                <dd className="font-anton text-lg uppercase text-emerald-500">
                  At least {activeRecord.youth_regen_target_count} U-21 / Regens
                </dd>
              </div>

              <div>
                <dt className="font-space-mono uppercase text-text-secondary">Target Standing</dt>
                <dd className="font-anton text-lg uppercase text-text-primary">
                  Top {activeRecord.expected_position_baseline}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
