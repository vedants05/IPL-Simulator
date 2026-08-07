# Graph Report - .  (2026-08-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1444 nodes · 3738 edges · 66 communities (61 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d942f8c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- careerLifecycle.ts
- auctionEngine.ts
- Team
- Player
- gameStore.ts
- careerEmails.ts
- tradeEngine.ts
- overview/page.tsx
- pitchCreator.ts
- aiLineupSelector.ts
- stadiumManagement.ts
- auction/page.tsx
- matchSimulation.ts
- [teamId]/page.tsx
- miniAuctionRetention.ts
- teamTactics.ts
- pitchCurator.ts
- compilerOptions
- leagueSchedule.ts
- TacticsLineupBuilder.tsx
- auctionRules.ts
- OverviewPageContent
- SocialMediaPage.tsx
- fetchPlayers.ts
- LeagueRecords.tsx
- simulateInnings
- useGameStore
- seasonAwards.ts
- iplCareerStats.ts
- devDependencies
- NavBar.tsx
- socialComments.ts
- minorRecordTracker.ts
- buildFeed
- dependencies
- ScheduleTileContent.tsx
- lineupPlanner.ts
- TeamThemeProvider.tsx
- index.ts
- clamp
- fetchTeams.ts
- TournamentStatsDashboard.tsx
- careerCalendar.ts
- scripts
- app/layout.tsx
- aiLeadership.ts
- chooseBowler
- socialCommentPolicy.ts
- simulateInstantMatch
- createPlayerLuck
- clubHistory.ts
- socialMediaTeamComments.ts
- gameStateStorage.ts
- AcceleratedPlanning.tsx
- activateStandardBatFirstImpact
- retentions/page.tsx
- socialMediaOpinions.ts
- chooseDismissal
- package.json
- AttributeBar.tsx
- StarRating.tsx
- next.config.mjs
- postcss.config.mjs
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `OverviewPageContent()` - 89 edges
2. `Player` - 68 edges
3. `useGameStore` - 57 edges
4. `Team` - 51 edges
5. `simulateInnings()` - 47 edges
6. `buildFeed()` - 33 edges
7. `getHomeStadium()` - 28 edges
8. `TeamProfilePage()` - 25 edges
9. `computeTeamValuation()` - 25 edges
10. `ratingOf()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --indirect_call--> `team()`  [INFERRED]
  app/api/retentions/route.ts → lib/data/leagueHistory.ts
- `OverviewPageContent()` --indirect_call--> `playerToLineupCandidate()`  [INFERRED]
  app/game/overview/page.tsx → lib/logic/automaticLineupBuilder.ts
- `TeamProfilePage()` --indirect_call--> `isRainAffectedMatch()`  [INFERRED]
  app/game/teams/[teamId]/page.tsx → lib/logic/matchWeather.ts
- `Props` --references--> `Player`  [EXTRACTED]
  components/auction/PlayerCard.tsx → lib/types/index.ts
- `CareerRecordCandidate` --references--> `Player`  [EXTRACTED]
  components/history/LeagueRecords.tsx → lib/types/index.ts

## Import Cycles
- None detected.

## Communities (66 total, 5 thin omitted)

### Community 0 - "careerLifecycle.ts"
Cohesion: 0.05
Nodes (85): generateRegenName(), poolForCountry(), REGEN_NAME_DATABASE, RegenNamePool, allRounderBlend(), applyAuctionMarketRatings(), AuctionMarketRoleProfile, AuctionMetric (+77 more)

### Community 1 - "auctionEngine.ts"
Cohesion: 0.08
Nodes (77): CATEGORIES, crore(), PlayerListPopup(), PlayerRow(), PopupType, TARGET_PRIORITIES, AIBidRejectionReason, _aiBidRejections (+69 more)

### Community 2 - "Team"
Cohesion: 0.06
Nodes (46): getInitials(), HALL_FILTERS, HallFilter, LeagueHallOfFame(), LeagueHallOfFameProps, normalizeName(), BallByBallSummary(), deliveryTone() (+38 more)

### Community 3 - "Player"
Cohesion: 0.06
Nodes (54): categoryClass(), displayDate(), HubMode, HubView, InjuryHubPage(), riskLabel(), CLUB_FIGURES, ClubFigureDefinition (+46 more)

### Community 4 - "gameStore.ts"
Cohesion: 0.07
Nodes (47): NewsPageProps, TradeHubPageProps, InjuryHubPageProps, ClubFigureTier, ClubFigureTierOverrides, HISTORICAL_LEAGUE_HISTORY, LeagueHistoryHonour, LeagueHistorySeason (+39 more)

### Community 5 - "careerEmails.ts"
Cohesion: 0.07
Nodes (53): CaptaincyPage(), CaptaincyPageProps, captaincyTier(), appointCaptain(), appointViceCaptain(), CAPTAIN_CHANGE_COOLDOWN_GAMES, CaptaincyInterestStatus, confirmCaptainChange() (+45 more)

### Community 6 - "tradeEngine.ts"
Cohesion: 0.10
Nodes (41): PlayerProfileModal(), PlayerProfileModalProps, ProfileModalMatch, retiredSnapshotPlayer(), displayPlayerName(), money(), TradeHubPage(), roundDownToLegalBid() (+33 more)

### Community 7 - "overview/page.tsx"
Cohesion: 0.06
Nodes (35): CaptaincyPage, ClubProfileSummaryTile(), getPlayerRating(), InjuryHubPage, InningsScorecard, LeagueHallOfFame, LeagueRecords, LeagueStandings (+27 more)

### Community 8 - "pitchCreator.ts"
Cohesion: 0.10
Nodes (36): daysRemaining(), formatDate(), METRIC_LABELS, PitchCuratorPage(), PitchCuratorPageProps, PREFERENCE_LABELS, SLIDER_CONFIG, BoundaryDimensions (+28 more)

### Community 9 - "aiLineupSelector.ts"
Cohesion: 0.20
Nodes (37): LineupColumn(), additiveSelectionScore(), AiLineupMode, AiMatchLineups, applyBowlingFirstImpactFinisherRule(), buildPlan(), canPlayerBatAtPosition(), currentAbility() (+29 more)

### Community 10 - "stadiumManagement.ts"
Cohesion: 0.11
Nodes (32): formatCapacity(), formatDate(), StadiumManagementPage(), StadiumManagementPageProps, ExpectedScoreRange, IplTeamId, applyGroundScoringImpact(), BoundaryPreset (+24 more)

### Community 11 - "auction/page.tsx"
Cohesion: 0.11
Nodes (26): AuctionComplete(), playerRating(), PopupTab, ROLE_GROUPS, selectPotentialLineup(), TeamSquadCard(), RetentionPhase(), BidHistory() (+18 more)

### Community 12 - "matchSimulation.ts"
Cohesion: 0.06
Nodes (33): BattingScorecardEntry, BowlingScorecardEntry, CORE_BATTER_ROTATION_MULTIPLIER, createWeatherScenario(), DEFAULT_CHASING_SCORING_BONUS, DEFAULT_RAIN_PROFILE, DeliveryExtras, DeliveryFieldingEvent (+25 more)

### Community 13 - "[teamId]/page.tsx"
Cohesion: 0.09
Nodes (28): AiLineupModule, ClubSquadSortDirection, ClubSquadSortKey, ClubSquadView, EMPTY_CAREER, MatchScorecardModal, normalizeTeamProfileCareer(), PlayerProfileModal (+20 more)

### Community 14 - "miniAuctionRetention.ts"
Cohesion: 0.13
Nodes (30): MiniRetentionPhase(), abilityAdjustment(), ageAdjustment(), battingPerformanceAdjustment(), bowlingPerformanceAdjustment(), calculateMiniAuctionKeptSalary(), clamp(), consecutiveTeamSeasons() (+22 more)

### Community 15 - "teamTactics.ts"
Cohesion: 0.08
Nodes (28): choiceGroups, ChoiceOption, STRATEGY_DESCRIPTIONS, TeamTacticsPage(), TeamTacticsPageProps, InningsContext, MatchTeamPlans, applyTeamTacticsPreset() (+20 more)

### Community 16 - "pitchCurator.ts"
Cohesion: 0.11
Nodes (29): AdditionalHomePitchIds, createDefaultHomeBoundaryDimensions(), createDefaultHomePitchSelections(), getCuratorPitch(), getDefaultCuratorPitch(), getHomeStadium(), getStadiumBoundaryLimits(), HOME_STADIUM_BY_TEAM (+21 more)

### Community 17 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next-build-check/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, scripts (+19 more)

### Community 18 - "leagueSchedule.ts"
Cohesion: 0.14
Nodes (25): addDaysToDateKey(), localDateToDateKey(), arrangementScore(), arrangeStages(), buildBalancedStages(), buildOddGroupRounds(), canPlayOnDay(), createSeededRandom() (+17 more)

### Community 19 - "TacticsLineupBuilder.tsx"
Cohesion: 0.14
Nodes (21): DraggedPlayer, DragPreview, DragSource, keeperLabel(), playerRating(), roleLabel(), TacticsLineupBuilder(), TacticsLineupBuilderProps (+13 more)

### Community 20 - "auctionRules.ts"
Cohesion: 0.17
Nodes (21): MegaRetentionPhase(), ROLE_ORDER, getAuctionRating(), buildAuctionSets(), calculateTotalRetentionCost(), CAPPED_RETENTION_COSTS, getCappedRetentionSlabsForCount(), getPlayerRetentionCost() (+13 more)

### Community 21 - "OverviewPageContent"
Cohesion: 0.13
Nodes (22): fixturesForCareerHistory(), generateNextRetentionDeadline(), getArchivedPartnershipContribution(), getCompactPlayerRole(), isIncomingImpactPlayer(), isOutgoingImpactPlayer(), normalizeLeagueHistoryPlayerName(), OverviewPageContent() (+14 more)

### Community 22 - "SocialMediaPage.tsx"
Cohesion: 0.12
Nodes (18): auditedPerformanceSentiment(), displayGameDate(), fanAccountName(), fanNamePrefixes, fanNameSuffixes, hashtagSafe(), navIcon(), NEGATIVE_PERFORMANCE_TEMPLATE_IDS (+10 more)

### Community 23 - "fetchPlayers.ts"
Cohesion: 0.13
Nodes (17): dynamic, GET(), calculateBasePrice(), withAdaptiveBasePrices(), DummyWebSocket, mockSupabase, supabase, bowlStyle() (+9 more)

### Community 24 - "LeagueRecords.tsx"
Cohesion: 0.18
Nodes (18): CareerRecordCandidate, integer(), LeagueRecords(), LeagueRecordsProps, MajorRecordColumn, normalizeName(), ResolvedRecordEntry, BATTING_AVERAGE_MINIMUM_MATCHES (+10 more)

### Community 25 - "simulateInnings"
Cohesion: 0.11
Nodes (21): battingIntent(), bowlerRespectIntentAdjustment(), chooseSituationalField(), deathExtrasPressure(), deliveryResultCode(), dismissalText(), dotBallPressureAdjustment(), emptyExtras() (+13 more)

### Community 26 - "useGameStore"
Cohesion: 0.16
Nodes (13): AuctionPage(), AuctionSetNav(), BidPanel(), crore(), crore(), SoldLog(), ActiveBenchmarkState, BenchmarkHoverInfo (+5 more)

### Community 27 - "seasonAwards.ts"
Cohesion: 0.18
Nodes (18): calculateSeasonAwardLeaders(), AwardSeasonStats, BASE_WICKET_MVP_POINTS, calculateBattingPerformanceBonus(), calculateBowlingPerformanceBonus(), calculateMvpPoints(), calculateSeasonWicketBonus(), calculateWicketPerformancePoints() (+10 more)

### Community 28 - "iplCareerStats.ts"
Cohesion: 0.23
Nodes (16): applyContribution(), applyMatchToIplCareerStats(), applyMatchToT20CareerStats(), applyT20Contribution(), collectMatchContributions(), emptyContribution(), historicalBattingBalls(), historicalBowlingRuns() (+8 more)

### Community 29 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, postcss, tailwindcss, tsx, @types/node, @types/react, @types/react-dom, @types/ws (+11 more)

### Community 30 - "NavBar.tsx"
Cohesion: 0.16
Nodes (12): AuctionGuidedTour(), getLogicalViewport(), Rect, STEPS, TourStep, NAV_ITEMS, NavBar(), SupabasePlayerSync() (+4 more)

### Community 31 - "socialComments.ts"
Cohesion: 0.14
Nodes (13): FanPost, EligibilityRule, LOSING_CAUSE_PHASES, losingCauseComments, losingCauseText, matchesEligibility(), SOCIAL_COMMENTS, SocialCommentTemplate (+5 more)

### Community 32 - "minorRecordTracker.ts"
Cohesion: 0.15
Nodes (13): labels, MinorRecordsProps, LEAGUE_HISTORY_TEAMS, MINOR_RECORDS, MinorRecord, InningsScorecard, Match, MatchPartnership (+5 more)

### Community 33 - "buildFeed"
Cohesion: 0.12
Nodes (17): battingAverage(), buildFeed(), decisiveWinningDelivery(), derivePhase(), economy(), finalBallWinningFact(), formatAuctionPrice(), inningsEconomy() (+9 more)

### Community 34 - "dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, next, dependencies, lucide-react, next, react-dom, recharts, @supabase/supabase-js (+9 more)

### Community 35 - "ScheduleTileContent.tsx"
Cohesion: 0.16
Nodes (14): ChampionTileContent(), isRainAffected(), Match, MatchScorecard, PlayoffDiagramContent(), PlayoffFixturesContent(), ScheduleTileContent(), ScheduleTileContentProps (+6 more)

### Community 36 - "lineupPlanner.ts"
Cohesion: 0.27
Nodes (14): buildRecommendedImpactSubs(), buildRecommendedLineups(), canAddToLineup(), isBowlingOption(), isOverseas(), LineupValidation, MatchSelection, MIN_BOWLING_OPTION_RATING (+6 more)

### Community 37 - "TeamThemeProvider.tsx"
Cohesion: 0.23
Nodes (11): crore(), SkipSetSummaryModal(), crore(), SoldAnimation(), applyTeamTheme(), hexToRgb(), switchColorMode(), TeamThemeProvider() (+3 more)

### Community 38 - "index.ts"
Cohesion: 0.12
Nodes (16): processBid(), AuctionPhase, AuctionState, BattingStats, BattingStyle, BidEntry, BowlingStats, CareerStats (+8 more)

### Community 39 - "clamp"
Cohesion: 0.17
Nodes (15): activateBowlFirstImpact(), BattingAggressionScoringProfile, capSeasonalFormAverages(), clamp(), dismissalCompletionProbability(), estimateTeamWinProbability(), getSeasonalPlayerForm(), inferredFieldingRating() (+7 more)

### Community 40 - "fetchTeams.ts"
Cohesion: 0.24
Nodes (10): dynamic, GET(), GET(), SetupPage(), getHomeStadiumName(), fetchPlayersFromSupabase(), fetchTeamsFromSupabase(), STATIC_TEAMS (+2 more)

### Community 41 - "TournamentStatsDashboard.tsx"
Cohesion: 0.19
Nodes (12): AwardBoard, AwardColumn(), AwardRow, MatchPerformance, PerformanceList(), teamShortName(), TournamentPlayerStat, TournamentStatsDashboard() (+4 more)

### Community 42 - "careerCalendar.ts"
Cohesion: 0.16
Nodes (13): CareerCalendarFixture, CareerCalendarStep, DAY_SIMULATION_INTERVAL_MS, daysBetweenDateKeys(), FAST_DAY_SIMULATION_INTERVAL_MS, getCareerCalendarStep(), getCareerFastForwardStep(), getDaySimulationIntervalMs() (+5 more)

### Community 43 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, calibrate:career, calibrate:seasons, dev, lint, start, test:career-clock (+5 more)

### Community 44 - "app/layout.tsx"
Cohesion: 0.20
Nodes (9): anton, barlow, barlowCondensed, metadata, spaceMono, DEFAULT_METRICS, measureViewport(), ViewportMetrics (+1 more)

### Community 45 - "aiLeadership.ts"
Cohesion: 0.31
Nodes (10): AiCaptainReason, AiTeamLeadership, AiViceCaptainReason, appointAiLeagueLeadership(), appointAiTeamLeadership(), hasConsecutiveFranchiseSeasons(), isFranchiseSuccessor(), leadershipRanking() (+2 more)

### Community 46 - "chooseBowler"
Cohesion: 0.29
Nodes (10): battingPitchAdjustment(), bowlingPitchAdjustment(), bowlingTacticalAdjustment(), canCompleteBowlingRotation(), chooseBowler(), getMatchPreparationWarnings(), hasPreference(), isBattingAllRounder() (+2 more)

### Community 47 - "socialCommentPolicy.ts"
Cohesion: 0.20
Nodes (9): commentRequiresStatEvidence(), formatPerformanceFooter(), hasUnsupportedContextClaim(), hasUnsupportedNumericClaim(), hasUnverifiableDeliveryClaim(), isFinalBallWinningClaim(), passesPerformanceEvidence(), performanceScope() (+1 more)

### Community 48 - "simulateInstantMatch"
Cohesion: 0.25
Nodes (9): calculateDLSRevisedTarget(), chooseTossDecision(), createActiveTeamState(), derivePlayerFormAdjustments(), dlsResourcePercentage(), playerOfTheMatch(), resultText(), simulateInstantMatch() (+1 more)

### Community 49 - "createPlayerLuck"
Cohesion: 0.22
Nodes (6): createPlayerLuck(), hashSeed(), isNightMatch(), nightDewScoringBonus(), seededGaussian(), SimulationRandom

### Community 50 - "clubHistory.ts"
Cohesion: 0.29
Nodes (7): CLUB_HISTORY, ClubHistoryDefinition, clubNameForSeason(), ClubSeasonHistoryEntry, ClubSeasonOutcome, getClubSeasonHistory(), LAST_HISTORICAL_CLUB_SEASON

### Community 51 - "socialMediaTeamComments.ts"
Cohesion: 0.32
Nodes (7): getTeamHistoryCategoryCounts(), getTriggeredTeamSocialComments(), historyCategory(), TEAM_CATEGORY_ADDITIONS, TEAM_REFERENCES, TeamCommentEvent, TeamHistoryCategory

### Community 52 - "gameStateStorage.ts"
Cohesion: 0.36
Nodes (5): deleteIndexedValue(), gameStateStorage, openDatabase(), readIndexedValue(), writeIndexedValue()

### Community 53 - "AcceleratedPlanning.tsx"
Cohesion: 0.67
Nodes (6): AcceleratedNominationsScreen(), AcceleratedPlanningResultsScreen(), crore(), getPlayerMaxRating(), getRatingBadgeStyles(), renderPlayerRating()

### Community 54 - "activateStandardBatFirstImpact"
Cohesion: 0.29
Nodes (7): activateCollapseImpact(), activateStandardBatFirstImpact(), isBowlingOption(), isLegalImpactSwap(), isOverseas(), selectCollapseImpactOutgoingPlayer(), teamPlayingStrength()

### Community 55 - "retentions/page.tsx"
Cohesion: 0.40
Nodes (3): TEAM_COLORS, TeamRetention, Valuation

### Community 56 - "socialMediaOpinions.ts"
Cohesion: 0.40
Nodes (3): SOCIAL_OPINION_TEMPLATES, SocialOpinionTemplate, SocialOpinionTrigger

### Community 57 - "chooseDismissal"
Cohesion: 0.50
Nodes (4): chooseDismissal(), groundRunningPressure(), sampleBatRuns(), selectFielder()

### Community 58 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

## Knowledge Gaps
- **346 isolated node(s):** `dynamic`, `dynamic`, `PopupTab`, `ROLE_GROUPS`, `LeagueHallOfFame` (+341 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Player` connect `Player` to `careerLifecycle.ts`, `auctionEngine.ts`, `Team`, `gameStore.ts`, `careerEmails.ts`, `tradeEngine.ts`, `overview/page.tsx`, `aiLineupSelector.ts`, `auction/page.tsx`, `matchSimulation.ts`, `[teamId]/page.tsx`, `miniAuctionRetention.ts`, `teamTactics.ts`, `pitchCurator.ts`, `TacticsLineupBuilder.tsx`, `auctionRules.ts`, `SocialMediaPage.tsx`, `fetchPlayers.ts`, `LeagueRecords.tsx`, `useGameStore`, `seasonAwards.ts`, `iplCareerStats.ts`, `socialComments.ts`, `ScheduleTileContent.tsx`, `index.ts`, `aiLeadership.ts`, `AcceleratedPlanning.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `PlayoffDiagramContent()` connect `ScheduleTileContent.tsx` to `Team`, `overview/page.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `react` connect `ScheduleTileContent.tsx` to `dependencies`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `dynamic`, `dynamic`, `PopupTab` to the rest of the system?**
  _346 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `careerLifecycle.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05396825396825397 - nodes in this community are weakly interconnected._
- **Should `auctionEngine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07932098765432098 - nodes in this community are weakly interconnected._
- **Should `Team` be split into smaller, more focused modules?**
  _Cohesion score 0.05868118572292801 - nodes in this community are weakly interconnected._