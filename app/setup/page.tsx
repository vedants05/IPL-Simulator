"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { fetchTeamsFromSupabase } from "@/lib/supabase/fetchTeams";
import { Team } from "@/lib/types";

export default function SetupPage() {
  const router = useRouter();
  const initNewGame = useGameStore((s) => s.initNewGame);
  const [step, setStep] = useState<"team" | "confirm">("team");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark";
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleToggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    fetchTeamsFromSupabase()
      .then(setTeams)
      .catch((err) => {
        console.error(err);
        alert("Failed to load team data from Supabase. Please refresh.");
      })
      .finally(() => setTeamsLoading(false));
  }, []);

  async function handleStart() {
    if (!selectedTeam) return;
    setLoading(true);
    try {
      await initNewGame(selectedTeam);
      router.push("/game/auction");
    } catch (err) {
      console.error(err);
      alert("Failed to load player data from Supabase. Please try again.");
      setLoading(false);
    }
  }

  const chosenTeam = teams.find((t) => t.id === selectedTeam);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* Top bar */}
      <div className="border-b-2 border-hairline px-8 py-5 flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-baseline gap-4">
          <span className="font-anton text-[28px] leading-none text-text-primary uppercase">
            IPL Manager
          </span>
          <span className="font-space-mono font-bold text-[10px] tracking-[.14em] text-text-secondary uppercase">
            2027 Season
          </span>
        </div>

        {/* Settings Button */}
        <div className="relative flex items-center">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-[28px] h-[28px] rounded border-[1.5px] border-[var(--ink)] hover:bg-[var(--ink)]/5 flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
            }}
            title="Open Settings"
          >
            ⚙️
          </button>

          {showSettings && (
            <>
              {/* Invisible overlay for clicking outside */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowSettings(false)}
              />
              {/* Settings Dropdown Panel */}
              <div
                className="absolute right-0 top-full mt-2 w-56 p-4 z-50 rounded shadow-xl text-left border-2 flex flex-col gap-3 font-space-mono animate-in fade-in slide-in-from-top-2 duration-150"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  borderColor: "var(--ink)",
                }}
              >
                <div className="text-[10px] font-bold tracking-wider uppercase border-b border-[var(--ink)]/15 pb-1">
                  ⚙️ Settings
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                    Color Theme
                  </span>
                  <button
                    onClick={handleToggleDarkMode}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded border border-[var(--ink)] hover:bg-[var(--ink)]/5 text-[10px] font-bold cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <span>{isDarkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
                    <span className="text-[9px] tracking-wide opacity-75">
                      {isDarkMode ? "Enabled" : "Disabled"}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
        <div className="w-full max-w-5xl">

          {step === "team" && (
            <>
              <div className="mb-8">
                <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-text-secondary mb-2 uppercase">
                  Step 1 of 2
                </div>
                <h2 className="font-anton text-[36px] leading-none text-text-primary uppercase mb-1">
                  Choose Your Franchise
                </h2>
                <p className="font-barlow text-[13px] text-text-secondary">
                  Select the IPL team you want to manage this season.
                </p>
              </div>

              {teamsLoading && (
                <div className="font-space-mono text-[12px] text-text-secondary mb-8 tracking-wider">
                  LOADING TEAMS…
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-8">
                {teams.map((team) => {
                  const isSelected = selectedTeam === team.id;
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      className="text-left p-5 transition-all"
                      style={{
                        border: isSelected ? "2px solid var(--ink)" : "2px solid var(--hairline)",
                        backgroundColor: isSelected ? "var(--marquee)" : "var(--surface2)",
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0"
                          style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                        >
                          {team.shortName}
                        </div>
                        <div>
                          <div className="font-barlow font-bold text-[14px] text-text-primary">{team.name}</div>
                          <div className="font-space-mono text-[9px] text-text-secondary tracking-wider">
                            {team.homeGround}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="ml-auto w-5 h-5 bg-border rounded-full flex items-center justify-center">
                            <span className="text-accent text-[11px] font-bold">✓</span>
                          </div>
                        )}
                      </div>
                      <p className="font-barlow text-[12px] text-text-secondary leading-relaxed mb-2">
                        {team.description}
                      </p>
                      <div className="flex gap-4">
                        <span className="font-space-mono text-[9px] tracking-wider text-text-secondary">
                          FAN BASE: <span className="text-text-primary font-bold">{team.fanBase.toUpperCase()}</span>
                        </span>
                        <span className="font-space-mono text-[9px] tracking-wider text-text-secondary">
                          PRESTIGE: <span className="text-text-primary font-bold">{team.prestige}/10</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => selectedTeam && setStep("confirm")}
                  disabled={!selectedTeam}
                  className="font-anton text-[18px] tracking-wide px-10 py-4 border-2 border-border
                    hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: chosenTeam ? chosenTeam.primaryColor : "var(--ink)",
                    color: chosenTeam ? chosenTeam.secondaryColor : "var(--background)",
                  }}
                >
                  NEXT: CONFIRM →
                </button>
              </div>
            </>
          )}

          {step === "confirm" && chosenTeam && (
            <div className="max-w-lg mx-auto">
              <div className="mb-8">
                <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-text-secondary mb-2 uppercase">
                  Step 2 of 2
                </div>
                <h2 className="font-anton text-[36px] leading-none text-text-primary uppercase">
                  Confirm Selection
                </h2>
              </div>

              {/* Team card */}
              <div className="border-2 border-border mb-5 bg-surface2">
                <div
                  className="flex items-center gap-5 p-6"
                  style={{ borderBottom: "2px solid var(--ink)" }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                    style={{ backgroundColor: chosenTeam.primaryColor, color: chosenTeam.secondaryColor }}
                  >
                    {chosenTeam.shortName}
                  </div>
                  <div>
                    <h3 className="font-anton text-[28px] leading-none text-text-primary uppercase">
                      {chosenTeam.name}
                    </h3>
                    <div className="font-space-mono text-[10px] text-text-secondary tracking-wider mt-1">
                      {chosenTeam.city.toUpperCase()} · {chosenTeam.homeGround.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <p className="font-barlow text-[13px] text-text-secondary mb-4">
                    {chosenTeam.description}
                  </p>
                  <div className="flex gap-5">
                    <div>
                      <div className="font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-1">Starting Purse</div>
                      <div className="font-barlow-condensed font-bold text-[20px] text-success">₹120 Cr</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div className="bg-surface border border-border/30 p-5 mb-6">
                <div className="font-space-mono font-bold text-[9px] tracking-widest text-text-secondary mb-3 uppercase">
                  What Happens Next
                </div>
                <ol className="font-barlow text-[13px] text-text-secondary space-y-1.5 list-decimal list-inside">
                  <li>Select up to 6 players to retain (deducted from purse)</li>
                  <li>All remaining players enter the mega auction pool</li>
                  <li>AI teams auto-retain their top players</li>
                  <li>Bid for players across 5 auction sets</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("team")}
                  disabled={loading}
                  className="flex-1 font-space-mono font-bold text-[11px] tracking-widest text-text-secondary py-4
                    border-2 border-border hover:bg-surface disabled:opacity-50 transition-colors"
                >
                  ← BACK
                </button>
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="flex-grow font-anton text-[18px] tracking-wide py-4 border-2 border-border hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: chosenTeam.primaryColor,
                    color: chosenTeam.secondaryColor,
                  }}
                >
                  {loading ? "LOADING..." : "BEGIN SEASON →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
