"use client";

import { useSyncExternalStore } from "react";
import type { Player } from "@/lib/types";

const changeEvent = "ipl-developer-tools-changed";
export function setDeveloperToolsEnabled(enabled: boolean) {
  try { sessionStorage.setItem("ipl-developer-tools-enabled", enabled ? "1" : "0"); } catch { /* Storage may be unavailable. */ }
  window.dispatchEvent(new Event(changeEvent));
}
export function useDeveloperToolsEnabled() {
  return useSyncExternalStore(
    callback => { window.addEventListener(changeEvent, callback); return () => window.removeEventListener(changeEvent, callback); },
    () => { try { return sessionStorage.getItem("ipl-developer-tools-enabled") === "1"; } catch { return false; } },
    () => false,
  );
}
const rating = (value: number | undefined) => value == null ? "Not set" : String(value);
export function developerPlayerRatings(player: Player) {
  return `Developer ratings — ${player.name}\nBatting: Powerplay ${rating(player.powerplayBatting)} · Middle ${rating(player.middleOversBatting)} · Death ${rating(player.deathBatting)}\nBowling: Powerplay ${rating(player.powerplayBowling)} · Middle ${rating(player.middleOversBowling)} · Death ${rating(player.deathBowling)}\nFielding ${rating(player.fieldingRating)} · Wicketkeeping ${rating(player.wicketkeepingRating)}\nBatting consistency ${rating(player.battingConsistency)} · Bowling consistency ${rating(player.bowlingConsistency)} · Pressure ${rating(player.pressureRating)} · Big match ${rating(player.bigMatchRating)}`;
}
