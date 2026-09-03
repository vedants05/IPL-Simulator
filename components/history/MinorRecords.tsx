"use client";
import { useMemo, useState } from "react";
import { MINOR_RECORDS, type MinorRecord } from "@/lib/data/minorRecords";
import { LEAGUE_HISTORY_TEAMS } from "@/lib/data/leagueHistory";

const labels: Record<string, string> = {
  all: "All records", batting_position: "Batting positions", partnership_position: "Partnerships",
  season_batting: "Season batting", season_bowling: "Season bowling", milestone: "Milestones",
  fielding: "Fielding", team: "Team records",
};

function getHistoryTeam(holder: string) {
  return LEAGUE_HISTORY_TEAMS[holder]
    ?? Object.values(LEAGUE_HISTORY_TEAMS).find((team) => (
      team.name === holder || team.shortName === holder
    ));
}

interface MinorRecordsProps {
  minorRecords?: MinorRecord[];
}

export default function MinorRecords({ minorRecords = MINOR_RECORDS }: MinorRecordsProps) {
  const [category, setCategory] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Group and sort team highest scores
  const highestScores = useMemo(() => {
    return minorRecords.filter(r => r.category === "team" && r.id.startsWith("highest-score-"))
      .sort((a, b) => {
        const valA = parseInt(a.value.split('/')[0]);
        const valB = parseInt(b.value.split('/')[0]);
        return valB - valA;
      });
  }, [minorRecords]);

  // Group and sort team lowest scores
  const lowestScores = useMemo(() => {
    return minorRecords.filter(r => r.category === "team" && r.id.startsWith("lowest-score-") && r.id !== "lowest-score-defended")
      .sort((a, b) => {
        const valA = parseInt(a.value.split('/')[0]);
        const valB = parseInt(b.value.split('/')[0]);
        return valA - valB;
      });
  }, [minorRecords]);

  // Group and sort batting position highest scores
  const battingPosScores = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("highest-score-pos-"))
      .sort((a, b) => {
        const posA = parseInt(a.id.split('-').pop() ?? "0");
        const posB = parseInt(b.id.split('-').pop() ?? "0");
        return posA - posB;
      });
  }, [minorRecords]);

  // Group and sort batting position highest season runs
  const seasonBattingPosRuns = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("season-most-runs-pos-"))
      .sort((a, b) => {
        const posA = parseInt(a.id.split('-').pop() ?? "0");
        const posB = parseInt(b.id.split('-').pop() ?? "0");
        return posA - posB;
      });
  }, [minorRecords]);

  const allTimeBattingSeasons = useMemo(() => minorRecords
    .filter((record) => record.id.startsWith("all-time-season-runs-"))
    .sort((left, right) => Number.parseInt(right.value, 10) - Number.parseInt(left.value, 10))
    .slice(0, 10), [minorRecords]);

  // Group and sort partnerships by position
  const partnershipPosScores = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("highest-partnership-pos-"))
      .sort((a, b) => {
        const posA = parseInt(a.id.split('-').pop() ?? "0");
        const posB = parseInt(b.id.split('-').pop() ?? "0");
        return posA - posB;
      });
  }, [minorRecords]);



  // Group and sort lowest defended totals by team
  const lowestDefendedTotals = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("lowest-defended-totals-"))
      .sort((a, b) => {
        const valA = parseInt(a.value.split('/')[0]);
        const valB = parseInt(b.value.split('/')[0]);
        return valA - valB;
      });
  }, [minorRecords]);

  // Group and sort highest successful run chases by team
  const highestRunsChased = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("highest-runs-chased-"))
      .sort((a, b) => {
        const valA = parseInt(a.value.split('/')[0]);
        const valB = parseInt(b.value.split('/')[0]);
        return valB - valA;
      });
  }, [minorRecords]);



  // Group and sort runs by age (21-44)
  const runsByAge = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("runs-by-age-"))
      .sort((a, b) => {
        const ageA = parseInt(a.id.split('-').pop() ?? "0");
        const ageB = parseInt(b.id.split('-').pop() ?? "0");
        return ageA - ageB;
      });
  }, [minorRecords]);

  // Group and sort wickets by age (21-44)
  const wicketsByAge = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("wickets-by-age-"))
      .sort((a, b) => {
        const ageA = parseInt(a.id.split('-').pop() ?? "0");
        const ageB = parseInt(b.id.split('-').pop() ?? "0");
        return ageA - ageB;
      });
  }, [minorRecords]);

  // Group fastest to wickets in season (ends with -wickets)
  const fastestWickets = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("fastest-") && r.id.endsWith("-wickets"))
      .sort((a, b) => {
        const wktA = parseInt(a.id.split('-')[1]);
        const wktB = parseInt(b.id.split('-')[1]);
        return wktA - wktB;
      });
  }, [minorRecords]);

  // Group fastest to season runs by balls (ends with -balls, excludes sixes)
  const fastestSeasonRunsBalls = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("fastest-") && r.id.endsWith("-balls") && !r.id.includes("sixes"))
      .sort((a, b) => {
        const runsA = parseInt(a.id.split('-')[1]);
        const runsB = parseInt(b.id.split('-')[1]);
        return runsA - runsB;
      });
  }, [minorRecords]);

  // Group fastest to season runs by innings (ends with -innings)
  const fastestSeasonRunsInnings = useMemo(() => {
    return minorRecords.filter(r => r.id.startsWith("fastest-") && r.id.endsWith("-innings"))
      .sort((a, b) => {
        const runsA = parseInt(a.id.split('-')[1]);
        const runsB = parseInt(b.id.split('-')[1]);
        return runsA - runsB;
      });
  }, [minorRecords]);



  // Check if a record belongs to any of our grouped tables
  const isGroupedRecord = (record: MinorRecord) => {
    const id = record.id;
    return (record.category === "team" && (id.startsWith("highest-score-") || id.startsWith("lowest-score-"))) ||
           id.startsWith("highest-score-pos-") ||
           id.startsWith("highest-partnership-pos-") ||
           id.startsWith("all-time-season-runs-") ||
           id.startsWith("season-most-runs-") ||
           id.startsWith("season-most-wickets-") ||
           id.startsWith("lowest-defended-totals-") ||
           id.startsWith("highest-runs-chased-") ||
           id.startsWith("career-runs-") ||
           id.startsWith("career-wickets-") ||
           id.startsWith("career-sixes-") ||
           id.startsWith("career-centuries-") ||
           id.startsWith("career-fifties-") ||
           id.startsWith("runs-by-age-") ||
           id.startsWith("wickets-by-age-") ||
           (id.startsWith("fastest-") && (
             id.endsWith("-wickets") ||
             (id.endsWith("-balls") && !id.includes("sixes")) ||
             id.endsWith("-innings") ||
             id.includes("-runs-matches") ||
             id.includes("-sixes-balls") ||
             id.includes("-wickets-spinners")
           ));
  };

  const records = useMemo(() => minorRecords.filter((record) => (
    (category === "all" || record.category === category) && 
    (!verifiedOnly || record.verified) &&
    !isGroupedRecord(record)
  )), [category, verifiedOnly, minorRecords]);

  const teamGameRecords = useMemo(() => {
    return records.filter(r => 
      r.category === "team" && 
      (r.id === "largest-victory-runs" || 
       r.id === "most-runs-in-match" || 
       r.id === "most-sixes-in-match" || 
       r.id === "most-boundaries-in-match" || 
       r.id === "lowest-score-defended" || 
       r.id === "most-extras-in-innings")
    );
  }, [records]);

  const teamSeasonalRecords = useMemo(() => {
    return records.filter(r => 
      r.category === "team" && 
      (r.id === "most-consecutive-wins" || 
       r.id === "highest-auction-purse-spent" || 
       r.id === "most-ipl-finals-team")
    );
  }, [records]);

  const nonTeamRecords = useMemo(() => {
    return records.filter(r => r.category !== "team");
  }, [records]);

  return (
    <section className="compact-history min-h-[calc(100vh-200px)] bg-surface px-5 py-5 text-text-primary sm:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em] text-accent">History archive</p>
          <h1 className="mt-1 font-anton text-2xl uppercase">Minor Records</h1>
          <p className="mt-1 text-xs text-text-secondary">Small, specialist IPL records. Each entry is editable data.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} /> Verified only
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(labels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${category === key ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:text-text-primary"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* --- INNINGS TOTAL TABLES (1/2 Columns) --- */}
      {(category === "all" || category === "team") && (
        <div className="space-y-6 mb-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Highest Scores List */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Highest Innings Totals</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">League franchise records (active teams)</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[25px_1fr_65px_50px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">Season</span>
                </div>
                {highestScores.map((record, index) => {
                  const teamInfo = getHistoryTeam(record.holder);
                  const primaryColor = teamInfo?.primaryColor ?? "#ccc";
                  return (
                    <div key={record.id} className="grid grid-cols-[25px_1fr_65px_50px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-anton text-[11px] text-accent">{index + 1}</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full border border-border shrink-0" style={{ backgroundColor: primaryColor }} />
                        <span className="truncate font-bold text-text-primary">{teamInfo?.name ?? record.holder}</span>
                      </div>
                      <span className="text-right font-bold text-accent">{record.value}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lowest Scores List */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Lowest Innings Totals</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">League franchise records (active teams)</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[25px_1fr_65px_50px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">Season</span>
                </div>
                {lowestScores.map((record, index) => {
                  const teamInfo = getHistoryTeam(record.holder);
                  const primaryColor = teamInfo?.primaryColor ?? "#ccc";
                  return (
                    <div key={record.id} className="grid grid-cols-[25px_1fr_65px_50px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-anton text-[11px] text-accent">{index + 1}</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full border border-border shrink-0" style={{ backgroundColor: primaryColor }} />
                        <span className="truncate font-bold text-text-primary">{teamInfo?.name ?? record.holder}</span>
                      </div>
                      <span className="text-right font-bold text-accent">{record.value}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Lowest Defended Totals by Team */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Lowest Defended Totals</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Lowest score successfully defended in full 20 overs</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[25px_1fr_65px_50px_100px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-right">Defended</span>
                  <span className="text-right">Season</span>
                  <span className="text-right">Opponent</span>
                </div>
                {lowestDefendedTotals.map((record, index) => {
                  const teamInfo = getHistoryTeam(record.holder);
                  const primaryColor = teamInfo?.primaryColor ?? "#ccc";
                  return (
                    <div key={record.id} className="grid grid-cols-[25px_1fr_65px_50px_100px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-anton text-[11px] text-accent">{index + 1}</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full border border-border shrink-0" style={{ backgroundColor: primaryColor }} />
                        <span className="truncate font-bold text-text-primary">{teamInfo?.name ?? record.holder}</span>
                      </div>
                      <span className="text-right font-bold text-accent">{record.value}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.notes}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Highest Runs Chased by Team */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Highest Runs Chased</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Highest successful run chase by active franchise</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[25px_1fr_65px_50px_100px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-right">Target</span>
                  <span className="text-right">Season</span>
                  <span className="text-right">Opponent</span>
                </div>
                {highestRunsChased.map((record, index) => {
                  const teamInfo = getHistoryTeam(record.holder);
                  const primaryColor = teamInfo?.primaryColor ?? "#ccc";
                  return (
                    <div key={record.id} className="grid grid-cols-[25px_1fr_65px_50px_100px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-anton text-[11px] text-accent">{index + 1}</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full border border-border shrink-0" style={{ backgroundColor: primaryColor }} />
                        <span className="truncate font-bold text-text-primary">{teamInfo?.name ?? record.holder}</span>
                      </div>
                      <span className="text-right font-bold text-accent">{record.value}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                      <span className="text-right text-text-secondary text-[10px] truncate">{record.notes}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {(category === "all" || category === "season_batting") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Top 10 Highest-Run Batting Seasons</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">Most runs scored by a player in a single IPL season</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[35px_minmax(0,1fr)_70px_65px_55px] border-b border-border pb-1 mb-1 text-[9px] font-bold uppercase text-text-secondary whitespace-nowrap">
              <span>#</span><span>Player</span><span className="text-right">Runs</span><span className="text-right">Team</span><span className="text-right">Season</span>
            </div>
            {allTimeBattingSeasons.map((record, index) => {
              const teamInfo = record.notes ? getHistoryTeam(record.notes) : undefined;
              return (
                <div key={record.id} className="grid grid-cols-[35px_minmax(0,1fr)_70px_65px_55px] items-center rounded px-1 py-1 hover:bg-surface/5 whitespace-nowrap">
                  <span className="font-anton text-[11px] text-accent">{index + 1}</span>
                  <span className="truncate font-bold text-text-primary">{record.holder}</span>
                  <span className="text-right font-bold text-accent">{Number.parseInt(record.value, 10)}</span>
                  <span className="flex items-center justify-end gap-1.5 text-right font-bold text-text-primary">
                    <span className="size-2 shrink-0 rounded-full border border-border" style={{ backgroundColor: teamInfo?.primaryColor ?? "#ccc" }} />
                    {teamInfo?.shortName ?? record.notes ?? "—"}
                  </span>
                  <span className="text-right text-[10px] text-text-secondary">{record.season}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- BATTING POSITIONS COMPARISON TABLE --- */}
      {(category === "all" || category === "batting_position") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Highest Individual Scores by Batting Position</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">IPL historical bests for positions #1 through #11</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[35px_1fr_65px_50px_140px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
              <span>Pos</span>
              <span>Batsman</span>
              <span className="text-right">Score</span>
              <span className="text-right">Season</span>
              <span className="text-right text-ellipsis overflow-hidden">Match Context</span>
            </div>
            {battingPosScores.map((record) => (
              <div key={record.id} className="grid grid-cols-[35px_1fr_65px_50px_140px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="font-anton text-[11px] text-accent">#{record.id.split('-').pop()}</span>
                <span className="truncate font-bold text-text-primary">{record.holder}</span>
                <span className="text-right font-bold text-accent">{record.value}</span>
                <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                <span className="text-right text-text-secondary text-[10px] truncate">{record.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- HIGHEST SCORING BATTING SEASONS BY POSITION TABLE --- */}
      {(category === "all" || category === "batting_position") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Highest Scoring Batting Season by Position</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">IPL single-season run record holders for positions #1 through #11</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[35px_1fr_65px_50px_140px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
              <span>Pos</span>
              <span>Batsman</span>
              <span className="text-right">Runs</span>
              <span className="text-right">Season</span>
              <span className="text-right text-ellipsis overflow-hidden">Franchise</span>
            </div>
            {seasonBattingPosRuns.map((record) => {
              const pos = record.id.split('-').pop();
              const posLabel = pos === "1" || pos === "2" ? "Opener" : `#${pos}`;
              return (
                <div key={record.id} className="grid grid-cols-[35px_1fr_65px_50px_140px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="font-anton text-[10px] text-accent">{posLabel}</span>
                  <span className="truncate font-bold text-text-primary">{record.holder}</span>
                  <span className="text-right font-bold text-accent">{record.value}</span>
                  <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                  <span className="text-right text-text-secondary text-[10px] truncate">{record.notes}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- PARTNERSHIPS BY POSITION COMPARISON TABLE --- */}
      {(category === "all" || category === "partnership_position") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Highest Partnerships by Wicket/Position</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">IPL standouts involving batting positions #1 through #11</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[35px_1.5fr_65px_50px_180px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
              <span>Pos</span>
              <span>Partners</span>
              <span className="text-right">Stand</span>
              <span className="text-right">Season</span>
              <span className="text-right text-ellipsis overflow-hidden">Wicket & Opponent</span>
            </div>
            {partnershipPosScores.map((record) => (
              <div key={record.id} className="grid grid-cols-[35px_1.5fr_65px_50px_180px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="font-anton text-[11px] text-accent">#{record.id.split('-').pop()}</span>
                <span className="truncate font-bold text-text-primary">{record.holder}</span>
                <span className="text-right font-bold text-accent">{record.value}</span>
                <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                <span className="text-right text-text-secondary text-[10px] truncate">{record.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* --- RUNS BY AGE (U21-44) TABLE --- */}
      {(category === "all" || category === "milestone") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Most Runs in a Single Season by Age</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">Record run totals scored by players at each age from U21 to 44</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[50px_1.5fr_80px_60px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
              <span>Age</span>
              <span>Batsman</span>
              <span className="text-right">Runs</span>
              <span className="text-right">Season</span>
            </div>
            {runsByAge.map((record) => {
              const ageToken = record.id.split('-').pop();
              const ageLabel = ageToken === "20" ? "U21" : `${ageToken} y/o`;
              return (
                <div key={record.id} className="grid grid-cols-[50px_1.5fr_80px_60px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="font-anton text-[11px] text-accent">{ageLabel}</span>
                  <span className="truncate font-bold text-text-primary">{record.holder}</span>
                  <span className="text-right font-bold text-accent">{record.value}</span>
                  <span className="text-right text-text-secondary text-[10px]">{record.season}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- WICKETS BY AGE (U21-44) TABLE --- */}
      {(category === "all" || category === "milestone") && (
        <div className="mb-8 rounded-lg border border-border bg-bg p-4 overflow-hidden">
          <div className="mb-3 border-b border-border/40 pb-2">
            <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Most Wickets in a Single Season by Age</h3>
            <p className="font-space-mono text-[9px] text-text-secondary">Record wicket totals taken by bowlers at each age from U21 to 44</p>
          </div>
          <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
            <div className="grid grid-cols-[50px_1.5fr_80px_60px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
              <span>Age</span>
              <span>Bowler</span>
              <span className="text-right">Wickets</span>
              <span className="text-right">Season</span>
            </div>
            {wicketsByAge.map((record) => {
              const ageToken = record.id.split('-').pop();
              const ageLabel = ageToken === "20" ? "U21" : `${ageToken} y/o`;
              return (
                <div key={record.id} className="grid grid-cols-[50px_1.5fr_80px_60px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="font-anton text-[11px] text-accent">{ageLabel}</span>
                  <span className="truncate font-bold text-text-primary">{record.holder}</span>
                  <span className="text-right font-bold text-accent">{record.value}</span>
                  <span className="text-right text-text-secondary text-[10px]">{record.season}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* --- MILESTONE SPEED RECORDS --- */}
      {(category === "all" || category === "milestone") && (
        <div className="space-y-6 mb-8">
          <div className="grid gap-6 md:grid-cols-1">
            {/* Fastest to Wickets */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-xs uppercase tracking-wider text-text-primary">Fastest to Wicket Milestones</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Fewest matches to reach wickets in a season</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[80px_1fr_60px_50px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>Milestone</span>
                  <span>Bowler</span>
                  <span className="text-right">Matches</span>
                  <span className="text-right text-ellipsis overflow-hidden">Season</span>
                </div>
                {fastestWickets.map((record) => (
                  <div key={record.id} className="grid grid-cols-[80px_1fr_60px_50px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="font-bold text-accent truncate">{record.id.split('-')[1]} Wkts</span>
                    <span className="truncate text-text-primary">{record.holder}</span>
                    <span className="text-right font-bold text-text-primary">{record.value}</span>
                    <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Fastest Season Runs by Balls */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-xs uppercase tracking-wider text-text-primary">Fastest to Season Runs (Balls)</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Fewest deliveries faced to reach milestones</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[80px_1fr_60px_50px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>Milestone</span>
                  <span>Batsman</span>
                  <span className="text-right">Balls</span>
                  <span className="text-right">Season</span>
                </div>
                {fastestSeasonRunsBalls.map((record) => (
                  <div key={record.id} className="grid grid-cols-[80px_1fr_60px_50px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="font-bold text-accent truncate">{record.id.split('-')[1]} Runs</span>
                    <span className="truncate text-text-primary">{record.holder}</span>
                    <span className="text-right font-bold text-text-primary">{record.value}</span>
                    <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fastest Season Runs by Innings */}
            <div className="rounded-lg border border-border bg-bg p-4 overflow-hidden">
              <div className="mb-3 border-b border-border/40 pb-2">
                <h3 className="font-anton text-xs uppercase tracking-wider text-text-primary">Fastest to Season Runs (Innings)</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Fewest innings played to reach milestones</p>
              </div>
              <div className="space-y-1 font-space-mono text-[11px] overflow-hidden">
                <div className="grid grid-cols-[80px_1fr_60px_50px] text-[9px] font-bold text-text-secondary uppercase border-b border-border pb-1 mb-1 whitespace-nowrap">
                  <span>Milestone</span>
                  <span>Batsman</span>
                  <span className="text-right">Innings</span>
                  <span className="text-right">Season</span>
                </div>
                {fastestSeasonRunsInnings.map((record) => (
                  <div key={record.id} className="grid grid-cols-[80px_1fr_60px_50px] items-center py-1 px-1 rounded hover:bg-surface/5 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="font-bold text-accent truncate">{record.id.split('-')[1]} Runs</span>
                    <span className="truncate text-text-primary">{record.holder}</span>
                    <span className="text-right font-bold text-text-primary">{record.value}</span>
                    <span className="text-right text-text-secondary text-[10px] truncate">{record.season}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Records Grouped Sections */}
      {(category === "all" || category === "team") && (
        <>
          {teamGameRecords.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Team Game Records (Match-Specific)</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Single match records and peak game-level statistics</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {teamGameRecords.map((record) => (
                  <article key={record.id} className="rounded border border-border bg-bg p-4">
                    <p className="font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary">
                      {labels[record.category]}
                    </p>
                    <h2 className="mt-2 text-sm font-bold text-text-primary">{record.title}</h2>
                    <p className="mt-3 font-space-mono text-xl font-bold text-accent">{record.value}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {record.holder}{record.season ? ` · ${record.season}` : ""}
                      {record.notes ? ` (${record.notes})` : ""}
                    </p>
                    <p className={`mt-3 text-[10px] ${record.verified ? "text-success" : "text-warning"}`}>
                      {record.verified ? "Verified record" : "Requires source verification"}
                      {record.source ? ` · ${record.source}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {teamSeasonalRecords.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 border-b border-border/40 pb-2">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Team Seasonal & Tournament Records</h3>
                <p className="font-space-mono text-[9px] text-text-secondary">Season-long performance benchmarks and tournament milestones</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {teamSeasonalRecords.map((record) => (
                  <article key={record.id} className="rounded border border-border bg-bg p-4">
                    <p className="font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary">
                      {labels[record.category]}
                    </p>
                    <h2 className="mt-2 text-sm font-bold text-text-primary">{record.title}</h2>
                    <p className="mt-3 font-space-mono text-xl font-bold text-accent">{record.value}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {record.holder}{record.season ? ` · ${record.season}` : ""}
                      {record.notes ? ` (${record.notes})` : ""}
                    </p>
                    <p className={`mt-3 text-[10px] ${record.verified ? "text-success" : "text-warning"}`}>
                      {record.verified ? "Verified record" : "Requires source verification"}
                      {record.source ? ` · ${record.source}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Grid of Other Individual Cards (Non-Team) */}
      {category !== "team" && nonTeamRecords.length > 0 && (
        <div className="mb-8">
          {category === "all" && (
            <div className="mb-4 border-b border-border/40 pb-2">
              <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">Other Individual Records</h3>
              <p className="font-space-mono text-[9px] text-text-secondary">General player milestones and specialist records</p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nonTeamRecords.map((record) => (
              <article key={record.id} className="rounded border border-border bg-bg p-4">
                <p className="font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary">
                  {labels[record.category]}
                </p>
                <h2 className="mt-2 text-sm font-bold text-text-primary">{record.title}</h2>
                <p className="mt-3 font-space-mono text-xl font-bold text-accent">{record.value}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {record.holder}{record.season ? ` · ${record.season}` : ""}
                  {record.notes ? ` (${record.notes})` : ""}
                </p>
                <p className={`mt-3 text-[10px] ${record.verified ? "text-success" : "text-warning"}`}>
                  {record.verified ? "Verified record" : "Requires source verification"}
                  {record.source ? ` · ${record.source}` : ""}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
