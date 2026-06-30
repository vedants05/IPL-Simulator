"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAMS_SEED } from "@/lib/data/teams";

export default function SetupPage() {
  const router = useRouter();
  const initNewGame = useGameStore((s) => s.initNewGame);
  const [step, setStep] = useState<"team" | "confirm">("team");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  function handleStart() {
    if (!selectedTeam) return;
    initNewGame(selectedTeam);
    router.push("/game/auction");
  }

  const chosenTeam = TEAMS_SEED.find((t) => t.id === selectedTeam);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Logo / title */}
        <div className="text-center mb-10">
          <div className="text-5xl font-black tracking-tight text-white mb-1">
            IPL <span className="text-accent">Manager</span>
          </div>
          <div className="text-text-secondary text-sm tracking-widest uppercase">2025 Season</div>
        </div>

        {step === "team" && (
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Choose Your Franchise</h2>
            <p className="text-text-secondary text-sm mb-6">Select the IPL team you want to manage.</p>
            <div className="grid grid-cols-2 gap-3">
              {TEAMS_SEED.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  className={`relative text-left rounded-lg border p-4 transition-all
                    ${selectedTeam === team.id
                      ? "border-accent bg-accent/10 ring-1 ring-accent"
                      : "border-border bg-surface hover:border-accent/50 hover:bg-surface2"
                    }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                    >
                      {team.shortName.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-text-primary text-sm">{team.name}</div>
                      <div className="text-xs text-text-secondary">{team.homeGround}</div>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{team.description}</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-text-secondary">
                      Fan Base: <span className="text-text-primary">{team.fanBase}</span>
                    </span>
                    <span className="text-xs text-text-secondary">
                      Prestige: <span className="text-text-primary">{"★".repeat(Math.round(team.prestige / 2))}</span>
                    </span>
                  </div>
                  {selectedTeam === team.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => selectedTeam && setStep("confirm")}
                disabled={!selectedTeam}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg transition-colors"
              >
                Next: Confirm →
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && chosenTeam && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-text-primary mb-6">Confirm Your Selection</h2>
            <div className="bg-surface rounded-lg border border-border p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: chosenTeam.primaryColor, color: chosenTeam.secondaryColor }}
                >
                  {chosenTeam.shortName.slice(0, 2)}
                </div>
                <div>
                  <div className="text-xl font-black text-text-primary">{chosenTeam.name}</div>
                  <div className="text-text-secondary text-sm">{chosenTeam.city} · {chosenTeam.homeGround}</div>
                </div>
              </div>
              <p className="text-text-secondary text-sm mb-4">{chosenTeam.description}</p>
              <div className="text-sm">
                <span className="text-text-secondary">Starting Purse: </span>
                <span className="text-success font-semibold">₹120 Cr</span>
              </div>
            </div>
            <div className="bg-surface2 rounded border border-border p-4 mb-6">
              <h4 className="text-xs uppercase tracking-wider text-text-secondary mb-2">What happens next</h4>
              <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
                <li>Select up to 6 players to retain (deducted from your purse)</li>
                <li>All remaining players enter the mega auction pool</li>
                <li>AI teams auto-retain their top players</li>
                <li>Bid for players across 5 auction sets</li>
              </ol>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("team")}
                className="flex-1 bg-surface2 hover:bg-border text-text-secondary font-medium py-3 rounded-lg border border-border transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleStart}
                className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-lg transition-colors"
              >
                Begin Season →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
