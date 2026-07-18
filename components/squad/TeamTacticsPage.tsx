"use client";

import {
  ArrowRight,
  Gauge,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  UsersRound,
} from "lucide-react";

import {
  TEAM_STRATEGIES,
  applyTeamTacticsPreset,
  getTacticsRiskProfile,
  type TeamStrategy,
  type TeamTactics,
} from "@/lib/logic/teamTactics";

interface TeamTacticsPageProps {
  tactics: TeamTactics;
  onChange: (tactics: TeamTactics) => void;
  onOpenPlayingXI: () => void;
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

const STRATEGY_DESCRIPTIONS: Record<TeamStrategy, string> = {
  "Ultra Aggressive": "Push the pace in every phase and accept greater volatility.",
  Balanced: "Keep decisions flexible and let squad quality lead the plan.",
  "Anchor & Explode": "Protect wickets early, then commit fully at the death.",
  "Bowling Dominant": "Build the plan around pressure, matchups and wicket-taking.",
};

const choiceGroups = {
  battingPowerplay: [
    { value: "cautious", label: "Cautious", description: "Protect early wickets and settle the innings." },
    { value: "balanced", label: "Balanced", description: "Take normal powerplay risks." },
    { value: "attack", label: "Attack", description: "Chase boundaries from the first over." },
  ],
  battingMiddle: [
    { value: "rebuild", label: "Rebuild", description: "Absorb pressure through overs 7-15." },
    { value: "rotate", label: "Rotate", description: "Prioritise strike rotation and stability." },
    { value: "dominate", label: "Dominate", description: "Attack favourable middle-over matchups." },
  ],
  battingDeath: [
    { value: "preserve", label: "Preserve", description: "Keep enough wickets to finish safely." },
    { value: "flexible", label: "Flexible", description: "Let wickets and match state set the pace." },
    { value: "all-out", label: "All-out", description: "Commit fully to final-five-over scoring." },
  ],
  collapse: [
    { value: "keep-attacking", label: "Keep going", description: "Maintain intent even after quick wickets." },
    { value: "stabilise", label: "Stabilise", description: "Briefly trade tempo for security." },
    { value: "deep-rebuild", label: "Rebuild", description: "Protect the innings after a major collapse." },
  ],
  chase: [
    { value: "stay-with-rate", label: "Track rate", description: "Adjust intent to the required run rate." },
    { value: "preserve-wickets", label: "Go deep", description: "Keep resources for the final phase." },
    { value: "front-load", label: "Front-load", description: "Attack the target in the powerplay." },
  ],
  bowlingPowerplay: [
    { value: "swing-attack", label: "Attack", description: "Use the new ball to hunt wickets." },
    { value: "contain", label: "Contain", description: "Protect the boundary and control the start." },
    { value: "matchups", label: "Matchups", description: "Choose bowlers around the opposition." },
  ],
  bowlingMiddle: [
    { value: "pace", label: "Pace", description: "Lean on the squad's pace depth." },
    { value: "balanced", label: "Mixed", description: "Mix pace and spin around conditions." },
    { value: "spin-choke", label: "Spin", description: "Build pressure through spin and control." },
  ],
  bowlingDeath: [
    { value: "defensive", label: "Defend", description: "Suppress boundaries above all else." },
    { value: "yorkers", label: "Execute", description: "Back accuracy and yorker execution." },
    { value: "wicket-hunt", label: "Attack", description: "Attack the stumps and accept more risk." },
  ],
  field: [
    { value: "defensive", label: "Defensive", description: "Save runs with boundary protection." },
    { value: "balanced", label: "Balanced", description: "Keep a neutral field shape." },
    { value: "attacking", label: "Attacking", description: "Create chances with more catchers." },
  ],
  impact: [
    { value: "extra-batter", label: "Extra batter", description: "Prefer a batting Impact option." },
    { value: "extra-bowler", label: "Extra bowler", description: "Prefer a bowling Impact option." },
    { value: "match-situation", label: "Match situation", description: "Choose around innings and match state." },
  ],
  toss: [
    { value: "bat", label: "Bat", description: "Prefer setting a target." },
    { value: "bowl", label: "Bowl", description: "Prefer chasing a target." },
    { value: "conditions", label: "Read conditions", description: "Let the pitch guide the decision." },
  ],
  opposition: [
    { value: "neutral", label: "Neutral", description: "Play the opposition on merit." },
    { value: "target-weak-bowler", label: "Target weak bowler", description: "Exploit attacks with uneven depth." },
    { value: "play-out-stars", label: "Play out stars", description: "Reduce risk against elite bowlers." },
    { value: "attack-pace", label: "Attack pace", description: "Take extra initiative against pace." },
    { value: "attack-spin", label: "Attack spin", description: "Take extra initiative against spin." },
  ],
} as const;

function ChoiceControl<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="flex min-h-0 flex-col justify-center border border-border bg-surface px-3 py-1.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-space-mono text-[11px] font-bold uppercase tracking-[0.1em] text-text-primary">{title}</p>
        <span className="truncate text-right text-[11px] font-semibold text-accent">{selected.label}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-h-6 border px-1.5 py-0.5 font-space-mono text-[10px] font-bold uppercase leading-tight transition-colors ${active ? "border-accent bg-accent/[0.11] text-text-primary" : "border-border/70 text-text-secondary hover:border-accent/60 hover:text-text-primary"}`}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 truncate text-[10px] leading-tight text-text-secondary">{selected.description}</p>
    </div>
  );
}

function DecisionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <label title={selected.description} className="grid min-h-0 grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 border-t border-border/70 py-1 first:border-t-0">
      <span className="font-space-mono text-[10px] font-bold uppercase tracking-wide text-text-secondary">{label}</span>
      <span className="min-w-0">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="h-7 w-full border border-border bg-surface px-2 text-[11px] font-bold text-text-primary outline-none focus:border-accent"
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </span>
    </label>
  );
}

export default function TeamTacticsPage({ tactics, onChange, onOpenPlayingXI }: TeamTacticsPageProps) {
  const profile = getTacticsRiskProfile(tactics);
  const updateBatting = (update: Partial<TeamTactics["batting"]>) => onChange({
    ...tactics,
    batting: { ...tactics.batting, ...update },
  });
  const updateBowling = (update: Partial<TeamTactics["bowling"]>) => onChange({
    ...tactics,
    bowling: { ...tactics.bowling, ...update },
  });

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-0 flex-col overflow-hidden border-2 border-border bg-black/[0.018] dark:bg-white/[0.018]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--team-primary)] text-[var(--team-accent-text)]"><Sliders size={19} /></span>
          <div className="min-w-0">
            <p className="font-space-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Match blueprint</p>
            <h3 className="mt-0.5 font-anton text-[25px] uppercase leading-none text-text-primary">Team Tactics</h3>
          </div>
        </div>
        <div className="flex items-stretch gap-2">
          {[
            ["Tempo", profile.tempo, 6],
            ["Risk", profile.risk, 8],
            ["Wicket intent", profile.wicketIntent, 6],
          ].map(([label, value, maximum]) => (
            <div key={String(label)} className="flex min-w-[6.5rem] items-center gap-2 border border-border bg-black/[0.018] px-2.5 py-1.5 dark:bg-white/[0.018]">
              <Gauge size={14} className="text-accent" />
              <span><strong className="block font-space-mono text-[12px] text-text-primary">{value}/{maximum}</strong><small className="block whitespace-nowrap font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</small></span>
            </div>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(14rem,0.72fr)_minmax(18rem,1fr)_minmax(18rem,1fr)] gap-3 p-3">
        <section className="grid min-h-0 grid-rows-[auto_repeat(4,minmax(0,1fr))_auto] gap-2">
          <div className="flex items-center gap-2 px-1"><Sparkles size={15} className="text-accent" /><h4 className="font-anton text-[18px] uppercase text-text-primary">Overall approach</h4></div>
          {TEAM_STRATEGIES.map((strategy) => {
            const selected = tactics.preset === strategy;
            return (
              <button
                key={strategy}
                type="button"
                onClick={() => onChange(applyTeamTacticsPreset(tactics, strategy))}
                className={`relative min-h-0 border-2 px-3 py-2 text-left transition-colors ${selected ? "border-accent bg-accent/[0.09]" : "border-border bg-surface hover:border-accent/60"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-anton text-[15px] uppercase leading-none text-text-primary">{strategy}</span>
                  {selected && <span className="font-space-mono text-[9px] font-bold uppercase text-accent">Active</span>}
                </span>
                <span className="mt-1.5 line-clamp-2 block text-[11px] leading-snug text-text-secondary">{STRATEGY_DESCRIPTIONS[strategy]}</span>
              </button>
            );
          })}
          <button type="button" onClick={onOpenPlayingXI} className="group flex items-center gap-3 border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/[0.12] text-accent"><UsersRound size={15} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-[12px] text-text-primary">Assign player roles in Playing XIs</strong><small className="mt-0.5 block truncate text-[10px] text-text-secondary">Roles are set separately for each match plan.</small></span>
            <ArrowRight size={15} className="text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        </section>

        <section className="grid min-h-0 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-2">
          <div className="flex items-center gap-2 px-1"><Swords size={15} className="text-accent" /><h4 className="font-anton text-[18px] uppercase text-text-primary">Batting plan</h4></div>
          <ChoiceControl title="Powerplay" value={tactics.batting.powerplay} options={choiceGroups.battingPowerplay} onChange={(powerplay) => updateBatting({ powerplay })} />
          <ChoiceControl title="Middle overs" value={tactics.batting.middle} options={choiceGroups.battingMiddle} onChange={(middle) => updateBatting({ middle })} />
          <ChoiceControl title="Death overs" value={tactics.batting.death} options={choiceGroups.battingDeath} onChange={(death) => updateBatting({ death })} />
          <ChoiceControl title="After a collapse" value={tactics.batting.collapseResponse} options={choiceGroups.collapse} onChange={(collapseResponse) => updateBatting({ collapseResponse })} />
          <ChoiceControl title="While chasing" value={tactics.batting.chaseApproach} options={choiceGroups.chase} onChange={(chaseApproach) => updateBatting({ chaseApproach })} />
        </section>

        <section className="grid min-h-0 grid-rows-[auto_repeat(4,minmax(0,1fr))_minmax(0,1.75fr)] gap-2">
          <div className="flex items-center gap-2 px-1"><Shield size={15} className="text-accent" /><h4 className="font-anton text-[18px] uppercase text-text-primary">Bowling and decisions</h4></div>
          <ChoiceControl title="Powerplay" value={tactics.bowling.powerplay} options={choiceGroups.bowlingPowerplay} onChange={(powerplay) => updateBowling({ powerplay })} />
          <ChoiceControl title="Middle overs" value={tactics.bowling.middle} options={choiceGroups.bowlingMiddle} onChange={(middle) => updateBowling({ middle })} />
          <ChoiceControl title="Death overs" value={tactics.bowling.death} options={choiceGroups.bowlingDeath} onChange={(death) => updateBowling({ death })} />
          <ChoiceControl title="Field setting" value={tactics.bowling.field} options={choiceGroups.field} onChange={(field) => updateBowling({ field })} />
          <div className="min-h-0 border border-border bg-surface px-3 py-1 shadow-sm">
            <DecisionSelect label="Impact policy" value={tactics.impactPolicy} options={choiceGroups.impact} onChange={(impactPolicy) => onChange({ ...tactics, impactPolicy })} />
            <DecisionSelect label="Toss" value={tactics.tossPreference} options={choiceGroups.toss} onChange={(tossPreference) => onChange({ ...tactics, tossPreference })} />
            <DecisionSelect label="Opposition" value={tactics.oppositionPlan} options={choiceGroups.opposition} onChange={(oppositionPlan) => onChange({ ...tactics, oppositionPlan })} />
          </div>
        </section>
      </div>
    </div>
  );
}
