"use client";
import React, { useState, useMemo } from "react";
import { Search, Check, Play, User, DollarSign, Info } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { Player, Team } from "@/lib/types";

// Helper to format lakhs to crores
function crore(lakhs: number) {
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(2)} Cr`;
  }
  return `₹${lakhs} L`;
}

// Get the max rating of a player
function getPlayerMaxRating(player: Player): number {
  return Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
}

// Format the display rating clearly
function renderPlayerRating(player: Player): string {
  const bat = player.currentBatting ?? 0;
  const bowl = player.currentBowling ?? 0;
  const role = player.role;

  if (role === "All-Rounder" || (bat >= 70 && bowl >= 70)) {
    return `${bat} Bat / ${bowl} Bowl`;
  }
  if (role === "Batsman" || role === "WK-Batsman") {
    return `${bat} Bat`;
  }
  if (role === "Pace Bowler" || role === "Spin Bowler") {
    return `${bowl} Bowl`;
  }
  return bat > bowl ? `${bat} Bat` : `${bowl} Bowl`;
}

// Color tier for player ratings
function getRatingBadgeStyles(rating: number) {
  if (rating >= 85) return { bg: "bg-[#e5c158]/10 text-[#c29623]", label: "Elite" };
  if (rating >= 80) return { bg: "bg-[#d6492f]/10 text-[#d6492f]", label: "Premium" };
  if (rating >= 75) return { bg: "bg-accent/10 text-accent", label: "Core" };
  return { bg: "bg-[#71695c]/10 text-text-secondary", label: "Depth" };
}

export function AcceleratedNominationsScreen() {
  const {
    auction,
    players,
    teams,
    userTeamId,
    confirmUserAcceleratedTargets,
  } = useGameStore();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [natFilter, setNatFilter] = useState("all");
  const [basePriceFilter, setBasePriceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const userTeam = teams[userTeamId];
  const unsoldPlayerIds = auction?.unsoldPlayerIds ?? [];

  // Map unsold IDs to Player objects
  const unsoldPlayers = useMemo(() => {
    return unsoldPlayerIds
      .map(id => players[id])
      .filter((p): p is Player => !!p)
      .sort((a, b) => getPlayerMaxRating(b) - getPlayerMaxRating(a));
  }, [unsoldPlayerIds, players]);

  const availableBasePrices = useMemo(() => {
    return Array.from(new Set(unsoldPlayers.map(player => player.basePrice))).sort((a, b) => a - b);
  }, [unsoldPlayers]);

  // Filter unsold players
  const filteredPlayers = useMemo(() => {
    return unsoldPlayers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesNat = natFilter === "all" || p.nationality === natFilter;
      const matchesBasePrice = basePriceFilter === "all" || p.basePrice === Number(basePriceFilter);
      return matchesSearch && matchesRole && matchesNat && matchesBasePrice;
    });
  }, [unsoldPlayers, search, roleFilter, natFilter, basePriceFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 10) return prev; // Limit to 10
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    confirmUserAcceleratedTargets(selectedIds);
  };

  if (!userTeam) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-border pb-4 mb-6 shrink-0">
        <div>
          <span className="font-space-mono font-bold text-[10px] tracking-widest text-[#d6492f] uppercase block mb-1">
            Accelerated Planning Phase
          </span>
          <h1 className="font-anton text-[32px] leading-none text-text-primary uppercase">
            Nominate Unsold Lots
          </h1>
          <p className="font-barlow text-[13px] text-text-secondary mt-1">
            Choose up to 10 players from the unsold pool. AI franchises are also nominating targets to round out their squads.
          </p>
        </div>

        <button
          onClick={handleConfirm}
          className="font-anton text-[16px] tracking-wide text-white uppercase px-6 py-3 rounded-[6px] transition-all hover:scale-[1.02] shadow-md flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #e5c158 0%, #c29623 100%)",
            color: "#16130f",
          }}
        >
          <Play size={16} fill="currentColor" />
          Confirm Sheet ({selectedIds.length}/10)
        </button>
      </div>

      {/* Roster Needs Alert */}
      <div className="bg-surface2 border border-[#16130f]/15 rounded-[6px] p-4 mb-6 flex items-start gap-3 shrink-0">
        <Info className="text-accent shrink-0 mt-0.5" size={16} />
        <div className="min-w-0">
          <h4 className="font-space-mono font-bold text-[11px] text-text-primary uppercase">
            Your Squad Requirements
          </h4>
          <p className="font-barlow text-[12px] text-text-secondary mt-0.5">
            Purse: <span className="font-bold text-text-primary">{crore(userTeam.remainingPurse)}</span> · Squad: <span className="font-bold text-text-primary">{userTeam.squad.length}/25</span>. 
            Ensure you target players that fit your remaining roster gaps.
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 bg-surface border border-border rounded-[6px] p-4 mb-6 shrink-0 shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
          <input
            type="text"
            placeholder="Search players by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface2 border border-border rounded-[4px] pl-10 pr-4 py-2 font-barlow text-[14px] text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <span className="font-space-mono text-[10px] text-text-secondary uppercase">Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-surface2 border border-border rounded-[4px] px-3 py-2 font-barlow text-[13px] text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="all">All Roles</option>
            <option value="Batsman">Batsmen</option>
            <option value="WK-Batsman">Keepers</option>
            <option value="All-Rounder">All-Rounders</option>
            <option value="Pace Bowler">Pace Bowlers</option>
            <option value="Spin Bowler">Spin Bowlers</option>
          </select>
        </div>

        {/* Nationality filter */}
        <div className="flex items-center gap-2">
          <span className="font-space-mono text-[10px] text-text-secondary uppercase">Origin:</span>
          <select
            value={natFilter}
            onChange={e => setNatFilter(e.target.value)}
            className="bg-surface2 border border-border rounded-[4px] px-3 py-2 font-barlow text-[13px] text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="all">All origins</option>
            <option value="Indian">Indian</option>
            <option value="Overseas">Overseas</option>
          </select>
        </div>

        {/* Base-price filter */}
        <div className="flex items-center gap-2">
          <DollarSign className="text-text-secondary" size={14} />
          <span className="font-space-mono text-[10px] text-text-secondary uppercase">Base:</span>
          <select
            value={basePriceFilter}
            onChange={e => setBasePriceFilter(e.target.value)}
            className="bg-surface2 border border-border rounded-[4px] px-3 py-2 font-barlow text-[13px] text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="all">All prices</option>
            {availableBasePrices.map(price => (
              <option key={price} value={price}>{crore(price)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Players List Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-surface border border-border rounded-[6px] shadow-inner p-2">
        {filteredPlayers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <User size={36} className="text-text-secondary mb-2" />
            <p className="font-barlow text-[14px] text-text-secondary">No unsold players match your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredPlayers.map(player => {
              const isSelected = selectedIds.includes(player.id);
              const maxRating = getPlayerMaxRating(player);
              const ratingStyles = getRatingBadgeStyles(maxRating);
              
              return (
                <div
                  key={player.id}
                  onClick={() => toggleSelect(player.id)}
                  className={`flex items-center justify-between p-4 rounded-[6px] border cursor-pointer transition-all hover:bg-surface2 ${
                    isSelected ? "border-accent bg-accent/5" : "border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "border-accent bg-accent text-white" : "border-border bg-surface2"
                      }`}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-barlow-condensed font-bold text-[16px] text-text-primary truncate">
                          {player.name}
                        </span>
                        <span className={`font-space-mono text-[9px] px-1.5 py-0.5 rounded-[3px] font-bold ${ratingStyles.bg}`}>
                          {renderPlayerRating(player)} · {ratingStyles.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 font-space-mono text-[10px] text-text-secondary mt-1">
                        <span>{player.role}</span>
                        <span>·</span>
                        <span className={player.nationality === "Overseas" ? "text-accent" : ""}>
                          {player.nationality}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-barlow-condensed font-bold text-[16px] text-text-primary">
                      {crore(player.basePrice)}
                    </div>
                    <span className="font-space-mono text-[9px] text-text-secondary uppercase">Base Price</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AcceleratedPlanningResultsScreen() {
  const {
    teams,
    players,
    userTeamId,
    userAcceleratedTargets,
    aiAcceleratedTargets,
    aiAcceleratedBackups,
    startAcceleratedAuctionFromPlanning,
  } = useGameStore();

  const userTeam = teams[userTeamId];

  // Calculate targets nominations
  const allNominations = useMemo(() => {
    const counts: Record<string, string[]> = {}; // playerId -> list of teamIds
    
    userAcceleratedTargets.forEach(id => {
      if (!counts[id]) counts[id] = [];
      counts[id].push(userTeamId);
    });

    Object.entries(aiAcceleratedTargets).forEach(([teamId, ids]) => {
      ids.forEach(id => {
        if (!counts[id]) counts[id] = [];
        counts[id].push(teamId);
      });
    });

    return counts;
  }, [userAcceleratedTargets, aiAcceleratedTargets, userTeamId]);

  // Calculate backups nominations
  const allBackups = useMemo(() => {
    const counts: Record<string, string[]> = {}; // playerId -> list of teamIds

    Object.entries(aiAcceleratedBackups ?? {}).forEach(([teamId, ids]) => {
      ids.forEach(id => {
        if (!counts[id]) counts[id] = [];
        counts[id].push(teamId);
      });
    });

    return counts;
  }, [aiAcceleratedBackups]);

  const uniqueNominatedIds = useMemo(() => {
    const allUniqueIds = new Set<string>();
    Object.keys(allNominations).forEach(id => allUniqueIds.add(id));
    Object.keys(allBackups).forEach(id => allUniqueIds.add(id));

    return Array.from(allUniqueIds).sort((a, b) => {
      const pA = players[a];
      const pB = players[b];
      const ratingA = pA ? getPlayerMaxRating(pA) : 0;
      const ratingB = pB ? getPlayerMaxRating(pB) : 0;
      return ratingB - ratingA;
    });
  }, [allNominations, allBackups, players]);

  if (!userTeam) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-border pb-4 mb-6 shrink-0">
        <div>
          <span className="font-space-mono font-bold text-[10px] tracking-widest text-[#1f9d57] uppercase block mb-1">
            Nominations Submitted
          </span>
          <h1 className="font-anton text-[32px] leading-none text-text-primary uppercase">
            Sheet Comparison & Draft List
          </h1>
          <p className="font-barlow text-[13px] text-text-secondary mt-1">
            See which teams nominated which players. A total of <span className="font-bold text-text-primary">{uniqueNominatedIds.length} players</span> have been shortlisted (including backups) for the accelerated rounds.
          </p>
        </div>

        <button
          onClick={startAcceleratedAuctionFromPlanning}
          className="font-anton text-[16px] tracking-wide text-white uppercase px-6 py-3 rounded-[6px] transition-all hover:scale-[1.02] shadow-md flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #1f9d57 0%, #178346 100%)",
          }}
        >
          <Play size={16} fill="currentColor" />
          Start Accelerated Set
        </button>
      </div>

      {/* Grid of Team Nominations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 shrink-0">
        {Object.values(teams).map(team => {
          const isUser = team.id === userTeamId;
          const nominatedIds = isUser ? userAcceleratedTargets : (aiAcceleratedTargets[team.id] ?? []);
          const backupIds = isUser ? [] : (aiAcceleratedBackups[team.id] ?? []);

          return (
            <div key={team.id} className="bg-surface border border-[#16130f]/15 rounded-[6px] p-3 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[#16130f]/10 pb-2 mb-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                    style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                  >
                    {team.shortName.slice(0, 3)}
                  </div>
                  <span className="font-barlow-condensed font-bold text-[13px] text-text-primary truncate">
                    {team.name} {isUser && "(YOU)"}
                  </span>
                </div>
                <div className="font-space-mono text-[9px] text-text-secondary uppercase mb-1">
                  Budget: {crore(team.remainingPurse)}
                </div>
                <div className="font-space-mono text-[9px] text-text-secondary uppercase mb-2">
                  Slots remaining: {(team.softSquadTarget ?? 24) - team.squad.length}
                </div>
              </div>
              <div className="bg-surface2 rounded-[4px] p-2 text-center">
                <span className="font-barlow-condensed font-bold text-[18px] text-text-primary">
                  {nominatedIds.length + backupIds.length}
                </span>
                <span className="font-space-mono text-[8px] text-text-secondary block uppercase">Nominated</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shortlist details */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-border rounded-[6px] shadow-sm overflow-hidden">
        <div className="bg-surface2 border-b border-border px-4 py-3 shrink-0 flex items-center justify-between">
          <h3 className="font-space-mono font-bold text-[12px] text-text-primary uppercase tracking-wide">
            Final Accelerated Shortlist ({uniqueNominatedIds.length} Players)
          </h3>
          <span className="font-space-mono text-[9px] text-text-secondary uppercase">
            Ranked by overall rating
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {uniqueNominatedIds.map(id => {
              const player = players[id];
              if (!player) return null;
              
              const nomTeams = allNominations[id] ?? [];
              const backupTeams = allBackups[id] ?? [];
              const ratingStyles = getRatingBadgeStyles(getPlayerMaxRating(player));

              return (
                <div key={id} className="bg-surface2 border border-border/80 rounded-[6px] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-barlow-condensed font-bold text-[15px] text-text-primary truncate">
                        {player.name}
                      </span>
                      <span className={`font-space-mono text-[9px] px-1.5 py-0.5 rounded-[3px] font-bold ${ratingStyles.bg}`}>
                        {renderPlayerRating(player)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-space-mono text-[10px] text-text-secondary mb-3">
                      <span>{player.role}</span>
                      <span>·</span>
                      <span className={player.nationality === "Overseas" ? "text-accent" : ""}>
                        {player.nationality}
                      </span>
                      <span>·</span>
                      <span>{crore(player.basePrice)}</span>
                    </div>
                  </div>

                  {/* Nominated by tags */}
                  <div className="border-t border-[#16130f]/5 pt-2 mt-auto">
                    {(() => {
                      const allNomTeams = Array.from(new Set([...nomTeams, ...backupTeams]));
                      if (allNomTeams.length === 0) return null;
                      return (
                        <div>
                          <span className="font-space-mono text-[8px] text-text-secondary uppercase block mb-1">
                            Nominated By ({allNomTeams.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {allNomTeams.map(tId => {
                              const t = teams[tId];
                              if (!t) return null;
                              return (
                                <span
                                  key={tId}
                                  className="font-space-mono text-[8px] font-bold px-1.5 py-0.5 rounded-[2px] border"
                                  style={{
                                    backgroundColor: `${t.primaryColor}15`,
                                    borderColor: t.primaryColor,
                                    color: t.primaryColor,
                                  }}
                                >
                                  {t.shortName}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
