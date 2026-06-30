"use client";
import { Player } from "@/lib/types";
import StarRating from "@/components/shared/StarRating";
import AttributeBar from "@/components/shared/AttributeBar";
import { formatPrice } from "@/lib/logic/auctionRules";

interface Props {
  player: Player;
  teamColor?: string;
}

const ROLE_COLORS: Record<string, string> = {
  "Batsman": "bg-blue-900 text-blue-300 border-blue-700",
  "WK-Batsman": "bg-teal-900 text-teal-300 border-teal-700",
  "All-Rounder": "bg-purple-900 text-purple-300 border-purple-700",
  "Pace Bowler": "bg-red-900 text-red-300 border-red-700",
  "Spin Bowler": "bg-orange-900 text-orange-300 border-orange-700",
};

function getTopAttributes(player: Player): { label: string; value: number }[] {
  const a = player.attributes;
  switch (player.role) {
    case "Batsman":
    case "WK-Batsman":
      return [
        { label: "Technique", value: a.technique },
        { label: "Power", value: a.power },
        { label: "Timing", value: a.timing },
        { label: "Composure", value: a.composure },
      ];
    case "Pace Bowler":
      return [
        { label: "Pace", value: a.pace },
        { label: "Swing", value: a.swing },
        { label: "Seam", value: a.seam },
        { label: "Accuracy", value: a.accuracy },
      ];
    case "Spin Bowler":
      return [
        { label: "Spin", value: a.spin },
        { label: "Flight", value: a.flight },
        { label: "Variation", value: a.variation },
        { label: "Accuracy", value: a.accuracy },
      ];
    case "All-Rounder":
      return [
        { label: "Technique", value: a.technique },
        { label: "Power", value: a.power },
        { label: "Accuracy", value: a.accuracy },
        { label: "Variation", value: a.variation },
      ];
  }
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function PlayerCard({ player, teamColor }: Props) {
  const attrs = getTopAttributes(player);
  const stats = player.careerStats;

  return (
    <div className="bg-surface2 rounded-lg border border-border p-5 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
          style={{ backgroundColor: teamColor ?? "#7c5cbf", color: "#fff" }}
        >
          {getInitials(player.name)}
        </div>

        {/* Name & meta */}
        <div className="flex-1 min-w-0">
          <h2 className="text-[22px] font-bold text-text-primary leading-tight truncate">{player.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[player.role]}`}>
              {player.role}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${player.nationality === "Overseas" ? "bg-amber-900 text-amber-300 border border-amber-700" : "bg-green-900 text-green-300 border border-green-700"}`}>
              {player.nationality === "Overseas" ? "🌍 Overseas" : "🇮🇳 Indian"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${player.isCapped ? "bg-surface text-text-secondary border border-border" : "bg-surface text-text-secondary border border-border"}`}>
              {player.isCapped ? "Capped" : "Uncapped"}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-text-secondary">
            Age {player.age} · {player.battingStyle} bat
            {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ""}
          </div>
          <div className="mt-1">
            <StarRating rating={player.starRating} size="md" />
          </div>
        </div>
      </div>

      {/* Attribute bars */}
      <div className="flex flex-col gap-2">
        {attrs.map((a) => (
          <AttributeBar key={a.label} label={a.label} value={a.value} />
        ))}
      </div>

      {/* Career Stats */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">T20 Career</h4>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          {stats.batting.matches > 0 && (
            <>
              <span className="text-text-secondary">Matches</span>
              <span className="col-span-2 text-text-primary font-semibold">{stats.batting.matches}</span>
              <span className="text-text-secondary">Runs</span>
              <span className="col-span-2 text-text-primary font-semibold">{stats.batting.runs.toLocaleString()}</span>
              <span className="text-text-secondary">Avg / SR</span>
              <span className="col-span-2 text-text-primary font-semibold">
                {stats.batting.average.toFixed(1)} / {stats.batting.strikeRate.toFixed(1)}
              </span>
            </>
          )}
          {stats.bowling.wickets > 0 && (
            <>
              <span className="text-text-secondary">Wickets</span>
              <span className="col-span-2 text-text-primary font-semibold">{stats.bowling.wickets}</span>
              <span className="text-text-secondary">Econ / Avg</span>
              <span className="col-span-2 text-text-primary font-semibold">
                {stats.bowling.economy.toFixed(2)} / {stats.bowling.average.toFixed(1)}
              </span>
              <span className="text-text-secondary">Best</span>
              <span className="col-span-2 text-text-primary font-semibold">{stats.bowling.bestFigures}</span>
            </>
          )}
        </div>
      </div>

      {/* IPL History */}
      {player.iplHistory.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-text-secondary mb-2">IPL History</h4>
          <div className="flex flex-col gap-1">
            {player.iplHistory.slice(-3).reverse().map((h, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-text-secondary">{h.season} — <span className="text-text-primary">{h.teamId}</span></span>
                <span className="text-gold font-semibold">{formatPrice(h.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Base Price */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-text-secondary uppercase tracking-wider">Base Price</span>
        <span className="text-lg font-bold text-gold">{formatPrice(player.basePrice)}</span>
      </div>
    </div>
  );
}
