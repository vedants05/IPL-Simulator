"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { applyTeamTheme } from "./TeamThemeProvider";
import {
  AlertTriangle,
  SkipForward,
  Play,
  Pause,
  Settings,
  Moon,
  Sun,
  BookOpen,
  Zap,
  RefreshCw,
  ShieldAlert,
  Users,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

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
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [activeTile, setActiveTile] = useState(0);
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
                className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-1.5 h-[28px] cursor-pointer hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
                style={{
                  border: "1.5px solid var(--ink)",
                  backgroundColor: "var(--team-bid-bg, #111622)",
                  backgroundImage: "var(--team-bid-tinge)",
                  color: "#ffffff",
                }}
                title="Skip remaining players in current set"
              >
                <SkipForward size={12} className="inline" /> Skip Set
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
                        <AlertTriangle size={12} className="inline" /> Skip Set?
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
                  className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-1.5 h-[28px] cursor-pointer hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
                  style={{
                    border: "1.5px solid var(--ink)",
                    backgroundColor: "var(--team-bid-bg, #111622)",
                    backgroundImage: "var(--team-bid-tinge)",
                    color: "#ffffff",
                  }}
                  title="Simulate all regular sets and skip straight to the Accelerated Auction"
                >
                  <SkipForward size={12} className="inline" /> Skip to Accelerated
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
                          <AlertTriangle size={12} className="inline" /> Skip to Accelerated?
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
                className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-1.5 h-[28px] cursor-pointer hover:bg-danger hover:text-white hover:scale-105 active:scale-95"
                style={{
                  border: "1.5px solid var(--ink)",
                  backgroundColor: "var(--team-bid-bg, #111622)",
                  backgroundImage: "var(--team-bid-tinge)",
                  color: "#ffffff",
                }}
                title="Skip and simulate the rest of the entire auction"
              >
                <SkipForward size={12} className="inline" /> Skip All
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
                        <AlertTriangle size={12} className="inline" /> Skip Entire Auction?
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
              className={`px-3.5 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-1.5 h-[28px] cursor-pointer ${
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
              {isPaused ? <><Play size={11} className="inline" /> Resume</> : <><Pause size={11} className="inline" /> Pause</>}
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
            <Settings size={14} />
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
                <div className="text-[10px] font-bold tracking-wider uppercase border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                  <Settings size={11} className="inline" /> Settings
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                    Color Theme
                  </span>
                  <div className="flex items-center justify-between px-3 py-1.5 rounded border border-[var(--ink)]">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold">
                      {isDarkMode ? <Moon size={11} className="inline" /> : <Sun size={11} className="inline" />}
                      {isDarkMode ? "Dark Mode" : "Light Mode"}
                    </span>
                    {/* Sliding toggle switch */}
                    <button
                      onClick={handleToggleDarkMode}
                      role="switch"
                      aria-checked={isDarkMode}
                      className="relative flex items-center cursor-pointer shrink-0 transition-all active:scale-95"
                      style={{
                        width: 44,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: isDarkMode ? "var(--ink)" : "#d1d5db",
                        border: "1.5px solid var(--ink)",
                        transition: "background-color 0.25s ease",
                        padding: 2,
                      }}
                      title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                      {/* Icons on the track */}
                      <Sun size={10} className="absolute left-[4px] text-yellow-400 pointer-events-none" style={{ opacity: isDarkMode ? 0.3 : 1, transition: "opacity 0.2s" }} />
                      <Moon size={10} className="absolute right-[4px] text-blue-300 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.3, transition: "opacity 0.2s" }} />
                      {/* Sliding pill */}
                      <span
                        className="absolute rounded-full shadow-sm"
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: isDarkMode ? "#1d55c4" : "#ffffff",
                          top: "50%",
                          transform: "translateY(-50%)",
                          left: isDarkMode ? "calc(100% - 18px)" : 2,
                          transition: "left 0.25s ease, background-color 0.25s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-[var(--ink)]/15 pt-2">
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                    Guides
                  </span>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setPaused(true);
                      setShowHowToPlay(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded border border-[var(--ink)] hover:bg-[var(--ink)]/5 text-[10px] font-bold cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={11} className="inline" /> How to Play
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg p-6 border-2 border-[var(--ink)] flex flex-col gap-6 font-barlow relative"
            style={{
              backgroundColor: "var(--surface, #ffffff)",
              color: "var(--ink, #111622)",
              boxShadow: "8px 8px 0px 0px var(--ink)",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowHowToPlay(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded border-2 border-[var(--ink)] font-bold text-[14px] hover:bg-red-600 hover:text-white transition-all duration-150 cursor-pointer active:scale-95 bg-[var(--surface)]"
              style={{ color: "var(--ink)", borderColor: "var(--ink)" }}
            >
              ✕
            </button>

            {/* Header */}
            <div>
              <h2 className="font-anton text-[28px] leading-none text-text-primary uppercase tracking-wide flex items-center gap-2">
                <BookOpen size={22} className="inline" /> Guide (Tile {activeTile + 1}/5)
              </h2>
              <p className="text-[11px] text-text-secondary font-space-mono mt-1 uppercase tracking-wider">
                Auction Paused · Swipe or click to read rules
              </p>
            </div>

            {/* Active Tile Display */}
            <div className="min-h-[220px] flex flex-col">
              {activeTile === 0 && (
                <div
                  className="border-2 border-[var(--ink)] p-4 flex-1 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    color: "var(--ink, #111622)",
                    borderColor: "var(--ink)",
                    boxShadow: "4px 4px 0px 0px var(--ink)",
                  }}
                >
                  <div className="font-anton text-[16px] text-[#1d55c4] uppercase tracking-wide border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                    <Zap size={15} className="inline" /> Auction Engine
                  </div>
                  <ul className="text-[12px] flex flex-col gap-2 list-disc pl-4 leading-relaxed text-inherit">
                    <li><strong>Bidding</strong>: Bid against 9 other teams. Click the bid button to raise by the current increment.</li>
                    <li><strong>Budget</strong>: Total purse of <strong>₹120 Crore</strong>. Keep track of your remaining budget.</li>
                    <li><strong>RTM Card</strong>: Use Right to Match cards to reclaim former players at their final auction price.</li>
                    <li><strong>Accelerated Round</strong>: Once the main sets finish, select key players to bring up for rapid bidding.</li>
                  </ul>
                </div>
              )}

              {activeTile === 1 && (
                <div
                  className="border-2 border-[var(--ink)] p-4 flex-1 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    color: "var(--ink, #111622)",
                    borderColor: "var(--ink)",
                    boxShadow: "4px 4px 0px 0px var(--ink)",
                  }}
                >
                  <div className="font-anton text-[16px] text-orange-500 uppercase tracking-wide border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                    <RefreshCw size={15} className="inline" /> Right to Match (RTM) Card
                  </div>
                  <ul className="text-[12px] flex flex-col gap-2 list-disc pl-4 leading-relaxed text-inherit">
                    <li><strong>Concept</strong>: Buy back a player who played for your franchise last season by matching the final winning bid.</li>
                    <li><strong>RTM Limit</strong>: Every team gets <strong>6</strong> total RTM/Retention slots. The RTM cards available equal <code>6 minus your pre-auction retentions</code>.</li>
                    <li><strong>Prompt</strong>: When one of your former players is sold to another team, you will be prompted to exercise an RTM.</li>
                    <li><strong>Counter-Bid</strong>: The winning bidder gets one final chance to raise their bid. If they do, you must match the new raised bid.</li>
                  </ul>
                </div>
              )}

              {activeTile === 2 && (
                <div
                  className="border-2 border-[var(--ink)] p-4 flex-1 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    color: "var(--ink, #111622)",
                    borderColor: "var(--ink)",
                    boxShadow: "4px 4px 0px 0px var(--ink)",
                  }}
                >
                  <div className="font-anton text-[16px] text-red-600 uppercase tracking-wide border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                    <ShieldAlert size={15} className="inline" /> Hard Constraints
                  </div>
                  <ul className="text-[12px] flex flex-col gap-2 list-disc pl-4 leading-relaxed text-inherit">
                    <li><strong>Squad Size</strong>: Minimum of <strong>18</strong> players and a maximum of <strong>25</strong> players.</li>
                    <li><strong>Overseas Players</strong>: Maximum of <strong>8</strong> overseas players in your 25-man squad.</li>
                    <li><strong>Playing XI</strong>: Matchday XI/XII can feature a maximum of <strong>4 overseas</strong> players.</li>
                  </ul>
                </div>
              )}

              {activeTile === 3 && (
                <div
                  className="border-2 border-[var(--ink)] p-4 flex-1 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    color: "var(--ink, #111622)",
                    borderColor: "var(--ink)",
                    boxShadow: "4px 4px 0px 0px var(--ink)",
                  }}
                >
                  <div className="font-anton text-[16px] text-green-600 uppercase tracking-wide border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                    <Users size={15} className="inline" /> Recommended Squad Size
                  </div>
                  <ul className="text-[12px] flex flex-col gap-2 list-disc pl-4 leading-relaxed text-inherit">
                    <li><strong>Bowler Depth</strong>: Minimum of <strong>5</strong> bowlers (with at least <strong>2 spinners</strong> and <strong>4 Indian</strong> bowlers).</li>
                    <li><strong>Indian Batters</strong>: Minimum of <strong>6</strong> Indian batters (with at least <strong>4 rated &gt;77</strong> and <strong>6 rated &gt;75</strong>).</li>
                    <li><strong>Auto-Fill Fallback</strong>: If you finish the auction short of these, cheaper uncapped players are automatically signed to fill slots.</li>
                  </ul>
                </div>
              )}

              {activeTile === 4 && (
                <div
                  className="border-2 border-[var(--ink)] p-4 flex-1 flex flex-col gap-3"
                  style={{
                    backgroundColor: "var(--surface, #ffffff)",
                    color: "var(--ink, #111622)",
                    borderColor: "var(--ink)",
                    boxShadow: "4px 4px 0px 0px var(--ink)",
                  }}
                >
                  <div className="font-anton text-[16px] text-purple-600 uppercase tracking-wide border-b border-[var(--ink)]/15 pb-1 flex items-center gap-1.5">
                    <TrendingUp size={15} className="inline" /> Bidding &amp; Value Systems
                  </div>
                  <ul className="text-[12px] flex flex-col gap-2 list-disc pl-4 leading-relaxed text-inherit">
                    <li><strong>Lakh (L)</strong>: 1 Lakh = 100,000 Rupees. Base prices start at ₹20L–₹50L.</li>
                    <li><strong>Crore (Cr)</strong>: 1 Crore = 100 Lakhs = 10,000,000 Rupees. Star players go for ₹5 Cr – ₹15 Cr.</li>
                    <li><strong>Bid Increments</strong>: The raise amount escalates automatically as the player's price rises:
                      <ul className="list-disc pl-6 mt-1 flex flex-col gap-1 text-[11px] opacity-90">
                        <li>Under ₹1 Cr: Raises by <strong>₹5 Lakhs</strong> per bid</li>
                        <li>₹1 Cr – ₹2 Cr: Raises by <strong>₹10 Lakhs</strong> per bid</li>
                        <li>₹2 Cr – ₹5 Cr: Raises by <strong>₹20 Lakhs</strong> per bid</li>
                        <li>Above ₹5 Cr: Raises by <strong>₹25 Lakhs</strong> per bid</li>
                      </ul>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Navigation and Dot Indicators */}
            <div className="flex items-center justify-between gap-4 mt-2 border-t border-[var(--ink)]/15 pt-4">
              <button
                onClick={() => setActiveTile((prev) => Math.max(0, prev - 1))}
                disabled={activeTile === 0}
                className={`px-4 py-1.5 border-2 border-[var(--ink)] font-anton uppercase text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTile === 0 ? "opacity-35 cursor-not-allowed" : "hover:bg-[var(--ink)] hover:text-[var(--surface)] active:scale-95 bg-[var(--surface)]"
                }`}
                style={{ color: "var(--ink)", borderColor: "var(--ink)" }}
              >
                <ArrowLeft size={13} className="inline" /> Back
              </button>

              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <span
                    key={idx}
                    className="w-2.5 h-2.5 border border-[var(--ink)] rounded-full transition-all"
                    style={{
                      backgroundColor: activeTile === idx ? "var(--ink)" : "transparent",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => (activeTile === 4 ? setShowHowToPlay(false) : setActiveTile((prev) => prev + 1))}
                className="px-4 py-1.5 border-2 border-[var(--ink)] font-anton uppercase text-[11px] hover:bg-[var(--ink)] hover:text-[var(--surface)] transition-all active:scale-95 cursor-pointer bg-[var(--surface)] flex items-center gap-1.5"
                style={{ color: "var(--ink)", borderColor: "var(--ink)" }}
              >
                {activeTile === 4 ? "Close" : <>Next <ArrowRight size={13} className="inline" /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
