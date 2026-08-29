"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuctionType, Player, Team, TradeRecord } from "@/lib/types";
import { calculateTeamTradeValue, calculateTradePackageValue, getRequestedTradePremium, getTeamTradeWillingness, getTradeOverseasLimit, getTradeSalaryBand, getTradeSalaryOptions, getTradeWindowDates, isTradeBalanced, isTradeWindowOpen, MINI_TRADE_OVERDRAFT_LAKHS } from "@/lib/logic/tradeEngine";
import { getPlayerSeasonHistory } from "@/lib/logic/playerHistory";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";
import TradeHubGuidedTour from "./TradeHubGuidedTour";

interface TradeHubPageProps {
  currentDate: string;
  currentSeason: number;
  finalDate?: string;
  auctionType: AuctionType;
  userTeamId: string;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  tradeRecords: TradeRecord[];
  negotiationCooldowns: Record<string, string>;
  injuredPlayerIds: string[];
  onSetNegotiationCooldown: (teamId: string, recoversOn: string | null) => void;
  onExecuteTrade: (input: {
    proposerTeamId: string;
    recipientTeamId: string;
    offeredPlayerIds: string[];
    requestedPlayerIds: string[];
    salaries: Record<string, number>;
    date: string;
    finalDate?: string;
    auctionType?: AuctionType;
    explanation?: string;
    validateOnly?: boolean;
  }) => boolean;
}

const money = (lakhs: number) => `₹${(lakhs / 100).toFixed(2)} Cr`;
const displayPlayerName = (name: string) => {
  const spaced = name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced === spaced.toLocaleLowerCase("en-GB")
    ? spaced.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : spaced;
};

export default function TradeHubPage({
  currentDate,
  currentSeason,
  finalDate,
  auctionType,
  userTeamId,
  players,
  teams,
  tradeRecords,
  negotiationCooldowns,
  injuredPlayerIds,
  onSetNegotiationCooldown,
  onExecuteTrade,
}: TradeHubPageProps) {
  const [recipientTeamId, setRecipientTeamId] = useState("");
  const [offeredIds, setOfferedIds] = useState<string[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [salaryInputs, setSalaryInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [counterOffer, setCounterOffer] = useState<string | null>(null);
  const [counterOptions, setCounterOptions] = useState<string[][]>([]);
  const [counterIndex, setCounterIndex] = useState(0);
  const [contractNegotiationOpen, setContractNegotiationOpen] = useState(false);
  const [hubView, setHubView] = useState<"hub" | "builder">("hub");
  const [showGuide, setShowGuide] = useState(false);
  const injuredIds = useMemo(() => new Set(injuredPlayerIds), [injuredPlayerIds]);
  const [patienceByTeam, setPatienceByTeam] = useState<Record<string, number>>({});

  useEffect(() => {
    const openPageGuide = (event: Event) => {
      const customEvent = event as CustomEvent<{ page?: string }>;
      if (customEvent.detail?.page === "trade-hub") {
        setHubView("builder");
        setShowGuide(true);
      }
    };
    window.addEventListener("open-page-guide", openPageGuide);
    return () => window.removeEventListener("open-page-guide", openPageGuide);
  }, []);

  const open = isTradeWindowOpen(currentDate, finalDate, currentSeason);
  const tradeWindow = finalDate ? getTradeWindowDates(finalDate, currentSeason) : undefined;
  const beforeTradeWindow = Boolean(tradeWindow && currentDate < tradeWindow.startsOn);
  const userTeam = teams[userTeamId];
  const recipientTeam = recipientTeamId ? teams[recipientTeamId] : undefined;
  const cooldownEndsOn = recipientTeamId ? negotiationCooldowns[recipientTeamId] : undefined;
  const negotiationCoolingDown = Boolean(cooldownEndsOn && currentDate < cooldownEndsOn);
  const patience = recipientTeamId
    ? (negotiationCoolingDown ? 0 : patienceByTeam[recipientTeamId] ?? 4)
    : 4;

  useEffect(() => {
    Object.entries(negotiationCooldowns).forEach(([teamId, recoversOn]) => {
      if (currentDate >= recoversOn) onSetNegotiationCooldown(teamId, null);
    });
  }, [currentDate, negotiationCooldowns, onSetNegotiationCooldown]);

  const setTeamPatience = (value: number) => {
    if (!recipientTeamId) return;
    setPatienceByTeam((current) => ({ ...current, [recipientTeamId]: value }));
  };
  const setPatience = setTeamPatience;
  const currentWindowTradeRecords = useMemo(() => tradeRecords.filter((record) => (
    record.season === currentSeason
    && isTradeWindowOpen(record.date, finalDate, currentSeason)
  )), [currentSeason, finalDate, tradeRecords]);
  const tradedIds = useMemo(() => new Set(
    currentWindowTradeRecords
      .flatMap((record) => [...record.outgoingPlayerIds, ...record.incomingPlayerIds]),
  ), [currentWindowTradeRecords]);
  const selectableUserPlayers = (userTeam?.squad ?? [])
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player) && !tradedIds.has(player.id))
    .sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
  const selectableRecipientPlayers = (recipientTeam?.squad ?? [])
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player) && !tradedIds.has(player.id))
    .sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));

  const selectedPlayers = (ids: string[]) => ids.map((id) => players[id]).filter((p): p is Player => Boolean(p));
  const contractSalary = (id: string) => getPlayerSeasonHistory(players[id]?.iplHistory, String(currentSeason))?.price ?? players[id]?.basePrice ?? 0;
  const overseasCountAfter = (team: Team | undefined, outgoing: string[], incoming: string[]) => {
    if (!team) return 0;
    return team.squad.filter((id) => !outgoing.includes(id)).filter((id) => players[id]?.nationality !== "Indian").length
      + incoming.filter((id) => players[id]?.nationality !== "Indian").length;
  };
  const requirements = (team: Team | undefined, outgoing: string[], incoming: string[], salaryDelta: number) => {
    if (!team) return [] as string[];
    const overseas = overseasCountAfter(team, outgoing, incoming);
    const overseasLimit = getTradeOverseasLimit(team, players);
    const purse = team.remainingPurse + salaryDelta;
    return [
      `${overseas}/${overseasLimit} overseas players after trade ${overseas <= overseasLimit ? "✓" : "✕"}`,
      auctionType === "mini" ? `₹${(purse / 100).toFixed(2)} Cr projected purse · ₹5 Cr trade allowance ${purse >= -MINI_TRADE_OVERDRAFT_LAKHS ? "✓" : "✕"}` : "Mega auction: purse limit is not applied before fixed retentions ✓",
      `${incoming.length <= 3 && outgoing.length <= 3 ? "1–3 players per side ✓" : "Maximum three players per side ✕"}`,
      "Each player can be traded once this window ✓",
    ];
  };
  const offeredSalary = offeredIds.reduce((sum, id) => sum + contractSalary(id), 0);
  const requestedSalary = requestedIds.reduce((sum, id) => sum + Number(salaryInputs[id] ?? getTradeSalaryBand(players[id], currentSeason).demand), 0);
  const requestedCurrentSalary = requestedIds.reduce((sum, id) => sum + contractSalary(id), 0);
  const yourRequirements = requirements(userTeam, offeredIds, requestedIds, offeredSalary - requestedSalary);
  const targetRequirements = requirements(recipientTeam, requestedIds, offeredIds, requestedCurrentSalary - offeredSalary);

  const toggle = (id: string, selected: string[], setSelected: (value: string[]) => void) => {
    if (selected.includes(id)) setSelected(selected.filter((value) => value !== id));
    else if (selected.length < 3) setSelected([...selected, id]);
  };

  const submit = () => {
    if (!recipientTeam || offeredIds.length === 0 || requestedIds.length === 0) {
      setMessage("Choose a team and between one and three players on each side.");
      return;
    }
    const failedRequirements = [...yourRequirements, ...targetRequirements].filter((item) => item.includes("✕"));
    if (failedRequirements.length > 0) {
      setMessage(`Trade cannot be submitted: ${failedRequirements.join("; ")}`);
      return;
    }
    if (negotiationCoolingDown) { setMessage(`This club will not reopen negotiations until ${cooldownEndsOn}.`); return; }
    if (patience <= 0) { setMessage("Negotiation has broken down for now."); return; }
    const demandedSalaries = Object.fromEntries(requestedIds.map((id) => [id, getTradeSalaryBand(players[id], currentSeason).demand]));
    const salaries = Object.fromEntries(requestedIds.map((id) => [id, Number(salaryInputs[id] ?? demandedSalaries[id])]));
    const successful = onExecuteTrade({
      proposerTeamId: userTeamId,
      recipientTeamId: recipientTeam.id,
      offeredPlayerIds: offeredIds,
      requestedPlayerIds: requestedIds,
      salaries,
      date: currentDate,
      finalDate,
      auctionType,
      explanation: `User proposal: ${recipientTeam.shortName} squad adjustment`,
      validateOnly: true,
    });
    if (successful) {
      const requiresNegotiation = auctionType === "mini" && requestedIds.some((id) => demandedSalaries[id] !== contractSalary(id));
      if (requiresNegotiation) {
        setSalaryInputs(Object.fromEntries(requestedIds.map((id) => [id, String(demandedSalaries[id])])));
        setContractNegotiationOpen(true);
        setMessage("The club accepted the player trade. Complete the incoming player contract negotiation to finalise it.");
        return;
      }
      const completed = onExecuteTrade({
        proposerTeamId: userTeamId, recipientTeamId: recipientTeam.id, offeredPlayerIds: offeredIds, requestedPlayerIds: requestedIds,
        salaries: demandedSalaries, date: currentDate, finalDate, auctionType,
        explanation: `User proposal: ${recipientTeam.shortName} squad adjustment`,
      });
      if (completed) {
        setMessage("Trade completed and recorded."); setTeamPatience(4); setCounterOptions([]); setOfferedIds([]); setRequestedIds([]); setSalaryInputs({});
      }
      return;
    }
    if (!successful) {
      const next = patience - 1;
      setTeamPatience(next);
      if (next > 0) {
        const offeredRating = selectedPlayers(offeredIds).reduce((sum, p) => sum + Math.max(p.currentBatting, p.currentBowling), 0);
        const options = selectableRecipientPlayers.filter((p) => {
          if (requestedIds.includes(p.id)) return false;
          const offeredValue = calculateTradePackageValue(selectedPlayers(offeredIds).map((player) => calculateTeamTradeValue({ player, team: userTeam, players, season: currentSeason, auctionType })));
          const requestedValue = calculateTeamTradeValue({ player: p, team: recipientTeam, players, season: currentSeason, auctionType });
          const reverseOffered = calculateTeamTradeValue({ player: p, team: userTeam, players, season: currentSeason, auctionType });
          const reverseRequested = calculateTradePackageValue(selectedPlayers(offeredIds).map((player) => calculateTeamTradeValue({ player, team: recipientTeam, players, season: currentSeason, auctionType })));
          const candidateSalary = getTradeSalaryBand(p, currentSeason).demand;
          const userOverseas = overseasCountAfter(userTeam, offeredIds, [p.id]);
          const targetOverseas = overseasCountAfter(recipientTeam, [p.id], offeredIds);
          const userPurseAfter = userTeam.remainingPurse + selectedPlayers(offeredIds).reduce((sum, player) => sum + (player.basePrice ?? 0), 0) - candidateSalary;
          const targetPurseAfter = recipientTeam.remainingPurse + candidateSalary - selectedPlayers(offeredIds).reduce((sum, player) => sum + (player.basePrice ?? 0), 0);
          return isTradeBalanced({ offeredValue, requestedValue, requestedWillingness: getTeamTradeWillingness({ player: p, team: recipientTeam, players, season: currentSeason }), requestedPremium: getRequestedTradePremium([p]) })
            && isTradeBalanced({ offeredValue: reverseOffered, requestedValue: reverseRequested, requestedWillingness: "open" })
            && userOverseas <= getTradeOverseasLimit(userTeam, players) && targetOverseas <= getTradeOverseasLimit(recipientTeam, players)
            && (auctionType === "mega" || (userPurseAfter >= -MINI_TRADE_OVERDRAFT_LAKHS && targetPurseAfter >= -MINI_TRADE_OVERDRAFT_LAKHS));
        }).sort((a, b) => Math.abs(Math.max(a.currentBatting, a.currentBowling) - offeredRating) - Math.abs(Math.max(b.currentBatting, b.currentBowling) - offeredRating)).slice(0, 5).map((p) => [p.id]);
        setCounterOptions(options);
        setCounterIndex(0);
        if (options.length > 0) {
          const counter = options[0].map((id) => players[id] ? displayPlayerName(players[id].name) : id).join(" + ");
          setCounterOffer(`Club counteroffer: ${counter}. This player exchange is within the club's acceptable valuation range.`);
          setMessage(`Your offer was rejected. A valid counteroffer is available (${next} patience remaining).`);
        } else {
          setCounterOffer(null);
          setMessage(`Your offer was rejected and the club found no legal counteroffer using the current players (${next} patience remaining).`);
        }
      } else {
        setCounterOffer(null);
        const recoversOn = addDaysToDateKey(currentDate, 7);
        onSetNegotiationCooldown(recipientTeam.id, recoversOn);
        setMessage(`Negotiation broke down after repeated rejected offers. The club will talk again on ${recoversOn}.`);
      }
    } else {
      setMessage("Trade completed and recorded.");
      setTeamPatience(4);
      setCounterOptions([]);
    }
    if (successful) {
      setOfferedIds([]);
      setRequestedIds([]);
      setSalaryInputs({});
    }
  };

  const balanceTrade = () => {
    if (!recipientTeam) { setMessage("Choose a team first."); return; }
    const legal = (outgoing: string[], incoming: string[]) => {
      const outSalary = outgoing.reduce((s, id) => s + contractSalary(id), 0);
      const inSalary = incoming.reduce((s, id) => s + (getTradeSalaryBand(players[id], currentSeason).demand), 0);
      const recipientOutgoingSalary = incoming.reduce((s, id) => s + contractSalary(id), 0);
      return overseasCountAfter(userTeam, outgoing, incoming) <= getTradeOverseasLimit(userTeam, players)
        && overseasCountAfter(recipientTeam, incoming, outgoing) <= getTradeOverseasLimit(recipientTeam, players)
        && (auctionType === "mega" || (userTeam.remainingPurse + outSalary - inSalary >= -MINI_TRADE_OVERDRAFT_LAKHS && recipientTeam.remainingPurse + recipientOutgoingSalary - outSalary >= -MINI_TRADE_OVERDRAFT_LAKHS));
    };
    const ranks = { available: 0, open: 1, reluctant: 2, "highly-reluctant": 3 } as const;
    const strongestWillingness = (group: Player[]) => group.reduce((best, p) => {
      const current = getTeamTradeWillingness({ player: p, team: recipientTeam, players, season: currentSeason, currentInjured: injuredIds.has(p.id) });
      return ranks[current] > ranks[best] ? current : best;
    }, "available" as keyof typeof ranks);
    const aiValue = (group: Player[]) => calculateTradePackageValue(group.map((p) => calculateTeamTradeValue({ player: p, team: recipientTeam, players, season: currentSeason, auctionType, currentInjured: injuredIds.has(p.id) })));
    const packages = (pool: Player[]) => {
      const result = pool.map((p) => [p]);
      for (let i = 0; i < pool.length; i += 1) for (let j = i + 1; j < pool.length; j += 1) result.push([pool[i], pool[j]]);
      for (let i = 0; i < pool.length; i += 1) for (let j = i + 1; j < pool.length; j += 1) for (let k = j + 1; k < pool.length; k += 1) result.push([pool[i], pool[j], pool[k]]);
      return result;
    };
    const passesFinalValidator = (offered: Player[], requested: Player[]) => onExecuteTrade({
      proposerTeamId: userTeamId,
      recipientTeamId: recipientTeam.id,
      offeredPlayerIds: offered.map((p) => p.id),
      requestedPlayerIds: requested.map((p) => p.id),
      salaries: Object.fromEntries(requested.map((p) => [p.id, getTradeSalaryBand(p, currentSeason).demand])),
      date: currentDate,
      finalDate,
      auctionType,
      explanation: "Trade Hub validation",
      validateOnly: true,
    });
    if (offeredIds.length > 0 && requestedIds.length === 0) {
      const offeredValue = aiValue(selectedPlayers(offeredIds));
      const bestReturn = packages(selectableRecipientPlayers)
        .filter((group) => legal(offeredIds, group.map((p) => p.id)) && isTradeBalanced({ offeredValue, requestedValue: aiValue(group), requestedWillingness: strongestWillingness(group), requestedPremium: getRequestedTradePremium(group) }))
        .sort((a, b) => aiValue(b) - aiValue(a)).find((group) => passesFinalValidator(selectedPlayers(offeredIds), group));
      if (!bestReturn) { setMessage("The opposing club has no legal acceptable offer for those players."); return; }
      setRequestedIds(bestReturn.map((p) => p.id));
      setSalaryInputs(Object.fromEntries(bestReturn.map((p) => [p.id, String(getTradeSalaryBand(p, currentSeason).demand)])));
      setMessage(`The club offers ${bestReturn.map((p) => displayPlayerName(p.name)).join(" + ")}. This deal meets its acceptance threshold.`);
      return;
    }
    if (requestedIds.length > 0 && offeredIds.length === 0) {
      const requested = selectedPlayers(requestedIds);
      const requestedValue = aiValue(requested);
      const willingness = strongestWillingness(requested);
      const minimumOffer = packages(selectableUserPlayers)
        .filter((group) => legal(group.map((p) => p.id), requestedIds) && isTradeBalanced({ offeredValue: aiValue(group), requestedValue, requestedWillingness: willingness, requestedPremium: getRequestedTradePremium(selectedPlayers(requestedIds)) }))
        .sort((a, b) => aiValue(a) - aiValue(b)).find((group) => passesFinalValidator(group, requested));
      if (!minimumOffer) { setMessage("No legal one-, two- or three-player package from your squad meets the club's demand."); return; }
      setOfferedIds(minimumOffer.map((p) => p.id));
      setMessage(`The club requires ${minimumOffer.map((p) => displayPlayerName(p.name)).join(" + ")}. This is its minimum acceptable package.`);
      return;
    }
    if (offeredIds.length === 0 || requestedIds.length === 0) { setMessage("Select at least one player before asking the club to complete a trade."); return; }
    const offeredBase = selectedPlayers(offeredIds);
    const requestedBase = selectedPlayers(requestedIds);
    const additions = (pool: Player[], slots: number): Player[][] => {
      const result: Player[][] = [[]];
      if (slots >= 1) pool.forEach((p) => result.push([p]));
      if (slots >= 2) for (let i = 0; i < pool.length; i += 1) for (let j = i + 1; j < pool.length; j += 1) result.push([pool[i], pool[j]]);
      return result;
    };
    const offeredAdditions = additions(selectableUserPlayers.filter((p) => !offeredIds.includes(p.id)), 3 - offeredIds.length);
    const requestedAdditions = additions(selectableRecipientPlayers.filter((p) => !requestedIds.includes(p.id)), 3 - requestedIds.length);
    const candidates: Array<{ offered: Player[]; requested: Player[]; surplus: number; additions: number }> = [];
    offeredAdditions.forEach((offeredExtra) => requestedAdditions.forEach((requestedExtra) => {
      const offered = [...offeredBase, ...offeredExtra];
      const requested = [...requestedBase, ...requestedExtra];
      const offeredValue = aiValue(offered);
      const requestedValue = aiValue(requested);
      const willingness = strongestWillingness(requested);
      if (!legal(offered.map((p) => p.id), requested.map((p) => p.id))) return;
      if (!isTradeBalanced({ offeredValue, requestedValue, requestedWillingness: willingness, requestedPremium: getRequestedTradePremium(requested) })) return;
      candidates.push({ offered, requested, surplus: offeredValue - requestedValue, additions: offeredExtra.length + requestedExtra.length });
    }));
    const best = candidates.sort((a, b) => a.additions - b.additions || a.surplus - b.surplus).find((candidate) => passesFinalValidator(candidate.offered, candidate.requested));
    if (!best) { setMessage("No legal combination of additional players can make this trade acceptable within the three-player limits."); return; }
    setOfferedIds(best.offered.map((p) => p.id));
    setRequestedIds(best.requested.map((p) => p.id));
    setSalaryInputs(Object.fromEntries(best.requested.map((p) => [p.id, String(getTradeSalaryBand(p, currentSeason).demand)])));
    setMessage(best.additions === 0 ? "This trade already meets the AI threshold and can be proposed directly." : `Trade balanced by adding ${[...best.offered.slice(offeredBase.length), ...best.requested.slice(requestedBase.length)].map((p) => displayPlayerName(p.name)).join(" + ")}.`);
  };

  const playerCard = (player: Player, selected: boolean, onToggle: () => void, team: Team) => {
    const willingness = getTeamTradeWillingness({ player, team, players, season: currentSeason, currentInjured: injuredIds.has(player.id) });
    return (
      <button
        key={player.id}
        type="button"
        onClick={onToggle}
        className={`w-full min-w-0 border p-2 text-left transition-colors ${selected ? "border-accent bg-accent/10" : "border-border bg-bg hover:border-accent/50"}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-1">
          <span className="min-w-0 break-words text-[10px] font-semibold leading-tight text-text-primary">{displayPlayerName(player.name)}</span>
          {team.id !== userTeamId && <span className="shrink-0 font-space-mono text-[8px] font-bold uppercase text-accent">{willingness.replace("-", " ")}</span>}
        </div>
        <div className="mt-1 break-words font-space-mono text-[7px] uppercase leading-tight text-text-secondary">
          {player.role} · CA {Math.max(player.currentBatting, player.currentBowling)} · PA {Math.max(player.potentialBatting, player.potentialBowling)}
        </div>
      </button>
    );
  };

  const recommendedTrades = useMemo(() => {
    if (!userTeam || !open) return [];
    const suggestions: Array<{ team: Team; offered: Player; requested: Player; surplus: number }> = [];
    Object.values(teams).filter((team) => team.id !== userTeamId).forEach((team) => {
      const targetPool = team.squad.map((id) => players[id]).filter((p): p is Player => Boolean(p) && !tradedIds.has(p.id));
      selectableUserPlayers.forEach((offered) => targetPool.forEach((requested) => {
        const incomingValue = calculateTradePackageValue([calculateTeamTradeValue({ player: offered, team, players, season: currentSeason, auctionType, currentInjured: injuredIds.has(offered.id) })]);
        const outgoingValue = calculateTradePackageValue([calculateTeamTradeValue({ player: requested, team, players, season: currentSeason, auctionType, currentInjured: injuredIds.has(requested.id) })]);
        const willingness = getTeamTradeWillingness({ player: requested, team, players, season: currentSeason, currentInjured: injuredIds.has(requested.id) });
        if (!isTradeBalanced({ offeredValue: incomingValue, requestedValue: outgoingValue, requestedWillingness: willingness, requestedPremium: getRequestedTradePremium([requested]) })) return;
        if (overseasCountAfter(userTeam, [offered.id], [requested.id]) > getTradeOverseasLimit(userTeam, players) || overseasCountAfter(team, [requested.id], [offered.id]) > getTradeOverseasLimit(team, players)) return;
        const userPurse = userTeam.remainingPurse + contractSalary(offered.id) - getTradeSalaryBand(requested, currentSeason).demand;
        const aiPurse = team.remainingPurse + contractSalary(requested.id) - contractSalary(offered.id);
        if (auctionType === "mini" && (userPurse < -MINI_TRADE_OVERDRAFT_LAKHS || aiPurse < -MINI_TRADE_OVERDRAFT_LAKHS)) return;
        suggestions.push({ team, offered, requested, surplus: incomingValue - outgoingValue });
      }));
    });
    return suggestions.sort((a, b) => a.surplus - b.surplus).slice(0, 8);
  }, [auctionType, currentSeason, injuredIds, open, players, teams, tradedIds, userTeam, userTeamId]);

  if (hubView === "hub") return <div className="h-full overflow-y-auto p-4"><div className="flex items-center justify-between border-b-2 border-border pb-3"><div><h2 className="font-anton text-[24px] uppercase text-text-primary">Trade Hub</h2><p className="text-xs text-text-secondary">League transactions and deals other clubs would consider.</p></div><button type="button" onClick={() => setHubView("builder")} className="border border-accent bg-accent px-4 py-2 font-space-mono text-[9px] font-bold uppercase text-white">Open trade builder</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="border-2 border-border bg-surface p-4"><h3 className="font-anton text-[17px] uppercase text-text-primary">Completed league trades</h3><div className="mt-3 space-y-2">{currentWindowTradeRecords.length === 0 ? <p className="text-xs text-text-secondary">No trades have been completed yet.</p> : currentWindowTradeRecords.slice().reverse().map((record) => <div key={record.id} className="border border-border bg-bg p-3 text-xs text-text-primary"><div className="mb-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{record.season} trade window · {record.date}</div><span className="font-bold">{teams[record.fromTeamId]?.shortName}</span> sent {record.outgoingPlayerIds.map((id) => players[id]?.name ?? id).join(" + ")} to <span className="font-bold">{teams[record.toTeamId]?.shortName}</span> for {record.incomingPlayerIds.map((id) => players[id]?.name ?? id).join(" + ")}</div>)}</div></section><section className="border-2 border-border bg-surface p-4"><h3 className="font-anton text-[17px] uppercase text-text-primary">Recommended trades</h3><p className="mt-1 text-[10px] text-text-secondary">These pass current AI interest, overseas and purse checks.</p><div className="mt-3 space-y-2">{recommendedTrades.length === 0 ? <p className="text-xs text-text-secondary">No suitable recommendations are available right now.</p> : recommendedTrades.map((deal) => <button key={`${deal.team.id}-${deal.offered.id}-${deal.requested.id}`} type="button" onClick={() => { setRecipientTeamId(deal.team.id); setOfferedIds([deal.offered.id]); setRequestedIds([deal.requested.id]); setSalaryInputs({ [deal.requested.id]: String(getTradeSalaryBand(deal.requested, currentSeason).demand) }); setHubView("builder"); }} className="w-full border border-border bg-bg p-3 text-left text-xs hover:border-accent"><div className="font-semibold text-text-primary">Send {deal.offered.name} · Receive {deal.requested.name}</div><div className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">{deal.team.shortName} interested · Open in builder</div></button>)}</div></section></div></div>;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Scouting · Trade Window</p>
            <h2 className="mt-1 font-anton text-[18px] uppercase text-text-primary">Trade Hub</h2>
            <p className="mt-1 text-[10px] text-text-secondary">Construct a balanced 1–3 player swap. All requirements are shown centrally.</p>
          </div>
          <span className={`border px-2 py-1 font-space-mono text-[8px] font-bold uppercase ${open ? "border-success/40 bg-success/10 text-success" : "border-border text-text-secondary"}`}>
            {open ? "Window open" : "Window closed"}
          </span>
        </div>
        {!open && <p className="mt-2 border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary">Opens seven days after the final and closes on 31 October.</p>}
      </header>

      <div className="shrink-0"><button type="button" onClick={() => setHubView("hub")} className="border border-border px-2 py-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary hover:border-accent hover:text-accent">← Trade Hub</button></div>

      {!open && <div className="shrink-0 border-2 border-warning bg-warning/15 px-4 py-3 text-center shadow-sm" role="status"><div className="font-anton text-[18px] uppercase text-text-primary">Trade window closed</div><p className="mt-1 font-space-mono text-[9px] font-bold uppercase text-text-secondary">{beforeTradeWindow && tradeWindow ? `The trade window opens on ${tradeWindow.startsOn}. Trade configurations are locked until then.` : "The trade window is shut. No further trade configurations can be made this season."}</p></div>}

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(170px,0.62fr)_minmax(0,2.6fr)_minmax(170px,0.62fr)] ${open ? "" : "pointer-events-none select-none opacity-40"}`} aria-disabled={!open}>
        <section data-tour="trade-your-players" className="flex min-h-0 flex-col overflow-hidden border border-border bg-surface p-2.5">
          <div className="flex shrink-0 items-center justify-between gap-2"><h3 className="font-anton text-[16px] uppercase text-text-primary">Your players</h3>{offeredIds.length > 0 && <button type="button" onClick={() => setOfferedIds([])} className="border border-border px-1.5 py-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary hover:border-accent hover:text-accent">Clear selections</button>}</div>
          <p className="mb-3 shrink-0 font-space-mono text-[8px] uppercase text-text-secondary">Select up to three to offer</p>
          <div className="min-h-0 space-y-2 overflow-y-auto px-1">{selectableUserPlayers.map((player) => playerCard(player, offeredIds.includes(player.id), () => toggle(player.id, offeredIds, setOfferedIds), userTeam))}</div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden border-2 border-accent/50 bg-surface p-4 shadow-sm">
          {message && <div className="shrink-0 border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-text-primary">{message}</div>}
          {counterOffer && <div className="shrink-0 border-2 border-warning/60 bg-warning/10 px-2 py-2 text-[10px] font-semibold text-text-primary"><span className="font-space-mono text-[8px] font-bold uppercase text-warning">Theoretical club counteroffer {counterOptions.length ? `${counterIndex + 1}/${counterOptions.length}` : ""}</span>{counterOptions.length > 0 && <div className="mt-2 flex items-center gap-2"><div className="flex flex-wrap gap-2">{selectedPlayers(offeredIds).map((p) => <div key={p.id} className="flex h-16 w-16 items-center justify-center border border-accent bg-accent/10 p-1 text-center text-[8px]">{p.name}</div>)}</div><span className="text-lg text-warning">⇄</span><div className="flex flex-wrap gap-2">{counterOptions[counterIndex].map((id) => <div key={id} className="flex h-16 w-16 items-center justify-center border border-warning bg-warning/10 p-1 text-center text-[8px]">{players[id]?.name}</div>)}</div></div>}<div className="mt-2 text-text-primary">{counterOffer.replace("Club counteroffer: ", "")}</div>{counterOptions.length > 0 && <div className="mt-2 flex gap-2"><button type="button" className="border border-border px-2 py-1 font-space-mono text-[8px] uppercase" onClick={() => { const next = (counterIndex + 1) % counterOptions.length; setCounterIndex(next); setCounterOffer(`Club counteroffer: ${counterOptions[next].map((id) => players[id]?.name).join(" + ")}. This player exchange is within the club's acceptable valuation range.`); }}>Next offer</button><button type="button" className="border border-accent bg-accent px-2 py-1 font-space-mono text-[8px] uppercase text-white" onClick={() => { setRequestedIds(counterOptions[counterIndex]); setCounterOffer(null); }}>Use this deal</button></div>}</div>}
          <button data-tour="trade-balance" type="button" onClick={balanceTrade} disabled={!recipientTeam || (offeredIds.length === 0 && requestedIds.length === 0)} className="shrink-0 border border-warning/70 bg-warning/10 px-3 py-2 font-space-mono text-[9px] font-bold uppercase text-text-primary disabled:opacity-40">{offeredIds.length > 0 && requestedIds.length === 0 ? "What can you offer?" : requestedIds.length > 0 && offeredIds.length === 0 ? "What would it take?" : "Balance this trade"}</button>
          <div data-tour="trade-package" className="min-h-0 flex-1 overflow-y-auto flex flex-wrap items-center justify-center content-start gap-2">
            {requestedIds.length === 0 && <p className="py-6 text-center text-xs text-text-secondary">Select players from both columns to construct the swap.</p>}
            {offeredIds.length > 0 && <div className="flex flex-wrap items-center justify-center gap-2">{selectedPlayers(offeredIds).map((player) => <div key={player.id} className="flex h-24 w-24 flex-col justify-between border-2 p-2 text-center" style={{ borderColor: recipientTeam?.secondaryColor ?? "#888", backgroundColor: `${recipientTeam?.primaryColor ?? "#888"}22` }}><span className="break-words text-[10px] font-bold leading-tight text-text-primary">{player.name}</span><span className="font-space-mono text-[8px] uppercase text-text-secondary">To {recipientTeam?.shortName ?? "target"}</span></div>)}<span className="text-xl font-bold text-accent">⇄</span></div>}
            {requestedIds.map((id) => {
              const player = players[id];
              return <div key={id} className="flex h-24 w-24 flex-col justify-between border-2 p-2 text-center text-xs" style={{ borderColor: userTeam?.secondaryColor ?? "#888", backgroundColor: userTeam?.primaryColor ?? "#555", color: "#fff" }}><div className="break-words text-[10px] font-bold leading-tight text-white">{player?.name}</div><span className="font-space-mono text-[8px] uppercase text-white/80">To {userTeam?.shortName}</span></div>;
            })}
          </div>
          <div data-tour="trade-patience" className="shrink-0 border border-border bg-bg p-2">
            <div className="flex items-center justify-between font-space-mono text-[8px] font-bold uppercase text-text-secondary"><span>Negotiation patience</span><span>{patience}/4</span></div>
            <div className="mt-1 h-1.5 bg-border"><div className={`h-full ${patience <= 1 ? "bg-red-500" : "bg-accent"}`} style={{ width: `${patience * 25}%` }} /></div>
            {negotiationCoolingDown && <p className="mt-1.5 font-space-mono text-[8px] font-bold uppercase text-red-600">Talks reopen {cooldownEndsOn}</p>}
          </div>
          <div data-tour="trade-requirements" className="shrink-0 grid grid-cols-1 gap-1.5 text-[9px] xl:grid-cols-2">
            {[
              ["Your requirements", yourRequirements],
              ["Target team requirements", targetRequirements.length ? targetRequirements : ["Choose a target team to calculate requirements."]],
            ].map(([title, items]) => {
              const rows = items as string[];
              const blocked = rows.some((item) => item.includes("✕"));
              const awaiting = rows.length === 1 && rows[0].startsWith("Choose");
              return <div key={title as string} className={`border p-2 ${blocked ? "border-red-500/70 bg-red-500/10" : awaiting ? "border-border bg-bg" : "border-success/60 bg-success/10"}`}>
                <div className={`flex items-center justify-between font-space-mono text-[8px] font-bold uppercase ${blocked ? "text-red-600" : awaiting ? "text-text-secondary" : "text-success"}`}><span>{title as string}</span><span className="rounded px-1 py-0.5 text-[7px]">{blocked ? "BLOCKED" : awaiting ? "WAITING" : "CLEARED"}</span></div>
                <div className="mt-1 grid gap-1">{rows.map((item) => <div key={item} className={`border px-1.5 py-1 font-space-mono text-[8px] font-semibold ${item.includes("✕") ? "border-red-500/40 bg-red-500/15 text-red-700" : "border-success/30 bg-white/40 text-text-primary"}`}>{item}</div>)}</div>
              </div>;
            })}
          </div>
          <button data-tour="trade-submit" type="button" disabled={!open} onClick={submit} className="shrink-0 border border-accent bg-accent px-3 py-2 font-space-mono text-[9px] font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">Submit trade proposal</button>
        </section>

        <section data-tour="trade-target-players" className="flex min-h-0 flex-col overflow-hidden border border-border bg-surface p-2.5">
          <div className="flex shrink-0 items-center gap-1"><select value={recipientTeamId} onChange={(event) => { setRecipientTeamId(event.target.value); setRequestedIds([]); }} className="min-w-0 flex-1 border border-accent/60 bg-bg px-2 py-2 font-space-mono text-[9px] uppercase text-text-primary">
            <option value="">Choose team to trade with</option>
            {Object.values(teams).filter((team) => team.id !== userTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>{requestedIds.length > 0 && <button type="button" onClick={() => setRequestedIds([])} className="shrink-0 border border-border px-1.5 py-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary hover:border-accent hover:text-accent">Clear</button>}</div>
          <div className="min-h-0 space-y-2 overflow-y-auto px-1">{recipientTeam ? selectableRecipientPlayers.map((player) => playerCard(player, requestedIds.includes(player.id), () => toggle(player.id, requestedIds, setRequestedIds), recipientTeam)) : <p className="py-6 text-center text-xs text-text-secondary">Choose a team first.</p>}</div>
        </section>
      </div>

      {contractNegotiationOpen && recipientTeam && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4"><div className="w-full max-w-md border-2 border-accent bg-surface p-5 shadow-2xl"><h3 className="font-anton text-xl uppercase text-text-primary">Contract negotiation</h3><p className="mt-1 text-xs text-text-secondary">The clubs have agreed the trade. Each player has a fixed demand and may allow one or more auction-ladder steps below it.</p><div className="mt-4 space-y-3">{requestedIds.filter((id) => getTradeSalaryBand(players[id], currentSeason).demand !== contractSalary(id)).map((id) => { const player = players[id]; const band = getTradeSalaryBand(player, currentSeason); const options = getTradeSalaryOptions(player, currentSeason); return <div key={id} className="border border-border bg-bg p-3"><div className="font-semibold text-text-primary">{player.name}</div><div className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">Current {money(contractSalary(id))} · Requested {money(band.demand)}{band.minimum < band.demand ? ` · Negotiable to ${money(band.minimum)}` : " · Non-negotiable"}</div><select value={salaryInputs[id] ?? String(band.demand)} onChange={(event) => setSalaryInputs({ ...salaryInputs, [id]: event.target.value })} className="mt-2 w-full border border-border bg-surface px-2 py-2 font-space-mono text-[10px] text-text-primary">{options.map((amount) => <option key={amount} value={amount}>{money(amount)}</option>)}</select></div>; })}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setContractNegotiationOpen(false)} className="border border-border px-3 py-2 font-space-mono text-[9px] uppercase text-text-primary">Cancel</button><button type="button" onClick={() => { const completed = onExecuteTrade({ proposerTeamId: userTeamId, recipientTeamId: recipientTeam.id, offeredPlayerIds: offeredIds, requestedPlayerIds: requestedIds, salaries: Object.fromEntries(requestedIds.map((id) => [id, Number(salaryInputs[id] ?? getTradeSalaryBand(players[id], currentSeason).demand)])), date: currentDate, finalDate, auctionType, explanation: `User proposal: ${recipientTeam.shortName} squad adjustment` }); if (completed) { setContractNegotiationOpen(false); setMessage("Trade and player contracts completed."); setOfferedIds([]); setRequestedIds([]); setSalaryInputs({}); setPatience(4); } else setMessage("Contract terms were rejected or the negotiated salary broke a trade requirement."); }} className="border border-accent bg-accent px-3 py-2 font-space-mono text-[9px] font-bold uppercase text-white">Agree terms and complete trade</button></div></div></div>}
      {showGuide && <TradeHubGuidedTour onClose={() => setShowGuide(false)} />}
    </div>
  );
}
