"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GAME_OVERVIEW_TABS, gameProfileHref, getGameSubTabs, getSubTabLabel, PLAYER_PROFILE_PARAM, STAFF_PROFILE_PARAM, type GameOverviewTab } from "@/lib/logic/gameNavigation";
import { loadStaffDirectory, type StaffDirectoryPayload } from "@/lib/logic/staffDirectoryClient";
import { getCachedTeamProfileCareer } from "@/lib/logic/teamProfileCareerCache";
import { useEditorAccess } from "@/lib/store/editorAccessStore";
import { useGameStore } from "@/lib/store/gameStore";
import type { ProfileModalMatch } from "@/components/player/PlayerProfileModal";

const PlayerProfile = dynamic(() => import("@/components/player/PlayerProfileModal").then(module => module.PlayerProfileModal), { ssr: false });
const StaffProfile = dynamic(() => import("@/components/club/StaffManagementPage").then(module => module.LinkedStaffProfile), { ssr: false });

type SearchResult = {
  label: string;
  description: string;
  aliases?: string;
  destination: { href: string } | { kind: "player" | "staff"; id: string };
};

const combiningMarks = new RegExp("\\p{M}", "gu");
const wordSeparators = new RegExp("[^\\p{L}\\p{N}]+", "gu");

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(combiningMarks, "").toLowerCase().replace(wordSeparators, " ").trim();
}

function matchScore(label: string, aliases: string, query: string, words: string[]) {
  if (label === query || aliases === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  if (words.every(word => label.includes(word))) return 3;
  if (words.every(word => `${label} ${aliases}`.includes(word))) return 4;
  return -1;
}

export default function GameSearch({ seasonAvailable }: { seasonAvailable: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const listId = useId();
  const teams = useGameStore(state => state.teams);
  const players = useGameStore(state => state.players);
  const retiredPlayers = useGameStore(state => state.retiredPlayerSnapshots);
  const staff = useGameStore(state => state.careerStaff);
  const { enabled: editorEnabled } = useEditorAccess();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [directory, setDirectory] = useState<StaffDirectoryPayload["members"] | null>(null);
  const [directoryFailed, setDirectoryFailed] = useState(false);
  const normalizedQuery = normalizeSearch(query);
  const isOpen = focused && normalizedQuery.length >= 2;

  useEffect(() => {
    if (!isOpen || directory) return;
    let active = true;
    setDirectoryFailed(false);
    loadStaffDirectory().then(result => {
      if (active) setDirectory(result.members);
    }).catch(() => {
      if (active) setDirectoryFailed(true);
    });
    return () => { active = false; };
  }, [directory, isOpen]);

  const index = useMemo(() => {
    const entries: SearchResult[] = [
      { label: "Auction", description: "Page", destination: { href: "/game/auction" } },
    ];
    if (seasonAvailable) {
      for (const tab of Object.keys(GAME_OVERVIEW_TABS) as GameOverviewTab[]) {
        const { label: section } = GAME_OVERVIEW_TABS[tab];
        for (const subtab of getGameSubTabs(tab, editorEnabled)) {
          entries.push({
            label: subtab === "overview" ? section : getSubTabLabel(subtab),
            description: `Page · ${section}`,
            aliases: `${section} ${subtab}`,
            destination: { href: `/game/overview?tab=${tab}&subtab=${subtab}` },
          });
        }
      }
      for (const team of Object.values(teams)) {
        entries.push({
          label: team.name, description: "Team profile", aliases: team.shortName,
          destination: { href: `/game/teams/${encodeURIComponent(team.id)}` },
        });
      }
    }
    for (const player of Object.values(players)) {
      if (retiredPlayers[player.id]) continue;
      const team = player.currentTeamId ? teams[player.currentTeamId]?.shortName : undefined;
      entries.push({
        label: player.name, description: team ? `Player · ${team}` : "Player",
        destination: { kind: "player", id: player.id },
      });
    }
    for (const player of Object.values(retiredPlayers)) {
      entries.push({
        label: player.name, description: "Retired player",
        destination: { kind: "player", id: player.id },
      });
    }
    const staffEntries = new Map<string, SearchResult>();
    for (const member of directory ?? []) {
      if (typeof member.full_name !== "string") continue;
      staffEntries.set(member.id, {
        label: member.full_name, description: "Staff",
        aliases: typeof member.known_as === "string" ? member.known_as : undefined,
        destination: { kind: "staff", id: member.id },
      });
    }
    for (const member of Object.values(staff.generatedProfiles)) {
      staffEntries.set(member.id, {
        label: member.full_name, description: "Staff", aliases: member.known_as ?? undefined,
        destination: { kind: "staff", id: member.id },
      });
    }
    for (const contract of Object.values(staff.contracts)) {
      staffEntries.set(contract.staffId, {
        label: contract.fullName, description: `Staff · ${contract.primaryRole.replaceAll("_", " ")}`,
        aliases: staffEntries.get(contract.staffId)?.aliases,
        destination: { kind: "staff", id: contract.staffId },
      });
    }
    staffEntries.forEach(entry => entries.push(entry));
    return entries.map(entry => ({
      entry,
      label: normalizeSearch(entry.label),
      aliases: normalizeSearch(`${entry.aliases ?? ""} ${entry.description}`),
      exactAlias: normalizeSearch(entry.aliases ?? ""),
    }));
  }, [directory, editorEnabled, players, retiredPlayers, seasonAvailable, staff.contracts, staff.generatedProfiles, teams]);

  const results = useMemo(() => {
    if (!isOpen) return [];
    const words = normalizedQuery.split(" ");
    return index.flatMap(({ entry, label, aliases, exactAlias }) => {
      const score = exactAlias === normalizedQuery ? 0 : matchScore(label, aliases, normalizedQuery, words);
      return score < 0 ? [] : [{ entry, score }];
    }).sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label)).slice(0, 9).map(({ entry }) => entry);
  }, [index, isOpen, normalizedQuery]);

  const highlighted = Math.min(activeIndex, results.length - 1);
  const openResult = (entry: SearchResult) => {
    setQuery("");
    setFocused(false);
    setActiveIndex(0);
    const { destination } = entry;
    router.push("href" in destination ? destination.href : gameProfileHref(pathname, searchParams.toString(), destination), { scroll: false });
  };

  const playerId = pathname !== "/game/overview" ? searchParams.get(PLAYER_PROFILE_PARAM) : null;
  const staffId = searchParams.get(STAFF_PROFILE_PARAM);
  const { saveId, userTeamId } = useGameStore.getState();
  const fixtures = playerId || staffId
    ? getCachedTeamProfileCareer<{ fixtures: ProfileModalMatch[] }>(saveId, userTeamId)?.fixtures
    : undefined;
  const closeProfile = () => router.replace(gameProfileHref(pathname, searchParams.toString()), { scroll: false });

  return (
    <>
      <div className="app-game-search relative w-[176px] shrink-0">
        <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          aria-label="Search the game"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={isOpen && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          placeholder="Search the game"
          value={query}
          onFocus={() => setFocused(true)}
          onClick={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={event => {
            setQuery(event.target.value);
            setFocused(true);
            setActiveIndex(0);
          }}
          onKeyDown={event => {
            if (event.key === "Escape" && isOpen) {
              event.preventDefault();
              setFocused(false);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!isOpen) {
                setFocused(true);
                setActiveIndex(0);
              } else if (results.length) {
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((highlighted + direction + results.length) % results.length);
              }
            } else if (event.key === "Enter" && isOpen && results[highlighted]) {
              event.preventDefault();
              openResult(results[highlighted]);
            }
          }}
          className="h-7 w-full rounded border border-border bg-surface pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
        />
        {isOpen && (
          <div className="absolute left-0 top-full z-[80] mt-1 w-80 rounded-lg border border-border bg-surface p-1 text-text-primary shadow-xl">
            <ul id={listId} role="listbox" aria-label="Game search results">
              {results.map((entry, index) => (
                <li
                  key={"href" in entry.destination ? entry.destination.href : `${entry.destination.kind}:${entry.destination.id}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={highlighted === index}
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => openResult(entry)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${highlighted === index ? "bg-accent/15" : ""}`}
                >
                  <span className="truncate font-semibold">{entry.label}</span>
                  <span className="shrink-0 text-[9px] text-text-secondary">{entry.description}</span>
                </li>
              ))}
            </ul>
            {!results.length && <p role="status" className="px-2 py-2 text-xs text-text-secondary">
              {!directory && !directoryFailed ? "Checking the staff directory…" : "No matches found"}
            </p>}
          </div>
        )}
      </div>
      {playerId && <PlayerProfile playerId={playerId} customFixtures={fixtures} onClose={closeProfile}
        onOpenPlayer={id => router.replace(gameProfileHref(pathname, searchParams.toString(), { kind: "player", id }), { scroll: false })} />}
      {staffId && <StaffProfile staffId={staffId} customFixtures={fixtures} onClose={closeProfile} />}
    </>
  );
}
