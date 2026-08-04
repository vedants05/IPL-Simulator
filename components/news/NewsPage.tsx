"use client";

import { useMemo, useState } from "react";
import { 
  Newspaper, 
  TrendingUp, 
  Calendar, 
  User, 
  ArrowUpRight, 
  Sliders, 
  Layout, 
  List, 
  Grid, 
  Award, 
  Clock, 
  BookOpen, 
  ChevronRight,
  Shield,
  Zap
} from "lucide-react";
import type { CareerRetirementRecord } from "@/lib/logic/careerLifecycle";
import type { Player, Team } from "@/lib/types";

interface NewsPageProps {
  userTeamId: string;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  playerStats: Record<string, {
    teamId: string;
    runs: number;
    balls: number;
    wickets: number;
    runsConceded: number;
    oversBowled: number;
    fours?: number;
    sixes?: number;
  }>;
  standings: Array<{
    teamId: string;
    teamName: string;
    shortName: string;
    played: number;
    won: number;
    lost: number;
    noResults: number;
    points: number;
    nrr: number;
  }>;
  retirements: CareerRetirementRecord[];
  retirementHistory: CareerRetirementRecord[];
  currentSeason: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  subheading: string;
  content: string;
  category: "user_team" | "team_summaries" | "player_news" | "tournament_league" | "transfers_auctions";
  tag?: string;
  timestamp: string;
  publishedAt?: string;
  playerId?: string;
  teamId?: string;
  associatedEntityIds?: { playerId?: string; teamId?: string };
  imageMockupPrompt?: string;
  imagePlaceholder?: string;
  author: string;
  readTime: string;
  isBreaking?: boolean;
}

type NewsLayout = "cricinfo" | "cricbuzz" | "newsletter";
type NewsTab = "all" | NewsArticle["category"];

const CATEGORY_LABELS: Record<NewsTab, string> = {
  all: "All stories",
  user_team: "User team",
  team_summaries: "Team summaries",
  player_news: "Player news & profiles",
  tournament_league: "Tournament & league",
  transfers_auctions: "Transfer & auction news",
};

export default function NewsPage({ 
  userTeamId,
  players, 
  teams, 
  playerStats, 
  standings, 
  retirements, 
  retirementHistory, 
  currentSeason 
}: NewsPageProps) {
  const [layout, setLayout] = useState<NewsLayout>("cricinfo");
  const [activeTab, setActiveTab] = useState<NewsTab>("all");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // 1. Calculate historical/season data for dynamic insertion if desired
  const seasonRetirements = retirementHistory.filter((r) => r.season === currentSeason);
  const displayedRetirements = seasonRetirements.length > 0 ? seasonRetirements : retirements.filter((r) => r.season === currentSeason);
  
  const userTeam = teams[userTeamId];

  // 2. Structuring placeholders/stubs for future custom dynamic creation
  const mockArticles: NewsArticle[] = useMemo(() => ([
    {
      id: "art-1",
      title: `${userTeam?.name || "User Team"} Launch Mid-Season Campaign: Strategy Adjustments and Playing XI Shakeups`,
      subheading: "Tactical adjustments inside the camp as management zeroes in on optimum team combination for the playoff push.",
      content: "As the tournament enters its critical mid-season segment, team management has hinted at a series of tactical shifts. Special focus has been placed on improving powerplay scoring rates and bowling discipline during death overs. An official spokesperson confirmed that the team is prioritizing adaptability in match lineups depending on pitch moisture levels and outfield speeds.",
      category: "user_team",
      timestamp: "2 hours ago",
      teamId: userTeamId,
      imageMockupPrompt: "Action shot of cricket players discussing tactics under floodlights, team huddle style, premium cinematic atmosphere",
      author: "Harsha Bhogle",
      readTime: "4 min read",
      isBreaking: true
    },
    {
      id: "art-2",
      title: "The Retiring Vanguard: Veterans Preparing for a Final Chapter in Simulated Career Leagues",
      subheading: "With physical condition rules tightening, we look at who is preparing to call time on their career this season.",
      content: `The current season is witnessing a changing of the guard. With several veteran campaigners approaching age-related thresholds, analysts anticipate a significant wave of retirements. Currently, ${displayedRetirements.length} players have finalized retirement papers, signaling an end to illustrious careers that defined the previous cycles of the franchise drafts.`,
      category: "player_news",
      timestamp: "5 hours ago",
      imageMockupPrompt: "Silhouette of a cricket batsman walking off the field, holding a helmet up, sunset backdrop, dramatic lens flare",
      author: "Michael Atherton",
      readTime: "6 min read"
    },
    {
      id: "art-3",
      title: "Playoff Mathematics: Breaking Down Standings and Strengths for the Final Six Weeks",
      subheading: "Who occupies the driving seat, and whose campaign runs the risk of a premature mid-season collapse?",
      content: "The battle for the top-4 playoff spots has intensified. The league points table shows a cluster in the mid-table positions. Statistical depth models suggest that bowling economies during middle overs will decide the final qualifier, with team NRR margins currently separated by fraction values.",
      category: "tournament_league",
      timestamp: "12 hours ago",
      imageMockupPrompt: "Vibrant infographics of points tables, golden cup trophy icon, premium dark blue statistics aesthetic",
      author: "Cricinfo Stats Dep.",
      readTime: "5 min read",
      isBreaking: true
    },
    {
      id: "art-4",
      title: "RTM Valuations and Auction Bargains: How Squad Budgets Played Out in Retrospect",
      subheading: "Did the heavy auction spending pay off? We evaluate squad price tags against actual performance returns.",
      content: "Franchise owners who spent heavily in the auction are auditing their returns on investment. While some marquee players with Cr-level fees have delivered match-winning contributions, the real stories are the value buys under 100 Lakhs who have anchored team balances and enabled flexible squad combinations.",
      category: "transfers_auctions",
      timestamp: "1 day ago",
      imageMockupPrompt: "An auction gavel resting next to a digital ledger board showing rising stock charts, golden lights background",
      author: "Gautam Gambhir",
      readTime: "8 min read"
    },
    {
      id: "art-5",
      title: "Tactical Deep-Dive: Middle Overs Spin vs. Pace Bowling Efficiencies",
      subheading: "How team presets and captaincy styles are shifting to counter aggressive batting approaches.",
      content: "Data analysts have revealed that teams employing spin-bowling presets in the middle overs have seen a 12% drop in boundary concessions. Captaincy choices play an integral role here, where high-captaincy rating leadership leads to quicker fields changes and optimum bowler rotations.",
      category: "team_summaries",
      timestamp: "1 day ago",
      imageMockupPrompt: "Top-down view of a green cricket field diagram with white tactical arrows, strategic blueprint style",
      author: "Nasser Hussain",
      readTime: "4 min read"
    },
    {
      id: "art-6",
      title: "Youngster Development: Under-25 Players Shaking Up the Squad Lineup Hierarchies",
      subheading: "A detailed analysis of emerging rookies asserting themselves in the starting playing XIs.",
      content: "Young prospects are making selection difficult for coaches. With dynamic potential capability scoring showing high growth parameters, rookie players under the age of 25 are breaking into matchday lineups and outperforming established veterans.",
      category: "player_news",
      timestamp: "2 days ago",
      imageMockupPrompt: "Close-up of a young cricketer looking determined, helmet visor showing stadium lights reflection, premium photography",
      author: "Ian Bishop",
      readTime: "3 min read"
    }
  ] as NewsArticle[]).map((article) => ({
    ...article,
    publishedAt: article.publishedAt || new Date().toISOString(),
    associatedEntityIds: article.associatedEntityIds || { playerId: article.playerId, teamId: article.teamId },
    imagePlaceholder: article.imagePlaceholder || article.imageMockupPrompt,
  })), [userTeam, userTeamId, displayedRetirements.length]);

  // 3. Filter articles based on selected tab
  const filteredArticles = useMemo(() => {
    const placeholders: NewsArticle[] = [
      { id: "placeholder-1", title: "Article 1", subheading: "Placeholder article headline", content: "Placeholder article content will be supplied later.", category: "user_team", tag: "User Team", timestamp: "Today", author: "News Desk", readTime: "2 min read", imageMockupPrompt: "Placeholder image" },
      { id: "placeholder-2", title: "Article 2", subheading: "Placeholder article headline", content: "Placeholder article content will be supplied later.", category: "team_summaries", tag: "Team Summary", timestamp: "Today", author: "News Desk", readTime: "2 min read", imageMockupPrompt: "Placeholder image" },
      { id: "placeholder-3", title: "Article 3", subheading: "Placeholder article headline", content: "Placeholder article content will be supplied later.", category: "player_news", tag: "Player News", timestamp: "Today", author: "News Desk", readTime: "2 min read", imageMockupPrompt: "Placeholder image" },
      { id: "placeholder-4", title: "Article 4", subheading: "Placeholder article headline", content: "Placeholder article content will be supplied later.", category: "tournament_league", tag: "Tournament", timestamp: "Today", author: "News Desk", readTime: "2 min read", imageMockupPrompt: "Placeholder image" },
      { id: "placeholder-5", title: "Article 5", subheading: "Placeholder article headline", content: "Placeholder article content will be supplied later.", category: "transfers_auctions", tag: "Auction", timestamp: "Today", author: "News Desk", readTime: "2 min read", imageMockupPrompt: "Placeholder image" },
    ];
    return activeTab === "all" ? placeholders : placeholders.filter((article) => article.category === activeTab);
  }, [activeTab]);

  const heroArticle = useMemo(() => {
    return filteredArticles.find((a) => a.isBreaking) || filteredArticles[0];
  }, [filteredArticles]);

  const secondaryArticles = useMemo(() => {
    return filteredArticles.filter((a) => a.id !== heroArticle?.id);
  }, [filteredArticles, heroArticle]);

  const selectedArticle = useMemo(() => {
    return filteredArticles.find((art) => art.id === selectedArticleId);
  }, [selectedArticleId, filteredArticles]);

  // Each mode deliberately follows the visual language of its real-world reference:
  // ESPNcricinfo's navy/blue editorial layout, Cricbuzz's green score-first layout,
  // and a clean magazine/newsletter treatment for the third page.
  const pageTheme = layout === "cricinfo"
    ? { shell: "bg-[#f2f4f7] text-[#17202a]", header: "bg-[#1b3b5a] text-white", tab: "bg-[#03a9f4] text-white", border: "border-[#d8dee6]", surface: "bg-white" }
    : layout === "cricbuzz"
      ? { shell: "bg-[#f5f5f5] text-[#222]", header: "bg-[#009270] text-white", tab: "bg-[#009270] text-white", border: "border-[#d9d9d9]", surface: "bg-white" }
      : { shell: "bg-[#fffaf3] text-[#252525]", header: "bg-[#242424] text-white", tab: "bg-[#e36b2c] text-white", border: "border-[#eadfd2]", surface: "bg-white" };

  return (
    <div className={`news-page flex h-full min-h-0 flex-col gap-4 overflow-hidden ${pageTheme.shell}`}>
      {/* 1. Header with View Toggle Selector */}
      <div className={`flex shrink-0 flex-col gap-3 border-b ${pageTheme.border} px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${pageTheme.header}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Newspaper size={12} />
            </span>
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em]">{layout === "cricinfo" ? "ESPNcricinfo" : layout === "cricbuzz" ? "Cricbuzz" : "The IPL Daily"}</span>
          </div>
          <h1 className="mt-1 font-anton text-[26px] uppercase leading-none">{layout === "cricinfo" ? "Cricket News & Scores" : layout === "cricbuzz" ? "Live Cricket News" : "Cricket News Briefing"}</h1>
        </div>

        {/* Segmented view controls */}
        <div className="flex items-center gap-1 rounded border border-white/20 bg-black/10 p-1">
          {[
            { id: "cricinfo", label: "Cricinfo page", icon: Layout },
            { id: "cricbuzz", label: "Cricbuzz page", icon: List },
            { id: "newsletter", label: "Newsletter page", icon: Grid },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLayout(opt.id as NewsLayout)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider transition-all ${
                  layout === opt.id
                    ? "bg-white/20 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={11} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex shrink-0 items-center gap-5 overflow-x-auto border-b ${pageTheme.border} px-4 py-2 font-barlow text-[11px] font-semibold uppercase tracking-wide`}>
        {(layout === "cricbuzz"
          ? ["Home", "Matches", "Series", "Videos", "News"]
          : layout === "cricinfo"
            ? ["Home", "Live Scores", "Schedule", "Results", "News", "Stats"]
            : ["Morning Brief", "Features", "Analysis", "Archive"]).map((item, index) => (
          <span key={item} className={index === 0 ? "border-b-2 border-current pb-1" : "opacity-65"}>{item}</span>
        ))}
      </div>

      {/* 2. Category / Topic Navigation Tabs */}
      <div className={`flex shrink-0 gap-1.5 overflow-x-auto border-b ${pageTheme.border} px-4 pb-2`}>
        {[
          { id: "all", label: CATEGORY_LABELS.all },
          { id: "user_team", label: `${userTeam?.shortName || "My Team"} Focus` },
          { id: "team_summaries", label: CATEGORY_LABELS.team_summaries },
          { id: "player_news", label: CATEGORY_LABELS.player_news },
          { id: "tournament_league", label: CATEGORY_LABELS.tournament_league },
          { id: "transfers_auctions", label: CATEGORY_LABELS.transfers_auctions },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as NewsTab)}
              className={`whitespace-nowrap rounded px-3 py-1 font-space-mono text-[9px] font-extrabold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? `${pageTheme.tab} border border-transparent`
                  : "border border-transparent opacity-65 hover:opacity-100"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Main Article Render Workspace */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {filteredArticles.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface p-6 text-center">
            <Newspaper size={32} className="text-text-secondary/40" />
            <h3 className="mt-2 font-anton text-[16px] uppercase text-text-primary">No stories found</h3>
            <p className="mt-1 font-barlow text-xs text-text-secondary max-w-xs">
              There are no articles listed under the &quot;{activeTab.replace("_", " ")}&quot; filter. Select another topic above to view mock articles.
            </p>
          </div>
        ) : (
          <>
            {layout === "cricinfo" && (
              <div className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded border border-[#d8dee6] bg-[#d8dee6] sm:grid-cols-4">
                {standings.slice(0, 4).map((team, index) => (
                  <div key={team.teamId} className="bg-white px-3 py-2">
                    <div className="flex items-center justify-between font-space-mono text-[8px] uppercase text-[#6b7280]"><span>{index === 0 ? "Featured match" : "Upcoming"}</span><span>{team.shortName}</span></div>
                    <div className="mt-1 font-barlow text-xs font-bold text-[#17202a]">{team.teamName}</div>
                    <div className="mt-0.5 font-space-mono text-[8px] text-[#6b7280]">{team.won} W · {team.lost} L · {team.points} PTS</div>
                  </div>
                ))}
              </div>
            )}
            {/* ==================== CRICINFO LAYOUT ==================== */}
            {layout === "cricinfo" && (
              <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-5 min-h-[500px]">
                {/* Left: Lead Story Card */}
                {heroArticle && (
                  <div className="flex flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
                    {/* Mockup image placeholder */}
                    <div className="relative aspect-[16/9] w-full bg-black/5 dark:bg-white/5 border-b border-border flex flex-col justify-between p-4 overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent z-10" />
                      
                      {/* Image prompt display badge */}
                      <span className="self-start rounded bg-black/60 px-2 py-0.5 font-space-mono text-[7.5px] font-bold text-white uppercase tracking-wider backdrop-blur-sm z-20">
                        Mock Illustration Asset
                      </span>

                      {/* Title overlays */}
                      <div className="mt-auto z-20">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="rounded bg-danger px-2 py-0.5 font-space-mono text-[8px] font-extrabold text-white uppercase tracking-wider animate-pulse">
                            Lead Story
                          </span>
                          <span className="font-space-mono text-[9px] text-white/70">{heroArticle.timestamp}</span>
                        </div>
                        <h2 
                          onClick={() => setSelectedArticleId(heroArticle.id)}
                          className="font-anton text-[22px] leading-tight text-white uppercase cursor-pointer hover:underline"
                        >
                          {heroArticle.title}
                        </h2>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1 justify-between">
                      <div>
                        <p className="font-barlow text-sm font-bold text-text-primary mb-2">
                          {heroArticle.subheading}
                        </p>
                        <p className="font-barlow text-xs text-text-secondary leading-relaxed line-clamp-4">
                          {heroArticle.content}
                        </p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between font-space-mono text-[9px] text-text-secondary">
                        <div className="flex items-center gap-4">
                          <span>By <strong>{heroArticle.author}</strong></span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {heroArticle.readTime}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSelectedArticleId(heroArticle.id)}
                          className="flex items-center gap-0.5 text-accent font-bold uppercase hover:underline"
                        >
                          Read Story <ArrowUpRight size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Right Column: News feed list */}
                <div className="flex flex-col gap-3">
                  <div className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1 border-b border-border/80">
                    Trending Analyses
                  </div>
                  {secondaryArticles.map((art) => (
                    <div 
                      key={art.id}
                      onClick={() => setSelectedArticleId(art.id)}
                      className="group p-4 rounded-xl border border-border bg-surface hover:border-accent hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between font-space-mono text-[8px] text-text-secondary uppercase mb-1">
                          <span className="font-extrabold text-accent">{art.category.replace("_", " ")}</span>
                          <span>{art.timestamp}</span>
                        </div>
                        <h3 className="font-anton text-[14px] uppercase text-text-primary group-hover:text-accent transition-colors leading-tight">
                          {art.title}
                        </h3>
                        <p className="mt-1 font-barlow text-[11px] text-text-secondary line-clamp-2">
                          {art.subheading}
                        </p>
                      </div>
                      
                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between font-space-mono text-[8.5px] text-text-secondary">
                        <span>{art.author}</span>
                        <span className="flex items-center gap-0.5 text-accent uppercase font-bold group-hover:underline">
                          Read <ChevronRight size={10} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== CRICBUZZ LAYOUT ==================== */}
            {layout === "cricbuzz" && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
                {/* Left Feed Column */}
                <div className="space-y-4">
                  {/* Top Match scorecards tickers */}
                  <div className="border border-border bg-surface rounded-xl overflow-hidden shadow-sm shrink-0">
                    <div className="bg-bg/40 px-4 py-2 border-b border-border flex items-center justify-between font-space-mono text-[9px] uppercase font-bold">
                      <span className="text-text-secondary">Matchday Tickers</span>
                      <span className="text-success flex items-center gap-1">
                        <span className="size-1 bg-success rounded-full animate-ping" /> Live Status
                      </span>
                    </div>
                    <div className="flex overflow-x-auto divide-x divide-border">
                      {standings.slice(0, 4).map((team, idx) => (
                        <div key={team.teamId} className="flex-1 min-w-[200px] p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-left">
                          <div className="flex items-center justify-between font-space-mono text-[8px] font-bold text-text-secondary uppercase mb-1">
                            <span>Season {currentSeason}</span>
                            <span>Rank #{idx + 1}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-barlow text-sm font-bold text-text-primary">{team.teamName || team.shortName}</span>
                            <span className="font-space-mono text-xs font-extrabold text-accent">{team.points} Pts</span>
                          </div>
                          <p className="mt-1 font-space-mono text-[8px] text-text-secondary uppercase">
                            W {team.won} · L {team.lost} · NRR {team.nrr >= 0 ? "+" : ""}{team.nrr.toFixed(3)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vertically streamed news entries */}
                  <div className="space-y-3">
                    {filteredArticles.map((art) => (
                      <div 
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className="group flex flex-col md:flex-row rounded-xl border border-border bg-surface overflow-hidden hover:border-accent cursor-pointer transition-all shadow-sm"
                      >
                        {/* Compact illustration left banner */}
                        <div className="w-full md:w-48 bg-black/5 dark:bg-white/5 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-space-mono text-[7px] font-bold text-accent uppercase">
                              {art.category.replace("_", " ")}
                            </span>
                          </div>
                          <div className="mt-4">
                            <span className="font-space-mono text-[8px] text-text-secondary font-bold uppercase tracking-wider block">Image Asset Prompt</span>
                            <p className="font-space-mono text-[6.5px] leading-tight text-text-secondary/80 line-clamp-3 mt-0.5 italic">
                              &ldquo;{art.imageMockupPrompt || "Illustration of a batsman hitting a boundary"}&rdquo;
                            </p>
                          </div>
                        </div>

                        {/* Article body */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between font-space-mono text-[8.5px] text-text-secondary uppercase mb-1">
                              <span>By {art.author}</span>
                              <span>{art.timestamp}</span>
                            </div>
                            <h3 className="font-anton text-[16px] uppercase leading-snug text-text-primary group-hover:text-accent transition-colors">
                              {art.title}
                            </h3>
                            <p className="mt-1.5 font-barlow text-xs text-text-secondary leading-relaxed line-clamp-3">
                              {art.subheading}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[9px] font-space-mono">
                            <span className="text-text-secondary flex items-center gap-1">
                              <BookOpen size={10} /> {art.readTime}
                            </span>
                            <span className="text-accent font-extrabold uppercase group-hover:underline">
                              Read Full Article →
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Editorial Sidebar */}
                <div className="space-y-4">
                  {/* Career movement card */}
                  <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-bg/40 border-b border-border flex items-center gap-2">
                      <TrendingUp size={13} className="text-accent" />
                      <h4 className="font-anton text-[13px] uppercase text-text-primary leading-none">Career Board</h4>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="rounded border border-border bg-bg/25 p-2 flex items-center justify-between">
                        <div>
                          <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Retirements Recorded</div>
                          <div className="font-anton text-base leading-none mt-1 text-text-primary">{displayedRetirements.length} Players</div>
                        </div>
                        <span className="rounded bg-accent/15 px-2 py-0.5 font-space-mono text-[8px] font-bold text-accent">Season {currentSeason}</span>
                      </div>

                      <div className="text-[10px] font-space-mono text-text-secondary uppercase px-1 pb-1 pt-1 border-b border-border/60 font-bold">
                        Top Retirees
                      </div>
                      {displayedRetirements.slice(0, 3).map((r) => (
                        <div key={r.playerId} className="p-1.5 rounded bg-bg/20 flex items-center justify-between border border-border/30">
                          <div className="min-w-0">
                            <div className="truncate font-barlow text-xs font-bold text-text-primary">{r.name}</div>
                            <div className="font-space-mono text-[7px] text-text-secondary uppercase mt-0.5">{r.role} · {r.age} yrs</div>
                          </div>
                          <span className="font-space-mono text-[9px] font-extrabold text-accent">Rtg {r.rating}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== NEWSLETTER GRID LAYOUT ==================== */}
            {layout === "newsletter" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredArticles.map((art) => (
                  <div 
                    key={art.id}
                    onClick={() => setSelectedArticleId(art.id)}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-surface hover:border-accent hover:shadow-md cursor-pointer transition-all overflow-hidden shadow-sm"
                  >
                    <div>
                      {/* Top mockup illust card header */}
                      <div className="p-4 bg-bg/30 border-b border-border flex flex-col justify-between h-24">
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-accent/10 border border-accent/25 px-2 py-0.5 font-space-mono text-[7.5px] font-bold text-accent uppercase">
                            {art.category.replace("_", " ")}
                          </span>
                          <span className="font-space-mono text-[7.5px] text-text-secondary">{art.timestamp}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 font-space-mono text-[6px] text-text-secondary italic">
                          <Clock size={8} /> <span>Prompt: &ldquo;{art.imageMockupPrompt || "Illustration"}&rdquo;</span>
                        </div>
                      </div>

                      {/* Text content */}
                      <div className="p-5">
                        <h3 className="font-anton text-[15px] uppercase leading-tight text-text-primary group-hover:text-accent transition-colors line-clamp-2">
                          {art.title}
                        </h3>
                        <p className="mt-2 font-barlow text-xs text-text-secondary leading-relaxed line-clamp-4">
                          {art.subheading}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/50 bg-bg/10 flex items-center justify-between font-space-mono text-[8.5px] text-text-secondary">
                      <div className="flex items-center gap-1">
                        <span className="size-1.5 bg-accent rounded-full" />
                        <span>By <strong>{art.author}</strong></span>
                      </div>
                      <span className="text-accent uppercase font-bold flex items-center gap-0.5 group-hover:underline">
                        Read Story <ChevronRight size={10} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Article Reading Modal Overlay */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border bg-bg/30 flex items-start justify-between">
              <div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-space-mono text-[8px] font-bold text-accent uppercase tracking-wider">
                  {selectedArticle.tag || CATEGORY_LABELS[selectedArticle.category]}
                </span>
                <span className="font-space-mono text-[9px] text-text-secondary ml-3">{selectedArticle.timestamp}</span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedArticleId(null)}
                className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                [ Close X ]
              </button>
            </div>

            {/* Scrollable content body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <h2 className="font-anton text-[22px] uppercase text-text-primary leading-tight">
                {selectedArticle.title}
              </h2>
              
              <p className="font-barlow text-sm font-bold text-text-secondary border-l-4 border-accent pl-3 italic">
                {selectedArticle.subheading}
              </p>

              <div className="font-barlow text-sm text-text-primary leading-relaxed space-y-3">
                <p>{selectedArticle.content}</p>
                <p>
                  As this season unfolds, the dynamic data will shape the headline. This panel serves as a modular stub designed for direct binding. You can add dynamic triggers to generate news logs based on player actions (like hundreds, five-wicket hauls, and career-high run chases) or franchise milestones.
                </p>
              </div>

              {/* Graphic Mockup Area */}
              <div className="mt-6 p-4 rounded-lg border border-border/80 bg-bg/40">
                <div className="flex items-center gap-1.5 font-space-mono text-[8px] font-bold text-accent uppercase tracking-wider">
                  <Zap size={10} /> Image Generation Metadata
                </div>
                <div className="mt-1 font-space-mono text-[9px] text-text-secondary leading-snug">
                  <strong>Suggested Asset Prompt:</strong> &ldquo;{selectedArticle.imageMockupPrompt}&rdquo;
                </div>
                <div className="mt-3 border-t border-border/60 pt-2 font-space-mono text-[8px] text-text-secondary">
                  <strong>Entity bindings:</strong>{" "}
                  {selectedArticle.associatedEntityIds?.playerId || selectedArticle.playerId || selectedArticle.associatedEntityIds?.teamId || selectedArticle.teamId
                    ? [selectedArticle.associatedEntityIds?.playerId || selectedArticle.playerId ? "player" : "", selectedArticle.associatedEntityIds?.teamId || selectedArticle.teamId ? "team" : ""].filter(Boolean).join(" + ")
                    : "none (editorial placeholder)"}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-bg/20 flex items-center justify-between font-space-mono text-[9px] text-text-secondary">
              <span>Author: <strong>{selectedArticle.author}</strong></span>
              <span className="flex items-center gap-1"><Clock size={10} /> {selectedArticle.readTime}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
