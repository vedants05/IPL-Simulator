"use client";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description: string;
  compactDescription?: string;
}

export const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  "Ultra Aggressive": "Push the pace in every phase and accept greater volatility.",
  Balanced: "Keep decisions flexible and let squad quality lead the plan.",
  "Anchor & Explode": "Protect wickets early, then commit fully at the death.",
  "Bowling Dominant": "Build the plan around pressure, matchups and wicket-taking.",
};

export const choiceGroups = {
  battingPowerplay: [
    { value: "cautious", label: "Cautious", description: "Protect early wickets and settle the innings.", compactDescription: "Protect wickets" },
    { value: "balanced", label: "Balanced", description: "Take normal powerplay risks.", compactDescription: "Normal risk" },
    { value: "attack", label: "Attack", description: "Chase boundaries from the first over.", compactDescription: "Seek boundaries" },
  ],
  battingMiddle: [
    { value: "rebuild", label: "Rebuild", description: "Absorb pressure through overs 7-15.", compactDescription: "Absorb pressure" },
    { value: "rotate", label: "Rotate", description: "Prioritise strike rotation and stability.", compactDescription: "Take singles" },
    { value: "dominate", label: "Dominate", description: "Attack favourable matchups.", compactDescription: "Target matchups" },
  ],
  battingDeath: [
    { value: "preserve", label: "Preserve", description: "Protect wickets.", compactDescription: "Protect wickets" },
    { value: "flexible", label: "Flexible", description: "Adjust to the score.", compactDescription: "Read the score" },
    { value: "all-out", label: "All-out", description: "Maximise scoring.", compactDescription: "Maximise runs" },
  ],
  collapse: [
    { value: "keep-attacking", label: "Keep going", description: "Keep attacking.", compactDescription: "Attack" },
    { value: "stabilise", label: "Stabilise", description: "Reduce risk briefly.", compactDescription: "Cut risk" },
    { value: "deep-rebuild", label: "Rebuild", description: "Prioritise survival.", compactDescription: "Survive" },
  ],
  chase: [
    { value: "stay-with-rate", label: "Track rate", description: "Adjust intent to the required run rate.", compactDescription: "Match RRR" },
    { value: "preserve-wickets", label: "Go deep", description: "Keep resources for the final phase.", compactDescription: "Save wickets" },
    { value: "front-load", label: "Front-load", description: "Attack the target in the powerplay.", compactDescription: "Attack early" },
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

export function ChoiceControl<T extends string>({
  title,
  value,
  options,
  onChange,
  descriptionInHeader = false,
  compact = false,
  readOnly = false,
}: {
  title: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  descriptionInHeader?: boolean;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="flex min-h-0 flex-col justify-center border border-border bg-surface px-3 py-1.5 shadow-sm">
      <div className={`flex items-center justify-between gap-3 ${compact ? "lg:gap-1.5" : ""}`}>
        <div className={`flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 ${compact ? "lg:flex-nowrap lg:gap-x-1.5" : ""}`}>
          <p title={compact ? title : undefined} className={`font-space-mono text-[11px] font-bold uppercase tracking-[0.1em] text-text-primary ${compact ? "lg:min-w-0 lg:truncate xl:shrink-0" : ""}`}>{title}</p>
          {descriptionInHeader && <p title={compact ? selected.description : undefined}
            className={`text-[10px] leading-tight text-text-secondary ${compact ? "lg:shrink-0 lg:whitespace-nowrap" : ""}`}>
            {compact ? selected.compactDescription ?? selected.description : selected.description}
          </p>}
        </div>
        <span className={`shrink-0 text-right text-[11px] font-semibold text-accent ${compact ? "lg:hidden xl:inline" : ""}`}>{selected.label}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={readOnly}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`min-h-6 border px-1.5 py-0.5 font-space-mono text-[10px] font-bold uppercase leading-tight transition-colors ${compact ? "lg:whitespace-nowrap lg:px-0.5 lg:text-[9px]" : ""} ${active ? "border-accent bg-accent/[0.11] text-text-primary" : `border-border/70 text-text-secondary ${readOnly ? "" : "hover:border-accent/60 hover:text-text-primary"}`}`}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!descriptionInHeader && <p className="mt-1 truncate text-[10px] leading-tight text-text-secondary">{selected.description}</p>}
    </div>
  );
}

export function DecisionSelect<T extends string>({
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

