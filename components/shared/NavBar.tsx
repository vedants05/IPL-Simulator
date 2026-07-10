"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { applyTeamTheme } from "./TeamThemeProvider";

const NAV_ITEMS = [
  { label: "Overview", href: "/game/overview" },
  { label: "Squad", href: "/game/squad" },
  { label: "Auction", href: "/game/auction" },
];

export default function NavBar() {
  const pathname = usePathname();
  const {
    teams,
    userTeamId,
    currentDate,
    auction,
    isPaused,
    setPaused,
    togglePaused,
    speed,
    increaseSpeed,
    decreaseSpeed,
    skipCurrentSet,
    skipAllAuction,
    skipToAcceleratedAuction,
  } = useGameStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [wasPausedBeforeConfirm, setWasPausedBeforeConfirm] = useState(false);

  const [showConfirmAccel, setShowConfirmAccel] = useState(false);
  const [wasPausedBeforeConfirmAccel, setWasPausedBeforeConfirmAccel] = useState(false);

  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [wasPausedBeforeConfirmAll, setWasPausedBeforeConfirmAll] = useState(false);
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
    if (userTeamId) {
      applyTeamTheme(userTeamId);
    }
  };

  const handleSkipPress = () => {
    setWasPausedBeforeConfirm(isPaused);
    setPaused(true);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    skipCurrentSet();
  };

  const handleCancel = () => {
    setShowConfirm(false);
    if (!wasPausedBeforeConfirm) {
      setPaused(false);
    }
  };

  const handleSkipAccelPress = () => {
    setWasPausedBeforeConfirmAccel(isPaused);
    setPaused(true);
    setShowConfirmAccel(true);
  };

  const handleConfirmAccel = () => {
    setShowConfirmAccel(false);
    skipToAcceleratedAuction();
  };

  const handleCancelAccel = () => {
    setShowConfirmAccel(false);
    if (!wasPausedBeforeConfirmAccel) {
      setPaused(false);
    }
  };

  const handleSkipAllPress = () => {
    setWasPausedBeforeConfirmAll(isPaused);
    setPaused(true);
    setShowConfirmAll(true);
  };

  const handleConfirmAll = () => {
    setShowConfirmAll(false);
    skipAllAuction();
  };

  const handleCancelAll = () => {
    setShowConfirmAll(false);
    if (!wasPausedBeforeConfirmAll) {
      setPaused(false);
    }
  };
  const userTeam = teams[userTeamId];
  const isAuctionPage = pathname.startsWith("/game/auction");

  return (
    <nav className="h-12 border-b-2 border-border flex items-center px-5 gap-0 shrink-0 z-50">
      {userTeam && (
        <div className="flex items-center gap-2.5 mr-5 shrink-0">
          <div
            className="h-7 min-w-[28px] px-2 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all duration-200 shadow-sm"
            style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
          >
            {userTeam.shortName}
          </div>
          <span
            className="font-space-mono font-bold text-[11px] tracking-widest uppercase transition-colors duration-200"
            style={{ color: "var(--chrome-nav-active, var(--ink))" }}
          >
            {userTeam.name}
          </span>
        </div>
      )}

      <div className="flex items-center gap-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 h-12 flex items-center text-[11px] font-bold tracking-widest uppercase font-space-mono transition-colors border-b-2
                ${active
                  ? "bg-surface"
                  : "hover:bg-surface"
                }`}
              style={{
                color: active ? "var(--chrome-nav-active, var(--ink))" : "var(--chrome-nav-muted, #8a92a3)",
                borderBottomColor: active ? "var(--team-accent, var(--ink))" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 font-space-mono text-[10px]">
        {!isAuctionPage && (
          <span className="tracking-wider" style={{ color: "var(--chrome-nav-muted)" }}>{currentDate}</span>
        )}
        {isAuctionPage && auction && auction.phase === "live" && (
          <>
            {/* Skip Set Button */}
            <div className="relative flex items-center">
              <button
                onClick={handleSkipPress}
                className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
                style={{
                  border: "1.5px solid var(--ink)",
                  backgroundColor: "var(--team-bid-bg, #111622)",
                  backgroundImage: "var(--team-bid-tinge)",
                  color: "#ffffff",
                }}
                title="Skip remaining players in current set"
              >
                ⏭ Skip Set
              </button>

              {showConfirm && (
                <>
                  {/* Invisible overlay for clicking outside */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={handleCancel}
                  />
                  {/* Small confirmation tile */}
                  <div
                    className="absolute right-0 top-full mt-2 w-64 p-4 z-50 rounded shadow-xl text-left border-2 flex flex-col gap-3 font-space-mono animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{
                      backgroundColor: "var(--surface, var(--surface))",
                      color: "var(--ink, var(--ink))",
                      borderColor: "var(--ink, var(--ink))",
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold tracking-wider uppercase text-danger flex items-center gap-1">
                        ⚠️ Skip Set?
                      </div>
                      <p className="text-[10px] leading-normal font-bold">
                        Skip all remaining players in{" "}
                        <span className="underline decoration-wavy decoration-[#1d55c4]">
                          {auction?.sets?.[auction?.currentSetIndex]?.name || "current set"}
                        </span>
                        ?
                      </p>
                      <p className="text-[9px] leading-normal opacity-85 font-medium">
                        This will instantly simulate and finalize the auction for the rest of this set.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirm}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-danger text-white hover:bg-red-600 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, var(--ink))",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-transparent text-[var(--ink)] hover:bg-black/5 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, var(--ink))",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Skip to Accelerated Button */}
            {auction && !auction.isAcceleratedPhase && (
              <div className="relative flex items-center">
                <button
                  onClick={handleSkipAccelPress}
                  className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
                  style={{
                    border: "1.5px solid var(--ink)",
                    backgroundColor: "var(--team-bid-bg, #111622)",
                    backgroundImage: "var(--team-bid-tinge)",
                    color: "#ffffff",
                  }}
                  title="Simulate all regular sets and skip straight to the Accelerated Auction"
                >
                  ⏭ Skip to Accelerated
                </button>

                {showConfirmAccel && (
                  <>
                    {/* Invisible overlay for clicking outside */}
                    <div
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={handleCancelAccel}
                    />
                    {/* Small confirmation tile */}
                    <div
                      className="absolute right-0 top-full mt-2 w-64 p-4 z-50 rounded shadow-xl text-left border-2 flex flex-col gap-3 font-space-mono animate-in fade-in slide-in-from-top-2 duration-150"
                      style={{
                        backgroundColor: "var(--surface, var(--surface))",
                        color: "var(--ink, var(--ink))",
                        borderColor: "var(--ink, var(--ink))",
                      }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold tracking-wider uppercase text-danger flex items-center gap-1">
                          ⚠️ Skip to Accelerated?
                        </div>
                        <p className="text-[10px] leading-normal font-bold">
                          Skip all remaining regular sets?
                        </p>
                        <p className="text-[9px] leading-normal opacity-85 font-medium">
                          This will instantly simulate the remaining regular lots and take you straight to the start of the Accelerated phase.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmAccel}
                          className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-danger text-white hover:bg-red-600 active:scale-95 flex items-center justify-center"
                          style={{
                            border: "1.5px solid var(--ink, var(--ink))",
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleCancelAccel}
                          className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-transparent text-[var(--ink)] hover:bg-black/5 active:scale-95 flex items-center justify-center"
                          style={{
                            border: "1.5px solid var(--ink, var(--ink))",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Skip All Button */}
            <div className="relative flex items-center">
              <button
                onClick={handleSkipAllPress}
                className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer hover:bg-danger hover:text-white hover:scale-105 active:scale-95"
                style={{
                  border: "1.5px solid var(--ink)",
                  backgroundColor: "var(--team-bid-bg, #111622)",
                  backgroundImage: "var(--team-bid-tinge)",
                  color: "#ffffff",
                }}
                title="Skip and simulate the rest of the entire auction"
              >
                ⏩ Skip All
              </button>

              {showConfirmAll && (
                <>
                  {/* Invisible overlay for clicking outside */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={handleCancelAll}
                  />
                  {/* Small confirmation tile */}
                  <div
                    className="absolute right-0 top-full mt-2 w-64 p-4 z-50 rounded shadow-xl text-left border-2 flex flex-col gap-3 font-space-mono animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{
                      backgroundColor: "var(--surface, var(--surface))",
                      color: "var(--ink, var(--ink))",
                      borderColor: "var(--ink, var(--ink))",
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold tracking-wider uppercase text-danger flex items-center gap-1">
                        ⚠️ Skip Entire Auction?
                      </div>
                      <p className="text-[10px] leading-normal font-bold">
                        Simulate and skip the entire rest of the Mega Auction?
                      </p>
                      <p className="text-[9px] leading-normal opacity-85 font-medium">
                        This will instantly simulate every remaining player in all sets, run accelerated phases, and finalize the franchise squads.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmAll}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-danger text-white hover:bg-red-600 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, var(--ink))",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancelAll}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-transparent text-[var(--ink)] hover:bg-black/5 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, var(--ink))",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Speed Controls */}
            <div
              className="flex items-center gap-0 rounded select-none h-[28px] overflow-hidden transition-colors duration-200"
              style={{
                backgroundColor: "var(--team-bid-bg, #111622)",
                backgroundImage: "var(--team-bid-tinge)",
                border: "1.5px solid var(--ink)",
              }}
            >
              <button
                disabled={speed === 1}
                onClick={decreaseSpeed}
                className="px-2 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Decrease Speed"
              >
                &lt;&lt;
              </button>
              <span
                className="font-space-mono font-bold text-[10px] min-w-[28px] text-center text-white flex items-center justify-center h-full border-x border-white/15 px-1.5 select-none"
              >
                {speed}x
              </span>
              <button
                disabled={speed === 8}
                onClick={increaseSpeed}
                className="px-2 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Increase Speed"
              >
                &gt;&gt;
              </button>
            </div>

            <button
              onClick={togglePaused}
              className={`px-3.5 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer ${
                isPaused
                  ? "bg-danger text-white hover:bg-red-600 hover:scale-105 active:scale-95 animate-pulse"
                  : "hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
              }`}
              style={{
                border: "1.5px solid var(--ink)",
                backgroundColor: isPaused ? undefined : "var(--team-bid-bg, #111622)",
                backgroundImage: isPaused ? undefined : "var(--team-bid-tinge)",
                color: "#ffffff",
              }}
            >
              {isPaused ? "▶ Resume" : "❚❚ Pause"}
            </button>
          </>
        )}

        {/* Settings Button */}
        <div className="relative flex items-center">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-[28px] h-[28px] rounded border-[1.5px] border-[var(--ink)] hover:bg-[#1d55c4] hover:text-white flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: "var(--team-bid-bg, #111622)",
              backgroundImage: "var(--team-bid-tinge)",
              color: "#ffffff",
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
                  backgroundColor: "var(--surface, var(--surface))",
                  color: "var(--ink, var(--ink))",
                  borderColor: "var(--ink, var(--ink))",
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
    </nav>
  );
}
