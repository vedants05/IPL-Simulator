"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, RefreshCw, UserMinus, UserPlus, UsersRound, X } from "lucide-react";

import type { Team } from "@/lib/types";
import { useGameStore } from "@/lib/store/gameStore";
import { calculateStaffMoveInterest, calculateStaffRenewalInterest, calculateStaffSalaryDemand, evaluateStaffContractOffer } from "@/lib/logic/staffNegotiations";
import { getStaffClubAffinity, type StaffAffinityProfile } from "@/lib/data/staffAffinities";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";

interface StaffMember extends Record<string, unknown> {
  id: string;
  full_name: string;
  known_as: string | null;
  primary_role: string;
  secondary_roles: string[];
  current_real_team_id: string | null;
  date_of_birth: string | null;
  current_ability: number | null;
  potential_ability: number | null;
  is_available?: boolean;
  role_ratings?: Record<string, number>;
  affinity_profile?: StaffAffinityProfile;
}

interface StartingAssignment {
  staff_id: string;
  team_id: string;
  role: string;
  start_season: number;
}

interface StaffResponse {
  members: StaffMember[];
  assignments: StartingAssignment[];
  error?: string;
}

interface StaffManagementPageProps {
  teams: Team[];
  mode?: "club" | "league";
}

const TEAM_ORDER = ["CSK", "MI", "RCB", "KKR", "RR", "SRH", "GT", "PBKS", "LSG", "DC"];

const ROLE_ORDER = [
  "head_coach",
  "mentor",
  "assistant_coach",
  "batting_coach",
  "spin_bowling_coach",
  "pace_bowling_coach",
  "fielding_coach",
  "wicketkeeping_coach",
  "coach",
];

const humanizeValue = (value: string) => {
  const readable = value.replace(/_/g, " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : readable;
};

const roleLabel = (role: string) => humanizeValue(role);

const ratingForRole = (member: StaffMember, role: string) => (
  member.role_ratings?.[role] ?? member.current_ability
);

const formatSalary = (value: unknown): string => typeof value === "number"
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
  : String(value ?? "Not recorded");

const ageFromDateOfBirth = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
};

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join("");

const fieldLabel = (field: string) => field
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const HUMANIZED_VALUE_FIELDS = new Set([
  "primary_role",
  "secondary_roles",
  "role",
  "coaching_philosophy",
  "preferred_team_strategy",
  "personality",
  "profile_confidence",
  "employment_status",
]);

const formatFieldValue = (value: unknown, field?: string): string => {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.map((item) => formatFieldValue(item, field)).join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "string" && (HUMANIZED_VALUE_FIELDS.has(field ?? "") || value.includes("_"))) {
    return humanizeValue(value);
  }
  return String(value);
};

function StaffProfileModal({
  member,
  assignment,
  team,
  allowContractActions,
  onClose,
}: {
  member: StaffMember;
  assignment: StartingAssignment;
  team?: Team;
  allowContractActions: boolean;
  onClose: () => void;
}) {
  const careerStaff = useGameStore((state) => state.careerStaff);
  const userTeamId = useGameStore((state) => state.userTeamId);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const appointStaffMember = useGameStore((state) => state.appointStaffMember);
  const renewStaffMember = useGameStore((state) => state.renewStaffMember);
  const releaseStaffMember = useGameStore((state) => state.releaseStaffMember);
  const poachStaffMember = useGameStore((state) => state.poachStaffMember);
  const careerContract = careerStaff.contracts[member.id];
  const isFreeAgent = careerContract?.status === "free_agent";
  const isUserStaff = careerContract?.status === "contracted" && careerContract.teamId === userTeamId;
  const isOtherClubStaff = careerContract?.status === "contracted" && careerContract.teamId !== userTeamId;
  const [contractAction, setContractAction] = useState<"hire" | "poach" | "renew" | null>(null);
  const [offerRoles, setOfferRoles] = useState<string[]>([member.primary_role]);
  const [offerPrimaryRole, setOfferPrimaryRole] = useState(member.primary_role);
  const [offerEndSeason, setOfferEndSeason] = useState(String(currentSeason + 2));
  const [offerSalary, setOfferSalary] = useState(() => String(((member.salary_expectation as number | null) ?? 10_000_000) / 10_000_000));
  const [contractMessage, setContractMessage] = useState<string | null>(null);
  const [showTerminationConfirm, setShowTerminationConfirm] = useState(false);
  const coachingAttributes = member.coaching_attributes && typeof member.coaching_attributes === "object"
    ? Object.entries(member.coaching_attributes as Record<string, number>)
    : [];
  const traits = Array.isArray(member.traits) ? member.traits.map(String) : [];
  const traitPreferences = member.trait_preferences && typeof member.trait_preferences === "object"
    ? Object.entries(member.trait_preferences as Record<string, number>)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
    : [];
  const roleRatings = Object.entries(member.role_ratings ?? {})
    .sort((left, right) => right[1] - left[1]);
  const topRoleRatings = roleRatings.slice(0, 3);
  const otherRoleRatings = roleRatings.slice(3);
  const normalizedOfferRoles = [
    offerPrimaryRole,
    ...offerRoles.filter((role) => role !== offerPrimaryRole),
  ].slice(0, 2);
  const offerSecondaryRole = normalizedOfferRoles[1] ?? "";
  const offeredSalaryRupees = Math.max(0, Math.round(Number(offerSalary || 0) * 10_000_000));
  const selectedRoleRating = Number(member.role_ratings?.[offerPrimaryRole] ?? member.current_ability ?? 50);
  const salaryDemand = calculateStaffSalaryDemand({
    salaryExpectation: Number(member.salary_expectation ?? 0),
    reputation: Number(member.reputation ?? 0),
    roleRating: selectedRoleRating,
    roleCount: normalizedOfferRoles.length,
    startSeason: currentSeason,
    endSeason: offerEndSeason === "rolling" ? null : Number(offerEndSeason),
    poaching: contractAction === "poach",
    currentPrimaryRole: careerContract?.primaryRole ?? member.primary_role,
    offeredPrimaryRole: offerPrimaryRole,
    incumbentRenewal: contractAction === "renew",
    currentRoleCount: careerContract?.roles.length ?? 1,
  });
  const userFinance = careerStaff.financesByTeam[userTeamId];
  const availableBudget = Math.max(0, (userFinance?.annualBudget ?? 0) - (userFinance?.committedSalary ?? 0));

  const submitContractOffer = () => {
    const evaluation = evaluateStaffContractOffer({
      salaryExpectation: Number(member.salary_expectation ?? 0),
      reputation: Number(member.reputation ?? 0),
      roleRating: selectedRoleRating,
      roleCount: normalizedOfferRoles.length,
      startSeason: currentSeason,
      endSeason: offerEndSeason === "rolling" ? null : Number(offerEndSeason),
      offeredSalary: offeredSalaryRupees,
      poaching: contractAction === "poach",
      currentPrimaryRole: careerContract?.primaryRole ?? member.primary_role,
      offeredPrimaryRole: offerPrimaryRole,
      incumbentRenewal: contractAction === "renew",
      currentRoleCount: careerContract?.roles.length ?? 1,
    });
    if (!evaluation.accepted) {
      setContractMessage(`Offer rejected. Their minimum demand is ${formatSalary(evaluation.demand)}.`);
      return;
    }
    if (contractAction === "renew" && careerContract?.teamId) {
      const renewalInterest = calculateStaffRenewalInterest({
        loyalty: careerContract.loyalty,
        ambition: careerContract.ambition,
        adaptability: careerContract.adaptability,
        clubAffinity: getStaffClubAffinity(careerContract.affinityProfile, careerContract.teamId),
        currentSalary: careerContract.annualSalary,
        offeredSalary: offeredSalaryRupees,
        remainingContractSeasons: careerContract.endSeason == null
          ? 1
          : Math.max(0, careerContract.endSeason - currentSeason),
      });
      if (!renewalInterest.interested) {
        setContractMessage("Renewal rejected. The staff member currently prefers to explore their options rather than extend their contract.");
        return;
      }
    }
    if (contractAction === "poach" && careerContract?.teamId) {
      const destinationAffinity = getStaffClubAffinity(careerContract.affinityProfile, userTeamId);
      const currentAffinity = getStaffClubAffinity(careerContract.affinityProfile, careerContract.teamId);
      const moveInterest = calculateStaffMoveInterest({
        loyalty: careerContract.loyalty,
        ambition: careerContract.ambition,
        adaptability: careerContract.adaptability,
        currentAffinity,
        destinationAffinity,
        currentSalary: careerContract.annualSalary,
        offeredSalary: offeredSalaryRupees,
        currentRoleRating: Number(careerContract.roleRatings[careerContract.primaryRole] ?? careerContract.currentAbility),
        offeredRoleRating: selectedRoleRating,
        currentPrimaryRole: careerContract.primaryRole,
        offeredPrimaryRole: offerPrimaryRole,
        remainingContractSeasons: careerContract.endSeason == null ? 1 : Math.max(0, careerContract.endSeason - currentSeason + 1),
      });
      if (!moveInterest.interested) {
        setContractMessage("Approach rejected. Their loyalty, present club ties and current role outweigh the proposed move.");
        return;
      }
    }
    if (offeredSalaryRupees > availableBudget + (contractAction === "renew" ? careerContract?.annualSalary ?? 0 : 0)) {
      setContractMessage("This offer exceeds the club's available annual staff budget.");
      return;
    }
    const endSeason = offerEndSeason === "rolling" ? null : Number(offerEndSeason);
    const contractInput = {
          staffId: member.id,
          teamId: userTeamId,
          roles: normalizedOfferRoles,
          primaryRole: offerPrimaryRole,
          endSeason,
          annualSalary: offeredSalaryRupees,
        };
    const completed = contractAction === "hire"
      ? appointStaffMember(contractInput)
      : contractAction === "poach"
        ? poachStaffMember(contractInput)
        : renewStaffMember({
          staffId: member.id,
          endSeason,
          annualSalary: offeredSalaryRupees,
          roles: normalizedOfferRoles,
          primaryRole: offerPrimaryRole,
        });
    setContractMessage(completed
      ? contractAction === "renew" ? "Contract renewal accepted." : "Contract accepted. The staff member has joined your club."
      : "The contract could not be completed because its role or budget constraints are no longer valid.");
    if (completed) setContractAction(null);
  };
  const profileFacts: Array<[string, unknown]> = [
    ["Primary role", roleLabel(member.primary_role)],
    ["Secondary roles", member.secondary_roles?.length > 0 ? member.secondary_roles.map(roleLabel).join(", ") : "None recorded"],
    ["Age", ageFromDateOfBirth(member.date_of_birth)],
    ["Country", member.country],
    ["Home region", member.affinity_profile?.homeRegion],
    ["Experience", typeof member.experience_years === "number" ? `${member.experience_years} years` : null],
    ["Personality", member.personality],
    ["Loyalty", typeof member.loyalty === "number" ? `${member.loyalty}/100` : member.loyalty],
    ["Philosophy", member.coaching_philosophy],
    ["Team strategy", member.preferred_team_strategy],
    ["Profile confidence", member.profile_confidence],
  ];
  const clubAffinities = member.affinity_profile?.clubs ?? [];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-10"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.full_name} staff profile`}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border-2 border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between border-b-2 border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full font-anton text-xl"
              style={{ backgroundColor: team?.primaryColor ?? "var(--accent)", color: team?.textColor ?? "#fff" }}
            >
              {initials(member.full_name)}
            </div>
            <div className="min-w-0">
              <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">Staff profile</p>
              <h2 className="truncate font-anton text-2xl uppercase leading-tight text-text-primary sm:text-3xl">{member.full_name}</h2>
              <p className="mt-1 font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">
                {roleLabel(assignment.role)} · {team?.name ?? assignment.team_id}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="ml-4 flex size-9 shrink-0 items-center justify-center rounded border border-border text-text-primary hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close staff profile">
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto bg-bg/40 p-5 sm:p-6">
          {topRoleRatings.length > 0 && (
            <section className="mb-5">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-accent">Best fit</p>
                  <h3 className="font-anton text-lg uppercase text-text-primary">Top coaching positions</h3>
                </div>
                <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Role rating · 50–94</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {topRoleRatings.map(([role, rating], index) => {
                  const isPrimary = role === member.primary_role;
                  return (
                    <div
                      key={role}
                      className={`relative overflow-hidden rounded-lg border-2 p-4 ${isPrimary ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">#{index + 1} suitability</p>
                          <p className="mt-1 font-anton text-base uppercase leading-tight text-text-primary">{roleLabel(role)}</p>
                        </div>
                        <span className="font-anton text-3xl tabular-nums leading-none text-text-primary">{rating}</span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${rating}%` }} />
                      </div>
                      {isPrimary && <p className="mt-2 font-space-mono text-[7px] font-bold uppercase text-accent">Current primary role</p>}
                    </div>
                  );
                })}
              </div>
              {otherRoleRatings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {otherRoleRatings.map(([role, rating]) => (
                    <span key={role} className="rounded border border-border bg-surface px-2.5 py-1.5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                      {roleLabel(role)} <strong className="ml-1 text-text-primary">{rating}</strong>
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="mb-3 font-anton text-sm uppercase text-text-primary">Profile overview</h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
                {profileFacts.map(([label, value]) => (
                  <div key={String(label)} className="border-t border-border/70 pt-2">
                    <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
                    <p className="mt-1 text-xs font-semibold text-text-primary">{formatFieldValue(value, String(label).toLowerCase().replace(/ /g, "_"))}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Primary-role rating</p>
                  <p className="mt-1 font-anton text-4xl leading-none text-text-primary">{ratingForRole(member, member.primary_role) ?? "–"}</p>
                </div>
                <div className="text-right">
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Potential</p>
                  <p className="mt-1 font-anton text-2xl leading-none text-text-primary">{formatFieldValue(member.potential_ability)}</p>
                </div>
              </div>
              {typeof member.rating_basis === "string" && member.rating_basis && (
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-secondary">{member.rating_basis}</p>
              )}
            </div>
          </section>

          <section className="mb-5 rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="font-anton text-sm uppercase text-text-primary">Club connections</h3>
                <p className="mt-1 text-[10px] text-text-secondary">Home, playing and coaching ties influence contract decisions.</p>
              </div>
              <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Home country · {member.affinity_profile?.homeCountry ?? String(member.country ?? "Unknown")}</span>
            </div>
            {clubAffinities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {clubAffinities.map((affinity) => (
                  <span key={affinity.teamId} className="rounded border border-border bg-bg px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-text-primary">
                    {affinity.teamId} · {affinity.strength}<span className="ml-2 text-text-secondary">{affinity.reasons.map(fieldLabel).join(" · ")}</span>
                  </span>
                ))}
              </div>
            ) : <p className="text-xs text-text-secondary">No specific IPL club connection is recorded.</p>}
          </section>

          <section className="mb-5 rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="font-anton text-sm uppercase text-text-primary">Contract information</h3>
              <span className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">
                {member.contract_status === "fixed_term" ? "Fixed term" : member.contract_status === "uncontracted" ? "Free agent" : "Rolling"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["Contract start", member.contract_start_year ?? "Not recorded"],
                ["Contract end", member.contract_end_year ?? (member.contract_status === "uncontracted" ? "Uncontracted" : "Rolling")],
                ["Annual salary", formatSalary(member.annual_salary ?? member.salary_expectation)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded border border-border bg-bg px-4 py-3">
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{String(label)}</p>
                  <p className="mt-1 font-anton text-lg uppercase text-text-primary">{formatFieldValue(value)}</p>
                </div>
              ))}
            </div>
          </section>

          {allowContractActions && (isFreeAgent || isUserStaff || isOtherClubStaff) && (
            <section className="mb-5 rounded-lg border-2 border-accent/40 bg-accent/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-accent">Contract actions</p>
                  <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">
                    {isFreeAgent ? "Available to hire" : isUserStaff ? "Your coaching staff" : "Contracted elsewhere"}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isFreeAgent && (
                    <button type="button" onClick={() => {
                      setOfferRoles([member.primary_role]);
                      setOfferPrimaryRole(member.primary_role);
                      setContractAction("hire");
                      setContractMessage(null);
                    }} className="flex items-center gap-2 rounded bg-accent px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-white">
                      <UserPlus size={14} /> Offer contract
                    </button>
                  )}
                  {isUserStaff && (
                    <>
                      <button type="button" onClick={() => {
                        setOfferEndSeason(String(Math.max(currentSeason + 1, careerContract?.endSeason ?? currentSeason + 2)));
                        setOfferSalary(String((careerContract?.annualSalary ?? 10_000_000) / 10_000_000));
                        setOfferRoles(careerContract?.roles?.slice(0, 2) ?? [member.primary_role]);
                        setOfferPrimaryRole(careerContract?.primaryRole ?? member.primary_role);
                        setContractAction("renew");
                        setContractMessage(null);
                      }} className="rounded bg-accent px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-white">
                        Renew / change roles
                      </button>
                      <button type="button" onClick={() => {
                        setContractAction(null);
                        setContractMessage(null);
                        setShowTerminationConfirm(true);
                      }} className="flex items-center gap-2 rounded border border-danger/40 bg-danger/10 px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-danger">
                        <UserMinus size={14} /> Terminate
                      </button>
                    </>
                  )}
                  {isOtherClubStaff && (
                    <button type="button" onClick={() => {
                      const existingRoles = careerContract?.roles?.slice(0, 2) ?? [member.primary_role];
                      setOfferRoles(existingRoles);
                      setOfferPrimaryRole(existingRoles.includes(careerContract?.primaryRole ?? "") ? careerContract!.primaryRole : existingRoles[0]);
                      setContractAction("poach");
                      setContractMessage(null);
                    }} className="flex items-center gap-2 rounded bg-accent px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-white">
                      <UserPlus size={14} /> Approach staff
                    </button>
                  )}
                </div>
              </div>

              {contractAction && (
                <div className="mt-4 border-t border-accent/30 pt-4">
                  {(contractAction === "hire" || contractAction === "poach" || contractAction === "renew") && (
                    <div className="mb-4">
                      <p className="mb-2 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Contracted responsibilities</p>
                      <p className="mb-2 text-[10px] text-text-secondary">Choose one primary role and, optionally, one secondary role. Maximum two roles per contract.</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                          Primary role
                          <select value={offerPrimaryRole} onChange={(event) => {
                            const role = event.target.value;
                            setOfferPrimaryRole(role);
                            setOfferRoles((current) => [role, ...current.filter((candidate) => candidate !== role)].slice(0, 2));
                            setContractMessage(null);
                          }} className="mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-xs text-text-primary">
                            {ROLE_ORDER.map((role) => <option key={role} value={role}>{roleLabel(role)} · {member.role_ratings?.[role] ?? "–"}</option>)}
                          </select>
                        </label>
                        <label className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                          Secondary role
                          <select value={offerSecondaryRole} onChange={(event) => {
                            const role = event.target.value;
                            setOfferRoles(role ? [offerPrimaryRole, role] : [offerPrimaryRole]);
                            setContractMessage(null);
                          }} className="mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-xs text-text-primary">
                            <option value="">No secondary role</option>
                            {ROLE_ORDER.filter((role) => role !== offerPrimaryRole).map((role) => <option key={role} value={role}>{roleLabel(role)} · {member.role_ratings?.[role] ?? "–"}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                      Contract end
                      <select value={offerEndSeason} onChange={(event) => setOfferEndSeason(event.target.value)} className="mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-xs text-text-primary">
                        <option value="rolling">Rolling</option>
                        {Array.from({ length: 6 }, (_, index) => currentSeason + index).map((season) => <option key={season} value={season}>After {season} season</option>)}
                      </select>
                    </label>
                    <label className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                      Annual salary · crore
                      <input type="number" min="0.5" step="0.05" value={offerSalary} onChange={(event) => setOfferSalary(event.target.value)} className="mt-1 block w-full rounded border border-border bg-surface px-3 py-2 text-xs text-text-primary" />
                    </label>
                    <div className="rounded border border-border bg-surface px-3 py-2">
                      <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Expected demand</p>
                      <p className="mt-1 text-xs font-bold text-text-primary">{formatSalary(salaryDemand)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="font-space-mono text-[8px] text-text-secondary">
                      <p>Available staff budget: <strong className="text-text-primary">{formatSalary(availableBudget + (contractAction === "renew" ? careerContract?.annualSalary ?? 0 : 0))}</strong></p>
                      {contractAction === "poach" && <p className="mt-1">Release compensation: <strong className="text-text-primary">{formatSalary((careerContract?.annualSalary ?? 0) * (careerContract?.endSeason == null ? 1 : Math.max(1, careerContract.endSeason - currentSeason + 1)))}</strong></p>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setContractAction(null)} className="rounded border border-border px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">Cancel</button>
                      <button type="button" onClick={submitContractOffer} className="rounded bg-success px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-white">Submit offer</button>
                    </div>
                  </div>
                </div>
              )}
              {contractMessage && <p className="mt-3 rounded border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary">{contractMessage}</p>}
            </section>
          )}

          {showTerminationConfirm && isUserStaff && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" role="presentation" onMouseDown={() => setShowTerminationConfirm(false)}>
              <div role="alertdialog" aria-modal="true" aria-labelledby="terminate-staff-title" className="w-full max-w-lg overflow-hidden rounded-lg border-2 border-danger bg-surface shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-start gap-4 border-b-2 border-danger/30 bg-danger/10 px-5 py-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger text-white"><UserMinus size={20} /></div>
                  <div>
                    <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-danger">Contract termination</p>
                    <h3 id="terminate-staff-title" className="mt-1 font-anton text-2xl uppercase leading-none text-text-primary">Release {member.full_name}?</h3>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">This immediately removes the staff member from your club and places them in the free-agent market.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 px-5 py-5">
                  <div className="rounded border border-border bg-bg p-3"><p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Primary role</p><p className="mt-1 font-anton text-sm uppercase text-text-primary">{roleLabel(careerContract.primaryRole)}</p></div>
                  <div className="rounded border border-border bg-bg p-3"><p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Contract end</p><p className="mt-1 font-anton text-sm uppercase text-text-primary">{careerContract.endSeason ?? "Rolling"}</p></div>
                  <div className="rounded border border-danger/30 bg-danger/5 p-3"><p className="font-space-mono text-[7px] font-bold uppercase text-danger">Compensation</p><p className="mt-1 font-anton text-sm uppercase text-danger">{formatSalary(careerContract.annualSalary)}</p></div>
                </div>
                <div className="mx-5 border border-warning/30 bg-warning/10 px-3 py-2.5 font-space-mono text-[8px] font-bold uppercase leading-relaxed text-text-primary">The compensation charge is applied immediately. This action cannot be undone.</div>
                <div className="flex justify-end gap-3 px-5 py-5">
                  <button type="button" onClick={() => setShowTerminationConfirm(false)} className="rounded border border-border bg-surface px-4 py-2.5 font-space-mono text-[8px] font-bold uppercase text-text-primary hover:border-accent">Keep staff member</button>
                  <button type="button" onClick={() => {
                    const released = releaseStaffMember({ staffId: member.id, reason: "club_sacked" });
                    setShowTerminationConfirm(false);
                    setContractMessage(released ? "Contract terminated. The staff member is now a free agent." : "The contract could not be terminated.");
                  }} className="flex items-center gap-2 rounded bg-danger px-4 py-2.5 font-space-mono text-[8px] font-bold uppercase text-white hover:bg-danger/85"><UserMinus size={14} /> Confirm termination</button>
                </div>
              </div>
            </div>
          )}

          {coachingAttributes.length > 0 && (
            <section className="mb-5 rounded border border-border bg-bg p-4">
              <h3 className="mb-4 border-b border-border pb-2 font-anton text-sm uppercase text-text-primary">Coaching attributes · 1–20</h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {coachingAttributes.map(([attribute, value]) => (
                  <div key={attribute} className="grid grid-cols-[8.5rem_minmax(0,1fr)_1.5rem] items-center gap-2">
                    <span className="truncate font-space-mono text-[8px] font-bold uppercase text-text-secondary">{fieldLabel(attribute)}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className={`h-full rounded-full ${value >= 17 ? "bg-success" : value >= 13 ? "bg-accent" : value >= 9 ? "bg-gold" : "bg-danger"}`}
                        style={{ width: `${Math.max(0, Math.min(100, value * 5))}%` }}
                      />
                    </div>
                    <span className="text-right font-space-mono text-[10px] font-bold text-text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {traits.length > 0 && (
            <section className="mb-5 rounded border border-border bg-bg p-4">
              <h3 className="mb-3 font-anton text-sm uppercase text-text-primary">Traits</h3>
              <div className="flex flex-wrap gap-2">
                {traits.map((trait) => <span key={trait} className="rounded border border-accent/40 bg-accent/10 px-2.5 py-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary">{fieldLabel(trait)}</span>)}
              </div>
            </section>
          )}

          {traitPreferences.length > 0 && (
            <section className="mb-5 rounded border border-border bg-bg p-4">
              <div className="mb-4 border-b border-border pb-2">
                <h3 className="font-anton text-sm uppercase text-text-primary">Coaching preferences</h3>
                <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Behavioural tendencies · 0–100</p>
              </div>
              <div className="grid grid-cols-1 gap-x-7 gap-y-3 sm:grid-cols-2">
                {traitPreferences.map(([preference, value]) => {
                  const boundedValue = Math.max(0, Math.min(100, value));
                  const barColor = boundedValue >= 80
                    ? "bg-success"
                    : boundedValue >= 65
                      ? "bg-accent"
                      : boundedValue >= 45
                        ? "bg-gold"
                        : "bg-danger";
                  return (
                    <div key={preference} className="grid grid-cols-[9.5rem_minmax(0,1fr)_2rem] items-center gap-2">
                      <span className="truncate font-space-mono text-[8px] font-bold uppercase text-text-secondary" title={fieldLabel(preference)}>{fieldLabel(preference)}</span>
                      <div className="h-2 overflow-hidden rounded-sm border border-border bg-surface shadow-inner">
                        <div className={`h-full ${barColor} transition-[width] duration-300`} style={{ width: `${boundedValue}%` }} />
                      </div>
                      <span className="text-right font-space-mono text-[10px] font-bold tabular-nums text-text-primary">{boundedValue}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

export default function StaffManagementPage({ teams, mode = "club" }: StaffManagementPageProps) {
  const [data, setData] = useState<StaffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [marketScope, setMarketScope] = useState<"free_agents" | "contracted">("free_agents");
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [minimumCA, setMinimumCA] = useState(0);
  const [minimumPA, setMinimumPA] = useState(0);
  const [clubLinkFilter, setClubLinkFilter] = useState("all");
  const [demandSort, setDemandSort] = useState<"rating" | "demand_low" | "demand_high" | "affordable_first">("rating");
  const [budgetFilter, setBudgetFilter] = useState<"all" | "within" | "over">("all");
  const [selectedLeagueTeamId, setSelectedLeagueTeamId] = useState<string | null>(null);
  const careerStaff = useGameStore((state) => state.careerStaff);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const careerSeasonArchives = useGameStore((state) => state.careerSeasonArchives);
  const userTeamId = useGameStore((state) => state.userTeamId);
  const initializeCareerStaff = useGameStore((state) => state.initializeCareerStaff);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch("/api/staff", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as StaffResponse;
        if (!response.ok) throw new Error(result.error || "Unable to load staff");
        initializeCareerStaff(result.members, result.assignments);
        setData(result);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load staff");
      });

    return () => controller.abort();
  }, [initializeCareerStaff, reloadKey]);

  const displayData = useMemo<StaffResponse | null>(() => {
    if (!data || !careerStaff.initialized) return data;
    const databaseIds = new Set(data.members.map((member) => member.id));
    const saveGeneratedMembers = Object.values(careerStaff.generatedProfiles ?? {})
      .filter((member) => !databaseIds.has(member.id)) as StaffMember[];
    const members = [...data.members, ...saveGeneratedMembers].map((member) => {
      const contract = careerStaff.contracts[member.id];
      if (!contract) return member;
      return {
        ...member,
        ...contract.coachingAttributes,
        current_real_team_id: contract.teamId,
        primary_role: contract.primaryRole,
        role_ratings: contract.roleRatings,
        current_ability: contract.currentAbility,
        potential_ability: contract.potentialAbility,
        reputation: contract.reputation,
        experience_years: contract.experienceYears,
        development_phase: contract.developmentPhase,
        retirement_age: contract.retirementAge,
        learning_rate: contract.learningRate,
        is_available: contract.status === "free_agent",
        contract_start_year: contract.startSeason,
        contract_end_year: contract.endSeason,
        contract_status: contract.status === "free_agent"
          ? "uncontracted"
          : contract.contractType === "rolling" ? "rolling" : "fixed_term",
        annual_salary: contract.annualSalary,
      };
    });
    const assignments = Object.values(careerStaff.contracts).flatMap((contract) => (
      contract.status === "contracted" && contract.teamId
        ? contract.roles.map((role) => ({
            staff_id: contract.staffId,
            team_id: contract.teamId!,
            role,
            start_season: contract.startSeason ?? 2026,
          }))
        : []
    ));
    return { ...data, members, assignments };
  }, [careerStaff, data]);

  const memberById = useMemo(() => new Map(
    (displayData?.members ?? []).map((member) => [member.id, member]),
  ), [displayData?.members]);

  const orderedTeams = useMemo(() => [...teams].sort((left, right) => {
    const leftIndex = TEAM_ORDER.indexOf(left.id);
    const rightIndex = TEAM_ORDER.indexOf(right.id);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  }), [teams]);

  const assignmentsByTeam = useMemo(() => {
    const grouped = new Map<string, StartingAssignment[]>();
    (displayData?.assignments ?? []).forEach((assignment) => {
      const current = grouped.get(assignment.team_id) ?? [];
      current.push(assignment);
      grouped.set(assignment.team_id, current);
    });
    grouped.forEach((assignments) => assignments.sort((left, right) => {
      const leftIndex = ROLE_ORDER.indexOf(left.role);
      const rightIndex = ROLE_ORDER.indexOf(right.role);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }));
    return grouped;
  }, [displayData?.assignments]);

  const freeAgents = useMemo(() => {
    const assignedIds = new Set((displayData?.assignments ?? []).map((assignment) => assignment.staff_id));
    return (displayData?.members ?? [])
      // The assignment is authoritative. A stale availability flag must not
      // make an otherwise unattached staff profile disappear from the directory.
      .filter((member) => member.current_real_team_id === null && !assignedIds.has(member.id))
      .sort((left, right) => {
        const leftRole = ROLE_ORDER.indexOf(left.primary_role);
        const rightRole = ROLE_ORDER.indexOf(right.primary_role);
        const roleDifference = (leftRole === -1 ? 999 : leftRole) - (rightRole === -1 ? 999 : rightRole);
        return roleDifference || left.full_name.localeCompare(right.full_name);
      });
  }, [displayData?.assignments, displayData?.members]);
  const contractedRecruitmentTargets = useMemo(() => (displayData?.members ?? [])
    .filter((member) => {
      const contract = careerStaff.contracts[member.id];
      return contract?.status === "contracted" && contract.teamId !== userTeamId;
    })
    .sort((left, right) => (ratingForRole(right, right.primary_role) ?? 0) - (ratingForRole(left, left.primary_role) ?? 0)),
  [careerStaff.contracts, displayData?.members, userTeamId]);
  const userAssignments = assignmentsByTeam.get(userTeamId) ?? [];
  const userStaffEntries = Array.from(new Set(userAssignments.map((assignment) => assignment.staff_id)))
    .map((staffId) => {
      const member = memberById.get(staffId);
      if (!member) return null;
      const assignments = userAssignments.filter((assignment) => assignment.staff_id === staffId);
      const contract = careerStaff.contracts[staffId];
      const primaryAssignment = assignments.find((assignment) => assignment.role === contract?.primaryRole) ?? assignments[0];
      return { member, primaryAssignment, secondaryAssignments: assignments.filter((assignment) => assignment !== primaryAssignment) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const recruitmentAvailableBudget = Math.max(0,
    (careerStaff.financesByTeam[userTeamId]?.annualBudget ?? 0)
    - (careerStaff.financesByTeam[userTeamId]?.committedSalary ?? 0),
  );
  const recruitmentDemandById = useMemo(() => new Map(
    [...freeAgents, ...contractedRecruitmentTargets].map((member) => {
      const contract = careerStaff.contracts[member.id];
      const offeredRole = roleFilter === "all" ? member.primary_role : roleFilter;
      return [member.id, calculateStaffSalaryDemand({
        salaryExpectation: Number(member.salary_expectation ?? contract?.annualSalary ?? 0),
        reputation: Number(member.reputation ?? contract?.reputation ?? 50),
        roleRating: Number(member.role_ratings?.[offeredRole] ?? member.current_ability ?? 50),
        roleCount: 1,
        startSeason: currentSeason,
        endSeason: currentSeason + 2,
        poaching: contract?.status === "contracted",
        currentPrimaryRole: contract?.primaryRole ?? member.primary_role,
        offeredPrimaryRole: offeredRole,
      })] as const;
    }),
  ), [careerStaff.contracts, contractedRecruitmentTargets, currentSeason, freeAgents, roleFilter]);
  const filteredRecruitmentPool = useMemo(() => {
    const pool = marketScope === "free_agents" ? freeAgents : contractedRecruitmentTargets;
    const query = staffSearch.trim().toLowerCase();
    return pool.filter((member) => {
      const currentAbility = member.current_ability ?? 0;
      const potentialAbility = member.potential_ability ?? 0;
      const roleMatch = roleFilter === "all"
        || member.primary_role === roleFilter
        || member.secondary_roles?.includes(roleFilter)
        || (member.role_ratings?.[roleFilter] ?? 0) >= 60;
      const demand = recruitmentDemandById.get(member.id) ?? 0;
      return (!query || member.full_name.toLowerCase().includes(query) || (member.known_as ?? "").toLowerCase().includes(query))
        && roleMatch
        && currentAbility >= minimumCA
        && potentialAbility >= minimumPA
        && (clubLinkFilter === "all" || getStaffClubAffinity(member.affinity_profile, clubLinkFilter) > 0)
        && (budgetFilter === "all" || (budgetFilter === "within" ? demand <= recruitmentAvailableBudget : demand > recruitmentAvailableBudget));
    }).sort((left, right) => {
      const demandDifference = (recruitmentDemandById.get(left.id) ?? 0) - (recruitmentDemandById.get(right.id) ?? 0);
      if (demandSort === "demand_low") return demandDifference || left.full_name.localeCompare(right.full_name);
      if (demandSort === "demand_high") return -demandDifference || left.full_name.localeCompare(right.full_name);
      if (demandSort === "affordable_first") {
        const leftAffordable = (recruitmentDemandById.get(left.id) ?? 0) <= recruitmentAvailableBudget;
        const rightAffordable = (recruitmentDemandById.get(right.id) ?? 0) <= recruitmentAvailableBudget;
        return Number(rightAffordable) - Number(leftAffordable) || demandDifference || left.full_name.localeCompare(right.full_name);
      }
      const leftRating = roleFilter === "all" ? left.current_ability ?? 0 : ratingForRole(left, roleFilter) ?? 0;
      const rightRating = roleFilter === "all" ? right.current_ability ?? 0 : ratingForRole(right, roleFilter) ?? 0;
      return rightRating - leftRating || left.full_name.localeCompare(right.full_name);
    });
  }, [budgetFilter, clubLinkFilter, contractedRecruitmentTargets, demandSort, freeAgents, marketScope, minimumCA, minimumPA, recruitmentAvailableBudget, recruitmentDemandById, roleFilter, staffSearch]);

  const selectedMember = selectedStaffId ? memberById.get(selectedStaffId) : undefined;
  const selectedAssignment = displayData?.assignments.find((assignment) => (
    assignment.staff_id === selectedStaffId && assignment.role === selectedMember?.primary_role
  )) ?? displayData?.assignments.find((assignment) => assignment.staff_id === selectedStaffId)
    ?? (selectedMember ? { staff_id: selectedMember.id, team_id: "Free agent", role: selectedMember.primary_role, start_season: 2026 } : undefined);
  const selectedTeam = selectedAssignment ? teams.find((team) => team.id === selectedAssignment.team_id) : undefined;
  const expiringContractCount = Object.values(careerStaff.contracts).filter((contract) => (
    contract.status === "contracted" && contract.endSeason === currentSeason
  )).length;
  const userFinance = careerStaff.financesByTeam[userTeamId];
  const userStaffContracts = Object.values(careerStaff.contracts).filter((contract) => (
    contract.status === "contracted" && contract.teamId === userTeamId
  ));
  const occupiedUserRoles = new Set(userStaffContracts.flatMap((contract) => contract.roles));
  const coreStaffRoles = ["head_coach", "batting_coach", "pace_bowling_coach", "spin_bowling_coach", "fielding_coach"];
  const vacantUserRoles = coreStaffRoles.filter((role) => !occupiedUserRoles.has(role));
  const recentStaffEvents = careerStaff.employmentHistory
    .slice(-4)
    .reverse();
  const visibleTeams = mode === "club"
    ? orderedTeams.filter((team) => team.id === userTeamId)
    : orderedTeams.filter((team) => team.id !== userTeamId);
  const leagueStaffEvents = [...careerStaff.employmentHistory]
    .filter((event) => event.teamId !== userTeamId)
    .reverse();

  if (!data && !error) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center border-2 border-border bg-surface">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <RefreshCw className="size-6 animate-spin text-accent" />
          <span className="font-space-mono text-[10px] font-bold uppercase tracking-[0.2em]">Loading league staff</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center border-2 border-danger/30 bg-danger/5 p-8 text-center">
        <div>
          <p className="font-anton text-xl uppercase text-text-primary">Staff data unavailable</p>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="mt-5 rounded border border-border bg-surface px-4 py-2 font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-primary hover:border-accent"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (String(mode) === "club") {
    const userTeam = teams.find((team) => team.id === userTeamId);
    const budgetUsedPct = Math.min(100, ((userFinance?.committedSalary ?? 0) / Math.max(1, userFinance?.annualBudget ?? 1)) * 100);
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
        <header className="flex shrink-0 items-center justify-between rounded-lg border-2 border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded bg-[var(--ink)] text-bg"><BriefcaseBusiness className="size-5" /></div>
            <div>
              <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.22em] text-text-secondary">{userTeam?.name ?? userTeamId} · cricket operations</p>
              <h2 className="font-anton text-xl uppercase leading-none text-text-primary">Staff Management</h2>
            </div>
          </div>
          <div className="flex items-center gap-5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
            <span>{userStaffEntries.length} staff</span>
            <span>{vacantUserRoles.length} core vacancies</span>
            <span>{userStaffContracts.filter((contract) => contract.endSeason === currentSeason).length} expiring</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-[0.88] grid-cols-[minmax(0,2fr)_minmax(17rem,0.72fr)] gap-3">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
              <div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-accent">Current contracts</p><h3 className="font-anton text-base uppercase text-text-primary">Your Staff</h3></div>
              <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Select a profile to renew, change roles or terminate</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto">
              {userStaffEntries.map(({ member, primaryAssignment, secondaryAssignments }) => {
                const contract = careerStaff.contracts[member.id];
                return (
                  <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group flex min-h-[68px] items-center gap-3 border-b border-r border-hairline px-4 py-2.5 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 font-space-mono text-[9px] font-bold text-text-primary">{initials(member.full_name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text-primary group-hover:underline">{member.full_name}</p>
                      <p className="mt-0.5 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">Primary · {roleLabel(primaryAssignment.role)} {ratingForRole(member, primaryAssignment.role) ?? "–"}</p>
                      {secondaryAssignments[0] && <p className="truncate font-space-mono text-[7px] font-bold uppercase text-accent">Secondary · {roleLabel(secondaryAssignments[0].role)} {ratingForRole(member, secondaryAssignments[0].role) ?? "–"}</p>}
                    </div>
                    <div className="shrink-0 text-right"><p className="font-anton text-sm text-text-primary">{formatSalary(contract?.annualSalary ?? 0)}</p><p className="font-space-mono text-[6px] uppercase text-text-secondary">{contract?.endSeason ?? "Rolling"}</p></div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="grid min-h-0 grid-rows-2 gap-3">
            <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4">
              <div className="flex items-center justify-between"><p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Annual staff budget</p><span className="font-anton text-lg text-text-primary">{budgetUsedPct.toFixed(0)}%</span></div>
              <p className="mt-2 font-anton text-xl text-text-primary">{formatSalary(userFinance?.committedSalary ?? 0)} <span className="text-sm text-text-secondary">/ {formatSalary(userFinance?.annualBudget ?? 0)}</span></p>
              <div className="mt-auto h-2 overflow-hidden rounded bg-border"><div className={`h-full ${budgetUsedPct >= 95 ? "bg-danger" : budgetUsedPct >= 80 ? "bg-gold" : "bg-accent"}`} style={{ width: `${budgetUsedPct}%` }} /></div>
              <p className="mt-2 font-space-mono text-[7px] uppercase text-text-secondary">Available {formatSalary(Math.max(0, (userFinance?.annualBudget ?? 0) - (userFinance?.committedSalary ?? 0)))}</p>
            </section>
            <section className="min-h-0 rounded-lg border-2 border-border bg-surface p-4">
              <div className="flex items-center justify-between"><p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Core role coverage</p><span className={`font-anton text-lg ${vacantUserRoles.length ? "text-danger" : "text-success"}`}>{5 - vacantUserRoles.length}/5</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{coreStaffRoles.map((role) => <span key={role} className={`rounded border px-2 py-1 font-space-mono text-[6px] font-bold uppercase ${occupiedUserRoles.has(role) ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>{roleLabel(role)}</span>)}</div>
            </section>
          </aside>
        </div>

        <section className="flex min-h-0 flex-[1.12] flex-col overflow-hidden rounded-lg border-2 border-border bg-surface">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-border px-4 py-2.5">
            <div className="shrink-0"><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-accent">Recruitment workspace</p><h3 className="font-anton text-base uppercase text-text-primary">Staff Market</h3></div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <div className="flex rounded border border-border bg-bg p-0.5">
                <button type="button" onClick={() => setMarketScope("free_agents")} className={`px-2.5 py-1.5 font-space-mono text-[7px] font-bold uppercase ${marketScope === "free_agents" ? "bg-accent text-white" : "text-text-secondary"}`}>Free agents · {freeAgents.length}</button>
                <button type="button" onClick={() => setMarketScope("contracted")} className={`px-2.5 py-1.5 font-space-mono text-[7px] font-bold uppercase ${marketScope === "contracted" ? "bg-accent text-white" : "text-text-secondary"}`}>Contracted · {contractedRecruitmentTargets.length}</button>
              </div>
              <input value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search staff" className="w-36 rounded border border-border bg-bg px-2.5 py-1.5 text-[10px] text-text-primary outline-none focus:border-accent" />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="w-40 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary"><option value="all">All roles</option>{ROLE_ORDER.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>
              <select value={minimumCA} onChange={(event) => setMinimumCA(Number(event.target.value))} className="w-24 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary">{[0, 60, 65, 70, 75, 80, 85].map((value) => <option key={value} value={value}>CA {value ? `${value}+` : "Any"}</option>)}</select>
              <select value={minimumPA} onChange={(event) => setMinimumPA(Number(event.target.value))} className="w-24 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary">{[0, 60, 65, 70, 75, 80, 85].map((value) => <option key={value} value={value}>PA {value ? `${value}+` : "Any"}</option>)}</select>
              <select value={clubLinkFilter} onChange={(event) => setClubLinkFilter(event.target.value)} className="w-32 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary"><option value="all">Any club link</option>{orderedTeams.map((team) => <option key={team.id} value={team.id}>Linked to {team.shortName}</option>)}</select>
              <select value={demandSort} onChange={(event) => setDemandSort(event.target.value as typeof demandSort)} className="w-32 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary"><option value="rating">Sort: Best fit</option><option value="demand_low">Demand: Low–high</option><option value="demand_high">Demand: High–low</option><option value="affordable_first">Within budget first</option></select>
              <select value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value as typeof budgetFilter)} className="w-32 rounded border border-border bg-bg px-2 py-1.5 font-space-mono text-[8px] text-text-primary"><option value="all">Any affordability</option><option value="within">Within budget</option><option value="over">Over budget</option></select>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-[minmax(11rem,1.4fr)_8rem_3rem_3rem_6rem_6rem_5rem_5.5rem] gap-3 border-b border-border bg-black/[0.02] px-4 py-1.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary dark:bg-white/[0.02]"><span>Staff member</span><span>Role / fit</span><span className="text-center">CA</span><span className="text-center">PA</span><span className="text-right">Demand</span><span>Club link</span><span className="text-center">Budget</span><span className="text-right">Status</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredRecruitmentPool.map((member) => {
              const contract = careerStaff.contracts[member.id];
              const displayRole = roleFilter === "all" ? member.primary_role : roleFilter;
              const strongestAffinity = [...(member.affinity_profile?.clubs ?? [])].sort((left, right) => right.strength - left.strength)[0];
              const demand = recruitmentDemandById.get(member.id) ?? 0;
              const withinBudget = demand <= recruitmentAvailableBudget;
              return (
                <button type="button" key={member.id} onClick={() => setSelectedStaffId(member.id)} className="grid w-full grid-cols-[minmax(11rem,1.4fr)_8rem_3rem_3rem_6rem_6rem_5rem_5.5rem] items-center gap-3 border-b border-hairline px-4 py-2 text-left hover:bg-accent/[0.04]">
                  <span className="min-w-0"><span className="block truncate text-xs font-bold text-text-primary">{member.full_name}</span><span className="block truncate font-space-mono text-[6px] uppercase text-text-secondary">{String(member.country ?? "Unknown")} · Age {ageFromDateOfBirth(member.date_of_birth) ?? "–"}</span></span>
                  <span className="truncate font-space-mono text-[7px] font-bold uppercase text-text-primary">{roleLabel(displayRole)} <strong className="text-accent">{ratingForRole(member, displayRole) ?? "–"}</strong></span>
                  <span className="text-center font-anton text-sm text-text-primary">{member.current_ability ?? "–"}</span><span className="text-center font-anton text-sm text-text-primary">{member.potential_ability ?? "–"}</span>
                  <span className="text-right font-space-mono text-[8px] font-bold text-text-primary">{formatSalary(demand)}</span>
                  <span className="truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{strongestAffinity ? `${strongestAffinity.teamId} · ${strongestAffinity.strength}` : "None"}</span>
                  <span className={`text-center font-space-mono text-[7px] font-bold uppercase ${withinBudget ? "text-success" : "text-danger"}`}>{withinBudget ? "Within" : "Over"}</span>
                  <span className={`text-right font-space-mono text-[7px] font-bold uppercase ${marketScope === "free_agents" ? "text-success" : "text-gold"}`}>{marketScope === "free_agents" ? "Available" : teams.find((team) => team.id === contract?.teamId)?.shortName ?? "Contracted"}</span>
                </button>
              );
            })}
            {filteredRecruitmentPool.length === 0 && <div className="flex h-full min-h-20 items-center justify-center font-space-mono text-[9px] uppercase text-text-secondary">No staff match these filters</div>}
          </div>
        </section>
        {selectedMember && selectedAssignment && <StaffProfileModal member={selectedMember} assignment={selectedAssignment} team={selectedTeam} allowContractActions onClose={() => setSelectedStaffId(null)} />}
      </div>
    );
  }

  if (mode === "league") {
    const activeTeam = visibleTeams.find((team) => team.id === selectedLeagueTeamId) ?? visibleTeams[0];
    const activeAssignments = activeTeam ? assignmentsByTeam.get(activeTeam.id) ?? [] : [];
    const activeStaff = Array.from(new Set(activeAssignments.map((assignment) => assignment.staff_id))).map((staffId) => {
      const member = memberById.get(staffId);
      if (!member) return null;
      const assignments = activeAssignments.filter((assignment) => assignment.staff_id === staffId);
      const primary = assignments.find((assignment) => assignment.role === member.primary_role) ?? assignments[0];
      return { member, primary, secondary: assignments.find((assignment) => assignment !== primary) };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const headCoach = activeTeam ? Object.values(careerStaff.contracts).find((contract) => contract.teamId === activeTeam.id && contract.status === "contracted" && contract.roles.includes("head_coach")) : undefined;
    const review = activeTeam ? [...careerStaff.performanceReviews].sort((left, right) => right.season - left.season).find((item) => item.teamId === activeTeam.id && item.headCoachStaffId === headCoach?.staffId) : undefined;
    const directory = marketScope === "free_agents" ? freeAgents : contractedRecruitmentTargets;
    const activeVacancySearches = activeTeam ? careerStaff.recruitmentSearches.filter((search) => (
      search.teamId === activeTeam.id && search.status === "active"
    )) : [];
    const exactPersonnelDate = (event: typeof careerStaff.employmentHistory[number]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(event.effectiveOn)) return event.effectiveOn;
      const archivedFixtures = careerSeasonArchives.find((archive) => archive.season === event.season)?.fixtures as Array<{ stage?: string; date?: string }> | undefined;
      const finalDate = archivedFixtures?.find((fixture) => fixture.stage === "final")?.date;
      if (finalDate && /^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return addDaysToDateKey(finalDate, 1);
      return `${event.season}-06-02`;
    };
    const rawPersonnelChanges = activeTeam ? careerStaff.employmentHistory.filter((event) => event.teamId === activeTeam.id) : [];
    const personnelChanges = rawPersonnelChanges
      .filter((event) => {
        const sameTransaction = (candidate: typeof event) => candidate.staffId === event.staffId
          && candidate.teamId === event.teamId && candidate.effectiveOn === event.effectiveOn;
        if (event.kind === "contract_renewed") return !rawPersonnelChanges.some((candidate) => sameTransaction(candidate) && candidate.kind === "role_changed");
        if (event.kind === "role_changed") return !rawPersonnelChanges.some((candidate) => sameTransaction(candidate) && candidate.kind === "appointed");
        return true;
      })
      .map((event) => {
        if (event.kind !== "appointed") return event;
        const roleChange = rawPersonnelChanges.find((candidate) => candidate.staffId === event.staffId
          && candidate.teamId === event.teamId && candidate.effectiveOn === event.effectiveOn && candidate.kind === "role_changed");
        return roleChange ? { ...event, roles: roleChange.roles } : event;
      })
      .map((event) => ({ ...event, displayDate: exactPersonnelDate(event) }))
      .sort((left, right) => {
        const dateOrder = right.displayDate.localeCompare(left.displayDate);
        if (dateOrder !== 0) return dateOrder;
        const sequence = (kind: typeof left.kind) => kind === "released" || kind === "contract_expired" ? 0
          : kind === "role_changed" || kind === "contract_renewed" ? 1 : 2;
        return sequence(left.kind) - sequence(right.kind) || right.id.localeCompare(left.id);
      });
    const personnelChangeLabel = (event: typeof personnelChanges[number]) => {
      if (event.kind === "appointed") return "Hired";
      if (event.kind === "contract_renewed") return "Contract renewed";
      if (event.kind === "role_changed") return "Roles changed";
      if (event.kind === "contract_expired") return "Contract expired";
      if (event.reason === "club_sacked") return "Fired";
      if (event.reason === "staff_resigned") return "Resigned";
      if (event.reason === "retired") return "Retired";
      return "Left club";
    };
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
        <header className="flex shrink-0 items-center justify-between border-2 border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center bg-[var(--ink)] text-bg"><UsersRound className="size-5" /></div><div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">League staff intelligence · {currentSeason}</p><h2 className="font-anton text-2xl uppercase leading-none text-text-primary">Coaching Directory</h2></div></div>
          <div className="flex divide-x divide-border font-space-mono text-[8px] font-bold uppercase text-text-secondary"><span className="px-4"><b className="mr-1 font-anton text-base text-text-primary">{contractedRecruitmentTargets.length}</b> employed</span><span className="px-4"><b className="mr-1 font-anton text-base text-text-primary">{freeAgents.length}</b> available</span><span className="pl-4"><b className="mr-1 font-anton text-base text-text-primary">{expiringContractCount}</b> expiring</span></div>
        </header>

        <nav className="grid shrink-0 grid-cols-9 border-x-2 border-b-2 border-border bg-surface" aria-label="Select club">
          {visibleTeams.map((team) => {
            const selected = team.id === activeTeam?.id;
            const count = new Set((assignmentsByTeam.get(team.id) ?? []).map((assignment) => assignment.staff_id)).size;
            return <button key={team.id} type="button" onClick={() => setSelectedLeagueTeamId(team.id)} className={`relative flex items-center justify-center gap-2 border-r border-border px-2 py-2.5 last:border-r-0 ${selected ? "bg-accent/10" : "hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"}`}><span className="flex size-8 items-center justify-center rounded font-anton text-[11px]" style={{ backgroundColor: team.primaryColor, color: team.textColor ?? "#fff" }}>{team.shortName}</span><span className="hidden text-left xl:block"><span className="block font-anton text-sm uppercase leading-none text-text-primary">{team.shortName}</span><span className="mt-1 block font-space-mono text-[6px] font-bold uppercase text-text-secondary">{count} staff</span></span>{selected && <span className="absolute inset-x-0 bottom-0 h-1 bg-accent" />}</button>;
          })}
        </nav>

        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(13rem,0.6fr)] gap-3 pt-3">
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_19rem] gap-3">
            <section className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
              <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-5 py-3" style={{ borderTop: `5px solid ${activeTeam?.primaryColor ?? "var(--accent)"}` }}>
                <div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-text-secondary">{activeTeam?.name} · Coaching department</p><h3 className="mt-1 font-anton text-xl uppercase leading-none text-text-primary">Current Staff</h3></div>
                <div className="flex divide-x divide-border text-right">
                  <div className="px-4"><p className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Personnel</p><p className="mt-1 font-anton text-base leading-none text-text-primary">{activeStaff.length} <span className="font-space-mono text-[6px] uppercase text-text-secondary">· {activeAssignments.length} roles</span></p></div>
                  <div className="px-4"><p className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Staff spend</p><p className="mt-1 font-anton text-base leading-none text-text-primary">{formatSalary(activeTeam ? careerStaff.financesByTeam[activeTeam.id]?.committedSalary ?? 0 : 0)}</p></div>
                  <div className="pl-4"><p className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Expiring {currentSeason}</p><p className="mt-1 font-anton text-base leading-none text-text-primary">{activeTeam ? Object.values(careerStaff.contracts).filter((contract) => contract.teamId === activeTeam.id && contract.endSeason === currentSeason).length : 0}</p></div>
                </div>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto">
                {activeStaff.map(({ member, primary, secondary }) => {
                  const contract = careerStaff.contracts[member.id];
                  return <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group flex min-h-[66px] items-center gap-3 border-b border-r border-hairline px-4 py-2.5 text-left hover:bg-accent/5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.055] font-space-mono text-[8px] font-bold text-text-primary dark:bg-white/[0.08]">{initials(member.full_name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-text-primary group-hover:underline">{member.full_name}</span><span className="mt-1 block truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{roleLabel(primary.role)}{secondary ? ` · ${roleLabel(secondary.role)}` : ""}</span></span><span className="text-right"><span className="block font-anton text-lg leading-none text-text-primary">{ratingForRole(member, primary.role) ?? "–"}</span><span className="mt-1 block font-space-mono text-[6px] uppercase text-text-secondary">{contract?.endSeason ?? "Rolling"}</span></span></button>;
                })}
                {activeVacancySearches.map((search) => {
                  const interim = search.interimStaffId ? memberById.get(search.interimStaffId) : null;
                  return <div key={search.id} className="flex min-h-[66px] items-center gap-3 border-b border-r border-gold/30 bg-gold/5 px-4 py-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-gold font-anton text-lg text-gold">+</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-text-primary">Vacant · {roleLabel(search.role)}</span><span className="mt-1 block truncate font-space-mono text-[7px] font-bold uppercase text-gold">Replacement search active{interim ? ` · ${interim.full_name} interim` : ""}</span></span><span className="shrink-0 text-right"><span className="block font-space-mono text-[6px] font-bold uppercase text-text-secondary">Decision</span><span className="mt-1 block font-space-mono text-[7px] text-text-primary">{search.decisionOn}</span></span></div>;
                })}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
              <div className="shrink-0 border-b-2 border-border px-4 py-3"><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-text-secondary">Club timeline</p><div className="mt-1 flex items-center justify-between"><h3 className="font-anton text-lg uppercase leading-none text-text-primary">Personnel Changes</h3><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{personnelChanges.length} recorded</span></div></div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {personnelChanges.map((event) => {
                  const member = memberById.get(event.staffId);
                  const departure = event.kind === "released" || event.kind === "contract_expired";
                  const roleChange = event.kind === "role_changed";
                  return (
                    <button key={event.id} type="button" onClick={() => member && setSelectedStaffId(member.id)} disabled={!member} className="block w-full border-b border-hairline px-4 py-3 text-left hover:bg-black/[0.025] disabled:cursor-default dark:hover:bg-white/[0.025]">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-text-primary">{member?.full_name ?? event.staffId}</p><p className={`mt-1 font-space-mono text-[7px] font-bold uppercase ${departure ? "text-danger" : "text-success"}`}>{personnelChangeLabel(event)}</p></div><span className="shrink-0 font-space-mono text-[7px] text-text-secondary">{event.displayDate}</span></div>
                      <p className="mt-2 truncate font-space-mono text-[7px] uppercase text-text-secondary">{roleChange && event.previousRoles?.length ? `${event.previousRoles.map(roleLabel).join(" + ")} → ` : ""}{event.roles.length ? event.roles.map(roleLabel).join(" + ") : event.reason ? humanizeValue(event.reason) : "No role recorded"}</p>
                    </button>
                  );
                })}
                {personnelChanges.length === 0 && <div className="flex h-full min-h-32 items-center justify-center px-5 text-center"><p className="font-space-mono text-[8px] font-bold uppercase leading-relaxed text-text-secondary">No hires, departures, renewals or role changes recorded yet</p></div>}
              </div>
            </aside>
          </div>

          <section className="flex min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
            <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-4 py-2.5"><div className="flex items-center gap-5"><div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-text-secondary">League-wide directory</p><h3 className="font-anton text-base uppercase leading-none text-text-primary">Staff Market</h3></div><div className="flex overflow-hidden rounded border border-border bg-bg"><button type="button" onClick={() => setMarketScope("free_agents")} className={`px-4 py-2 font-space-mono text-[7px] font-bold uppercase ${marketScope === "free_agents" ? "bg-accent text-white" : "text-text-secondary"}`}>Free agents · {freeAgents.length}</button><button type="button" onClick={() => setMarketScope("contracted")} className={`px-4 py-2 font-space-mono text-[7px] font-bold uppercase ${marketScope === "contracted" ? "bg-[var(--ink)] text-bg" : "text-text-secondary"}`}>Other staff · {contractedRecruitmentTargets.length}</button></div></div><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Select a name for the full profile</span></div>
            <div className="grid min-h-0 flex-1 grid-cols-3 content-start overflow-y-auto">
              {directory.map((member) => {
                const contract = careerStaff.contracts[member.id]; const club = teams.find((team) => team.id === contract?.teamId); const role = contract?.primaryRole ?? member.primary_role;
                return <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group flex min-w-0 items-center gap-3 border-b border-r border-hairline px-4 py-2 text-left hover:bg-accent/5"><span className="flex size-8 shrink-0 items-center justify-center rounded font-anton text-[9px]" style={{ backgroundColor: marketScope === "contracted" ? club?.primaryColor ?? "var(--border)" : "var(--border)", color: marketScope === "contracted" ? club?.textColor ?? "#fff" : "var(--text-primary)" }}>{marketScope === "contracted" ? club?.shortName ?? "?" : initials(member.full_name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-text-primary group-hover:underline">{member.full_name}</span><span className="mt-0.5 block truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{roleLabel(role)}{club ? ` · ${club.shortName}` : ""}</span></span><span className="font-anton text-base text-text-primary">{ratingForRole(member, role) ?? "–"}</span></button>;
              })}
            </div>
          </section>
        </main>
        {selectedMember && selectedAssignment && <StaffProfileModal member={selectedMember!} assignment={selectedAssignment!} team={selectedTeam} allowContractActions={false} onClose={() => setSelectedStaffId(null)} />}
      </div>
    );
  }

  if (false) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
        <header className="flex shrink-0 items-center justify-between rounded-lg border-2 border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded bg-[var(--ink)] text-bg"><UsersRound className="size-5" /></div>
            <div>
              <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.22em] text-text-secondary">League staff intelligence · {currentSeason}</p>
              <h2 className="font-anton text-xl uppercase leading-none text-text-primary">League Staff</h2>
            </div>
          </div>
          <div className="flex items-center gap-5 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
            <span>{visibleTeams.length} other clubs</span>
            <span>{contractedRecruitmentTargets.length} contracted staff</span>
            <span>{freeAgents.length} free agents</span>
            <span>{expiringContractCount} expiring</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.55fr)_minmax(12rem,0.72fr)] gap-3 overflow-hidden">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
              <div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-accent">Club overview</p><h3 className="font-anton text-base uppercase leading-none text-text-primary">Coaching Teams</h3></div>
              <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Select any name for profile, roles and contract</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-px overflow-hidden bg-border xl:grid-cols-5">
              {visibleTeams.map((team) => {
                const assignments = assignmentsByTeam.get(team.id) ?? [];
                const staffEntries = Array.from(new Set(assignments.map((assignment) => assignment.staff_id))).map((staffId) => {
                  const member = memberById.get(staffId);
                  if (!member) return null;
                  const staffAssignments = assignments.filter((assignment) => assignment.staff_id === staffId);
                  const primaryAssignment = staffAssignments.find((assignment) => assignment.role === member.primary_role) ?? staffAssignments[0];
                  return { member, primaryAssignment, secondaryAssignment: staffAssignments.find((assignment) => assignment !== primaryAssignment) };
                }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
                const currentHeadCoach = Object.values(careerStaff.contracts).find((contract) => contract.status === "contracted" && contract.teamId === team.id && contract.roles.includes("head_coach"));
                const latestReview = [...careerStaff.performanceReviews].sort((left, right) => right.season - left.season)
                  .find((review) => review.teamId === team.id && review.headCoachStaffId === currentHeadCoach?.staffId);
                const pressure = latestReview?.effectivePressure ?? 0;
                return (
                  <article key={team.id} className="flex min-h-0 flex-col overflow-hidden bg-surface" style={{ borderTop: `4px solid ${team.primaryColor}` }}>
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded font-anton text-[10px]" style={{ backgroundColor: team.primaryColor, color: team.textColor ?? "#fff" }}>{team.shortName}</span>
                        <div className="min-w-0"><p className="truncate font-anton text-sm uppercase leading-none text-text-primary">{team.shortName}</p><p className="mt-0.5 font-space-mono text-[6px] font-bold uppercase text-text-secondary">{staffEntries.length} staff</p></div>
                      </div>
                      <div className="shrink-0 text-right"><p className="font-anton text-[11px] leading-none text-text-primary">{formatSalary(careerStaff.financesByTeam[team.id]?.committedSalary ?? 0)}</p><p className={`mt-1 font-space-mono text-[6px] font-bold uppercase ${!currentHeadCoach || pressure >= 65 ? "text-danger" : pressure >= 35 ? "text-gold" : "text-success"}`}>{!currentHeadCoach ? "Vacant" : `${latestReview ? humanizeValue(latestReview.security) : "Secure"} ${pressure.toFixed(0)}`}</p></div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {staffEntries.map(({ member, primaryAssignment, secondaryAssignment }) => (
                        <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-hairline px-2.5 py-1.5 text-left hover:bg-accent/5">
                          <div className="min-w-0"><p className="truncate text-[11px] font-bold leading-tight text-text-primary group-hover:underline">{member.full_name}</p><p className="truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">{roleLabel(primaryAssignment.role)}{secondaryAssignment ? ` + ${roleLabel(secondaryAssignment.role)}` : ""}</p></div>
                          <div className="text-right"><span className="font-anton text-sm leading-none text-text-primary">{ratingForRole(member, primaryAssignment.role) ?? "–"}</span>{secondaryAssignment && <span className="ml-1 font-space-mono text-[6px] font-bold text-accent">/{ratingForRole(member, secondaryAssignment.role) ?? "–"}</span>}</div>
                        </button>
                      ))}
                      {staffEntries.length === 0 && <p className="px-3 py-5 text-center font-space-mono text-[7px] font-bold uppercase text-text-secondary">No staff assigned</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="grid min-h-0 grid-cols-2 gap-3 overflow-hidden">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-accent">Available now</p><h3 className="font-anton text-sm uppercase leading-none text-text-primary">Free Agents</h3></div><span className="font-space-mono text-[7px] font-bold text-text-secondary">{freeAgents.length}</span></div>
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto">
                {freeAgents.map((member) => (
                  <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group flex min-w-0 items-center gap-2 border-b border-r border-hairline px-3 py-1.5 text-left hover:bg-accent/5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-space-mono text-[6px] font-bold text-text-primary">{initials(member.full_name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-text-primary group-hover:underline">{member.full_name}</span><span className="block truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">{roleLabel(member.primary_role)}</span></span>
                    <span className="font-anton text-sm text-text-primary">{ratingForRole(member, member.primary_role) ?? "–"}</span>
                  </button>
                ))}
                {freeAgents.length === 0 && <p className="col-span-2 px-3 py-5 text-center font-space-mono text-[7px] font-bold uppercase text-text-secondary">No free agents</p>}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-gold">League directory</p><h3 className="font-anton text-sm uppercase leading-none text-text-primary">Other Staff</h3></div><span className="font-space-mono text-[7px] font-bold text-text-secondary">{contractedRecruitmentTargets.length}</span></div>
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto">
                {contractedRecruitmentTargets.map((member) => {
                  const contract = careerStaff.contracts[member.id];
                  const club = teams.find((team) => team.id === contract?.teamId);
                  return (
                    <button key={member.id} type="button" onClick={() => setSelectedStaffId(member.id)} className="group flex min-w-0 items-center gap-2 border-b border-r border-hairline px-3 py-1.5 text-left hover:bg-gold/5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded font-anton text-[7px]" style={{ backgroundColor: club?.primaryColor ?? "var(--border)", color: club?.textColor ?? "#fff" }}>{club?.shortName ?? "?"}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-text-primary group-hover:underline">{member.full_name}</span><span className="block truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">{roleLabel(contract?.primaryRole ?? member.primary_role)}</span></span>
                      <span className="font-anton text-sm text-text-primary">{ratingForRole(member, contract?.primaryRole ?? member.primary_role) ?? "–"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
        {selectedMember && selectedAssignment && <StaffProfileModal member={selectedMember!} assignment={selectedAssignment!} team={selectedTeam} allowContractActions={false} onClose={() => setSelectedStaffId(null)} />}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <div className="mb-5 flex flex-col gap-3 border-2 border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded bg-[var(--ink)] text-bg">
            <BriefcaseBusiness className="size-5" />
          </div>
          <div>
            <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-secondary">{mode === "club" ? "Your club · contracts and recruitment" : `League staff intelligence · ${currentSeason}`}</p>
            <h2 className="font-anton text-2xl uppercase leading-none text-text-primary">{mode === "club" ? "Staff Management" : "League Staff"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">
          <span>{visibleTeams.length} {visibleTeams.length === 1 ? "club" : "clubs"}</span>
          <span>{mode === "club" ? userStaffContracts.length : displayData?.assignments.filter((assignment) => assignment.team_id !== userTeamId).length ?? 0} staff</span>
          <span>{expiringContractCount} expiring</span>
        </div>
      </div>

      {mode === "club" && <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <section className="border-2 border-border bg-surface p-4">
          <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">Annual staff budget</p>
          <p className="mt-2 font-anton text-2xl text-text-primary">{formatSalary(userFinance?.annualBudget ?? 0)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded bg-border">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, ((userFinance?.committedSalary ?? 0) / Math.max(1, userFinance?.annualBudget ?? 1)) * 100)}%` }} />
          </div>
          <p className="mt-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
            {formatSalary(userFinance?.committedSalary ?? 0)} committed · {formatSalary(userFinance?.compensationPaid ?? 0)} compensation
          </p>
        </section>
        <section className="border-2 border-border bg-surface p-4">
          <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">Core vacancies</p>
          <p className="mt-2 font-anton text-2xl text-text-primary">{vacantUserRoles.length}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vacantUserRoles.length > 0
              ? vacantUserRoles.map((role) => <span key={role} className="rounded border border-danger/30 bg-danger/10 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-danger">{roleLabel(role)}</span>)
              : <span className="font-space-mono text-[8px] font-bold uppercase text-success">All core roles covered</span>}
          </div>
        </section>
        <section className="border-2 border-border bg-surface p-4">
          <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">Recent league activity</p>
          <div className="mt-2 space-y-2">
            {recentStaffEvents.length > 0 ? recentStaffEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-text-primary">{memberById.get(event.staffId)?.full_name ?? "Staff member"}</span>
                <span className="shrink-0 font-space-mono text-[7px] font-bold uppercase text-text-secondary">{event.teamId ?? "FA"} · {humanizeValue(event.kind)}</span>
              </div>
            )) : <p className="font-space-mono text-[8px] uppercase text-text-secondary">No career transactions yet</p>}
          </div>
        </section>
      </div>}

      {true && (
        <section className="mb-4 overflow-hidden border-2 border-border bg-surface">
          <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
            <div>
              <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">Career transaction register</p>
              <h3 className="mt-1 font-anton text-lg uppercase text-text-primary">All League Hires &amp; Departures</h3>
            </div>
            <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{leagueStaffEvents.length} recorded</span>
          </div>
          <div className="max-h-56 divide-y divide-hairline overflow-y-auto">
            {leagueStaffEvents.map((event) => {
              const eventTeam = teams.find((team) => team.id === event.teamId);
              return (
                <div key={event.id} className="grid grid-cols-[7rem_minmax(0,1fr)_9rem_8rem] items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="font-space-mono text-[8px] font-bold text-text-secondary">{event.effectiveOn}</span>
                  <span className="truncate font-bold text-text-primary">{memberById.get(event.staffId)?.full_name ?? event.staffId}</span>
                  <span className="truncate font-space-mono text-[8px] font-bold uppercase text-text-secondary">{eventTeam?.shortName ?? event.teamId ?? "Free agent"}</span>
                  <span className={`text-right font-space-mono text-[8px] font-bold uppercase ${event.kind === "appointed" || event.kind === "contract_renewed" ? "text-success" : "text-danger"}`}>{humanizeValue(event.kind)}</span>
                </div>
              );
            })}
            {leagueStaffEvents.length === 0 && <p className="px-4 py-6 text-center font-space-mono text-[9px] uppercase text-text-secondary">No league staff movements recorded yet</p>}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {visibleTeams.map((team) => {
          const assignments = assignmentsByTeam.get(team.id) ?? [];
          const staffEntries = Array.from(new Set(assignments.map((assignment) => assignment.staff_id)))
            .map((staffId) => {
              const member = memberById.get(staffId);
              if (!member) return null;
              const staffAssignments = assignments.filter((assignment) => assignment.staff_id === staffId);
              const primaryAssignment = staffAssignments.find((assignment) => assignment.role === member.primary_role)
                ?? staffAssignments[0];
              return {
                member,
                primaryAssignment,
                secondaryAssignments: staffAssignments.filter((assignment) => assignment !== primaryAssignment),
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
          const activeSearches = careerStaff.recruitmentSearches.filter((search) => (
            search.teamId === team.id && search.status === "active"
          ));
          const currentHeadCoach = Object.values(careerStaff.contracts).find((contract) => (
            contract.status === "contracted" && contract.teamId === team.id && contract.roles.includes("head_coach")
          ));
          const latestReview = [...careerStaff.performanceReviews]
            .sort((left, right) => right.season - left.season)
            .find((review) => review.teamId === team.id && review.headCoachStaffId === currentHeadCoach?.staffId);
          const securityLabel = !currentHeadCoach
            ? "Vacant"
            : latestReview ? humanizeValue(latestReview.security) : "Secure";
          const displayedPressure = latestReview?.effectivePressure ?? 0;
          const securityColor = !currentHeadCoach
            ? "text-danger"
            : !latestReview
              ? "text-success"
            : latestReview.effectivePressure >= 65
              ? "text-danger"
              : latestReview.effectivePressure >= 35
                ? "text-gold"
                : "text-success";
          return (
            <section key={team.id} className="overflow-hidden border-2 border-border bg-surface shadow-sm">
              <div
                className="flex items-center justify-between border-b-2 border-border px-4 py-3"
                style={{ borderTop: `5px solid ${team.primaryColor}` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded font-anton text-sm"
                    style={{ backgroundColor: team.primaryColor, color: team.textColor ?? "#fff" }}
                  >
                    {team.shortName}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-anton text-lg uppercase leading-none text-text-primary">{team.name}</h3>
                    <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">{staffEntries.length} staff · {assignments.length} positions</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-right">
                  {true && (
                    <div className="border-r border-border pr-3">
                      <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Head coach security</p>
                      <p className={`mt-0.5 font-space-mono text-[8px] font-bold uppercase ${securityColor}`}>{securityLabel}{currentHeadCoach ? ` · ${displayedPressure.toFixed(0)}` : ""}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Annual staff spend</p>
                    <p className="mt-0.5 font-anton text-base leading-none text-text-primary">
                      {formatSalary(careerStaff.financesByTeam[team.id]?.committedSalary ?? 0)}
                    </p>
                  </div>
                  <UsersRound className="size-5 text-text-secondary" />
                </div>
              </div>

              <div className="divide-y divide-hairline">
                {staffEntries.map(({ member, primaryAssignment, secondaryAssignments }) => {
                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => setSelectedStaffId(member.id)}
                      className="group w-full px-4 py-3 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent dark:hover:bg-white/[0.025]"
                      aria-label={`View ${member.full_name}'s staff profile`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06] font-space-mono text-[9px] font-bold text-text-primary dark:bg-white/[0.08]">
                          {initials(member.full_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-barlow text-sm font-bold text-text-primary underline-offset-2 group-hover:underline">{member.full_name}</p>
                          <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">{roleLabel(primaryAssignment.role)}</p>
                        </div>
                        {ratingForRole(member, primaryAssignment.role) !== null && (
                          <div className="shrink-0 text-right">
                            <p className="font-anton text-lg leading-none text-text-primary">{ratingForRole(member, primaryAssignment.role)}</p>
                            <p className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Primary rating</p>
                          </div>
                        )}
                      </div>
                      {secondaryAssignments.map((assignment) => (
                        <div key={assignment.role} className="ml-12 mt-2 flex items-center justify-between gap-3 border-l-2 border-accent/40 bg-accent/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.16em] text-accent">Secondary role</p>
                            <p className="mt-0.5 truncate font-space-mono text-[8px] font-bold uppercase tracking-[0.12em] text-text-primary">{roleLabel(assignment.role)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-anton text-base leading-none text-text-primary">{ratingForRole(member, assignment.role) ?? "–"}</p>
                            <p className="mt-1 font-space-mono text-[6px] font-bold uppercase text-text-secondary">Role ability</p>
                          </div>
                        </div>
                      ))}
                    </button>
                  );
                })}
                {activeSearches.map((search) => {
                  const interim = search.interimStaffId ? memberById.get(search.interimStaffId) : undefined;
                  return (
                    <div key={search.id} className="flex items-center justify-between gap-3 bg-gold/5 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-barlow text-sm font-bold text-text-primary">Vacant · {roleLabel(search.role)}</p>
                        <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">
                          {interim ? `${interim.full_name} serving as interim` : "No interim available"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-space-mono text-[7px] font-bold uppercase text-gold">Recruiting</p>
                        <p className="mt-1 font-space-mono text-[7px] text-text-secondary">Decision {search.decisionOn}</p>
                      </div>
                    </div>
                  );
                })}
                {staffEntries.length === 0 && activeSearches.length === 0 && (
                  <div className="px-4 py-8 text-center font-space-mono text-[9px] uppercase tracking-wider text-text-secondary">No starting staff assigned</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {mode === "club" && <section className="mt-4 overflow-hidden border-2 border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b-2 border-border border-t-[5px] border-t-accent px-4 py-3">
            <div>
              <h3 className="font-anton text-lg uppercase leading-none text-text-primary">Free agents</h3>
              <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">{freeAgents.length} recruitable staff</p>
            </div>
            <BriefcaseBusiness className="size-5 text-text-secondary" />
          </div>
          <div className="grid grid-cols-1 divide-y divide-hairline md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {freeAgents.map((member) => (
              <button
                type="button"
                key={member.id}
                onClick={() => setSelectedStaffId(member.id)}
                className="group flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 font-space-mono text-[9px] font-bold text-text-primary">{initials(member.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text-primary group-hover:underline">{member.full_name}</p>
                  <p className="font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">{roleLabel(member.primary_role)}</p>
                </div>
                <span className="font-anton text-lg text-text-primary">{ratingForRole(member, member.primary_role) ?? "–"}</span>
              </button>
            ))}
            {freeAgents.length === 0 && (
              <div className="px-4 py-8 text-center font-space-mono text-[9px] uppercase tracking-wider text-text-secondary md:col-span-2 xl:col-span-3">
                No unattached staff found
              </div>
            )}
          </div>
        </section>}
      {mode === "club" && <section className="mt-4 overflow-hidden border-2 border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-border border-t-[5px] border-t-gold px-4 py-3">
          <div>
            <h3 className="font-anton text-lg uppercase leading-none text-text-primary">Contracted Recruitment Targets</h3>
            <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Approach staff at another club and define their new responsibilities</p>
          </div>
          <UserPlus className="size-5 text-text-secondary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {contractedRecruitmentTargets.map((member) => {
            const contract = careerStaff.contracts[member.id];
            const club = teams.find((team) => team.id === contract?.teamId);
            return (
              <button type="button" key={member.id} onClick={() => setSelectedStaffId(member.id)} className="group flex items-center gap-3 border-b border-r border-hairline px-4 py-3 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/10 font-space-mono text-[9px] font-bold text-text-primary">{initials(member.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text-primary group-hover:underline">{member.full_name}</p>
                  <p className="font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">{club?.shortName ?? contract?.teamId} · {roleLabel(contract?.primaryRole ?? member.primary_role)}</p>
                </div>
                <span className="font-anton text-lg text-text-primary">{ratingForRole(member, contract?.primaryRole ?? member.primary_role) ?? "–"}</span>
              </button>
            );
          })}
        </div>
      </section>}
      {selectedMember && selectedAssignment && (
        <StaffProfileModal
          member={selectedMember}
          assignment={selectedAssignment}
          team={selectedTeam}
          allowContractActions={mode === "club"}
          onClose={() => setSelectedStaffId(null)}
        />
      )}
    </div>
  );
}
