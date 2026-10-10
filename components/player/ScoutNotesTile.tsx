import { useEffect, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import { classifyBowlingUsage } from "@/lib/logic/playerBowlingUsage";

type Note = { score: number; title: string; stats: string[]; wording?: NoteWording };

type NoteTopic = "batting" | "bowling" | "temperament" | "fielding";
type NoteWording = { topic: NoteTopic; clauses: [string, string, string, string, string] };

// Five cricket-specific phrasings and four sentence openings give each note 20 stable variations.
const noteWording: Record<string, NoteWording> = {
  "Can take a game away in the powerplay": { topic: "batting", clauses: ["can seize a match in the powerplay", "can put an attack under pressure from the first over", "can race away before the field spreads", "can make the opening six overs decisive", "can take control against the new ball"] },
  "Looks to set the tempo early": { topic: "batting", clauses: ["looks to set the tempo early", "tries to put the new ball under pressure", "brings early intent to an innings", "looks for scoring chances from the outset", "aims to give the innings a quick start"] },
  "Can turn a chase in a single over": { topic: "batting", clauses: ["can turn a chase in one over", "can swing a target with a late burst", "can take the closing overs away from an attack", "has the hitting to change a chase quickly", "can make a required rate disappear late"] },
  "Looks for boundaries late": { topic: "batting", clauses: ["looks for boundaries in the closing overs", "raises his scoring intent at the death", "backs himself to find the rope late", "becomes more forceful as an innings closes", "targets the boundary when time is short"] },
  "Offers something in both disciplines": { topic: "bowling", clauses: ["contributes with both bat and ball", "gives his side a genuine second skill", "can affect a match in either discipline", "offers useful work beyond his primary skill", "brings value on both sides of an innings"] },
  "Can change a match with bat or ball": { topic: "bowling", clauses: ["can change a match with bat or ball", "has match-winning ability in both disciplines", "can take control with either of his skills", "offers two ways to turn a game", "can produce a decisive contribution in either role"] },
  "Still developing the weaker discipline": { topic: "bowling", clauses: ["is still developing his weaker discipline", "has room to grow in one half of his game", "is working towards a more rounded game", "has one discipline still catching up with the other", "is still building his second skill"] },
  "Can finish strongly after opening": { topic: "batting", clauses: ["can finish strongly if he bats through to the death", "keeps his scoring threat into the closing overs", "can accelerate late after laying a foundation", "offers a strong finish when he carries his bat deep", "can take advantage of the death overs after opening"] },
  "Can make an impact early": { topic: "batting", clauses: ["can make an impact earlier in the innings when needed", "has the game to score before the closing overs", "can put the new ball under pressure when asked", "offers more than a late-innings hitting role", "can get an innings moving from the outset"] },
  "Can add runs outside his usual phase": { topic: "batting", clauses: ["can make an impact outside his usual batting phase", "has the skill to score in another part of the innings", "offers a useful option beyond his usual batting position", "can adapt his batting when the innings demands it", "can contribute in a second phase of the innings"] },
  "Can contribute runs down the order": { topic: "batting", clauses: ["can contribute useful runs down the order", "offers useful batting depth", "can add runs from a lower-order position", "brings some batting value beyond his bowling", "can support a late-innings push with the bat"] },
  "Can contribute with the bat": { topic: "batting", clauses: ["is a genuine batting option as well as a bowler", "can make a substantial contribution with the bat", "gives the lower order real batting strength", "offers more than occasional runs from a bowling position", "can change an innings with the bat"] },
  "Can bowl beyond his main phase": { topic: "bowling", clauses: ["can also be trusted in another phase of the innings", "offers a strong option outside his main bowling phase", "can adapt his bowling to another part of the innings", "has the skill to cover a second bowling phase", "is useful beyond his preferred bowling phase"] },
  "Reliable with the bat": { topic: "batting", clauses: ["produces steady batting contributions", "tends to repeat good innings", "gives his side dependable runs", "has a reliable pattern to his batting", "can be trusted to deliver with the bat"] },
  "Sets the standard with the bat": { topic: "batting", clauses: ["sets a high standard with the bat", "repeats high-quality batting displays", "makes consistency a strength at the crease", "delivers strong innings with regularity", "gives his side a dependable batting benchmark"] },
  "Batting output can vary": { topic: "batting", clauses: ["can be uneven from innings to innings", "does not always repeat his better batting displays", "has room to make his batting more consistent", "can follow a strong innings with a quieter one", "is still looking for steadier batting returns"] },
  "Comfortable against pace": { topic: "batting", clauses: ["handles pace comfortably", "looks settled against quicker bowling", "finds scoring options against seam", "plays pace with confidence", "is comfortable when the quicks attack"] },
  "Takes pace in stride": { topic: "batting", clauses: ["takes pace in stride", "makes quick bowling a favourable matchup", "stays in control against the quicks", "deals confidently with high pace", "can dictate terms against seam"] },
  "Pace can test their scoring": { topic: "batting", clauses: ["can find pace a harder scoring matchup", "has room to improve against quick bowling", "can be checked by a strong pace attack", "does not always score freely against seam", "can be made to work for runs by the quicks"] },
  "Comfortable against spin": { topic: "batting", clauses: ["handles spin comfortably", "reads slower bowling well", "finds scoring options against spin", "looks settled when the spinners bowl", "can keep the scoreboard moving against spin"] },
  "Makes spin a favourable matchup": { topic: "batting", clauses: ["makes spin a favourable matchup", "can dictate terms against slower bowling", "reads spin early and scores freely", "puts spinners under sustained pressure", "is particularly assured against spin"] },
  "Spin can slow their scoring": { topic: "batting", clauses: ["can be slowed by spin", "has room to score more freely against slower bowling", "can find spin a difficult scoring matchup", "does not always keep the rate moving against spin", "can be tied down by a disciplined spinner"] },
  "Reliable with the ball": { topic: "bowling", clauses: ["delivers dependable spells", "can repeat good bowling performances", "offers steady work with the ball", "usually gives his side a reliable spell", "keeps his bowling output consistent"] },
  "Rarely lets a spell drift": { topic: "bowling", clauses: ["rarely lets a spell drift", "holds his standards across spells", "maintains control from over to over", "repeats high-quality bowling spells", "seldom loses his rhythm with the ball"] },
  "Bowling spells can fluctuate": { topic: "bowling", clauses: ["can vary from spell to spell", "is still seeking more repeatable bowling", "can lose his rhythm during a spell", "has room for greater consistency with the ball", "does not always follow a strong spell with another"] },
  "Composed under pressure": { topic: "temperament", clauses: ["stays composed under pressure", "keeps his decisions clear in tight moments", "holds his nerve when a game tightens", "remains settled in demanding situations", "responds calmly when the stakes rise"] },
  "Thrives when the game tightens": { topic: "temperament", clauses: ["thrives when a game tightens", "raises his level in pressure moments", "looks at home with the match on the line", "finds his best work in tense passages", "embraces the hardest moments of a game"] },
  "Tight moments can test them": { topic: "temperament", clauses: ["can be tested when a game tightens", "is still building his response to pressure", "can find tense moments difficult", "has room to settle his game under pressure", "does not always show his best in tight situations"] },
  "Raises their game for big occasions": { topic: "temperament", clauses: ["raises his game for big occasions", "tends to respond well on larger stages", "finds another level in important matches", "brings strong performances to major fixtures", "shows up when the occasion grows"] },
  "Often saves their best for the biggest stage": { topic: "temperament", clauses: ["often saves his best for the biggest stage", "relishes the biggest fixtures", "can be decisive in major matches", "makes important games feel like his stage", "repeatedly delivers when the stakes are highest"] },
  "Still finding their mark in big matches": { topic: "temperament", clauses: ["is still finding his mark in major matches", "has room to impose himself on big occasions", "does not always bring his best to major fixtures", "is still building a record in important games", "can find the bigger stage a test"] },
  "Sharp in the field": { topic: "fielding", clauses: ["is sharp in the field", "adds value through alert fielding", "moves well and stays switched on in the field", "can save his side runs in the field", "brings energy to his fielding"] },
  "Can change a match in the field": { topic: "fielding", clauses: ["can change a match in the field", "can produce a decisive fielding moment", "turns fielding into a genuine weapon", "can save runs and create chances in the field", "offers exceptional value as a fielder"] },
  "Fielding remains an area to improve": { topic: "fielding", clauses: ["has room to improve his fielding", "can give away value in the field", "is still working towards cleaner fielding", "does not yet make fielding a strength", "can be tested by demanding fielding chances"] },
  "Assured behind the stumps": { topic: "fielding", clauses: ["looks assured behind the stumps", "offers dependable work with the gloves", "is steady when keeping wicket", "handles his keeping duties confidently", "brings reliable glovework to the side"] },
  "Sets the standard behind the stumps": { topic: "fielding", clauses: ["sets a high standard behind the stumps", "can change a game with his glovework", "offers outstanding work with the gloves", "makes wicketkeeping a major strength", "is exceptional behind the stumps"] },
  "Keeping remains a work in progress": { topic: "fielding", clauses: ["is still refining his glovework", "has room to grow behind the stumps", "can be tested by difficult keeping chances", "is still developing as a wicketkeeper", "does not yet make keeping a clear strength"] },
  "Generally steady with the bat": { topic: "batting", clauses: ["usually gives a steady account of himself with the bat", "shows a useful level of batting consistency", "tends to keep his batting output fairly steady", "can generally repeat his batting approach", "brings reasonable consistency to his innings"] },
  "Batting consistency is around average": { topic: "batting", clauses: ["has a fairly typical level of batting consistency", "shows neither an unusually steady nor volatile batting pattern", "has an even-handed batting consistency profile", "is broadly average for batting repeatability", "does not stand out for either consistency or volatility with the bat"] },
  "Handles pace reasonably well": { topic: "batting", clauses: ["handles pace reasonably well", "shows a modest advantage against quick bowling", "is generally comfortable enough against seam", "can keep scoring against the quicks", "has a useful response to pace"] },
  "Pace is a neutral matchup": { topic: "batting", clauses: ["has no marked advantage or weakness against pace", "is broadly neutral against quick bowling", "shows a fairly even matchup with seam", "is neither especially helped nor hindered by pace", "has a balanced profile against the quicks"] },
  "Handles spin reasonably well": { topic: "batting", clauses: ["handles spin reasonably well", "shows a modest advantage against slower bowling", "is generally comfortable enough against spin", "can keep scoring when the spinners bowl", "has a useful response to spin"] },
  "Spin is a neutral matchup": { topic: "batting", clauses: ["has no marked advantage or weakness against spin", "is broadly neutral against slower bowling", "shows a fairly even matchup with spin", "is neither especially helped nor hindered by spin", "has a balanced profile against the spinners"] },
  "Generally steady with the ball": { topic: "bowling", clauses: ["usually gives a steady account of himself with the ball", "shows a useful level of bowling consistency", "tends to keep his spells fairly steady", "can generally repeat his bowling approach", "brings reasonable consistency to his spells"] },
  "Bowling consistency is around average": { topic: "bowling", clauses: ["has a fairly typical level of bowling consistency", "shows neither unusually steady nor volatile spells", "has an even-handed bowling consistency profile", "is broadly average for bowling repeatability", "does not stand out for either consistency or volatility with the ball"] },
  "Handles pressure reasonably well": { topic: "temperament", clauses: ["handles pressure reasonably well", "tends to hold his shape when the game tightens", "shows a useful response to tense moments", "can keep his game together under pressure", "is generally composed when the stakes rise"] },
  "Pressure response is around average": { topic: "temperament", clauses: ["has a broadly neutral response to pressure", "shows no marked pressure strength or weakness", "is fairly typical in tense situations", "has an even-handed pressure profile", "does not stand out either way when a game tightens"] },
  "Handles big occasions well": { topic: "temperament", clauses: ["handles big occasions well", "shows a modest lift in important matches", "can respond positively on a larger stage", "is generally comfortable in major fixtures", "brings a useful big-match temperament"] },
  "Big-match response is around average": { topic: "temperament", clauses: ["has a broadly neutral big-match profile", "shows no marked change on the bigger stage", "is fairly typical in major fixtures", "does not stand out either way in big matches", "has an even-handed response to important games"] },
  "Offers steady work in the field": { topic: "fielding", clauses: ["offers steady work in the field", "can be counted on for sound fielding", "brings a useful standard to his fielding", "usually handles his fielding duties well", "adds steady value as a fielder"] },
  "Fielding is around average": { topic: "fielding", clauses: ["has a broadly average fielding profile", "offers a typical standard in the field", "does not stand out either way as a fielder", "is fairly steady without making fielding a strength", "has an even-handed fielding profile"] },
  "Keeps wicket capably": { topic: "fielding", clauses: ["keeps wicket capably", "offers competent work with the gloves", "can handle regular keeping duties", "brings a sound basic standard behind the stumps", "is reasonably steady when keeping wicket"] },
};

function stableIndex(value: string, size: number): number {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % size;
}

function noteParagraph(player: Player, notes: Note[]): Array<{ topic: NoteTopic; text: string }> {
  const topics: NoteTopic[] = ["batting", "bowling", "temperament", "fielding"];
  const openings = ["He", "From a scouting view, he", "His game shows that he", "On the field, he"];
  return topics.flatMap((topic) => {
    const related = notes.filter((note) => (note.wording ?? noteWording[note.title])?.topic === topic);
    if (related.length === 0) return [];
    const opening = openings[stableIndex(`${player.id}:${topic}`, openings.length)];
    const clauses = related.map((note) => {
      const wording = note.wording ?? noteWording[note.title];
      return wording.clauses[stableIndex(`${player.id}:${note.title}`, wording.clauses.length)];
    });
    return [{ topic, text: `${opening} ${clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses.at(-1)}`}.` }];
  });
}

function FittedImpression({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const paragraph = textRef.current;
    const measure = measureRef.current;
    if (!container || !paragraph || !measure) return;
    const fit = () => {
      paragraph.style.fontSize = "26px";
      const availableWidth = Math.max(1, container.clientWidth - 4);
      const availableHeight = Math.max(1, container.clientHeight - 4);
      const ratio = Math.min(1, availableWidth / Math.max(1, measure.getBoundingClientRect().width), availableHeight / Math.max(1, paragraph.scrollHeight));
      paragraph.style.fontSize = `${26 * ratio}px`;
      let attempts = 0;
      while (attempts < 12 && (measure.getBoundingClientRect().width > availableWidth || paragraph.scrollHeight > availableHeight)) {
        paragraph.style.fontSize = `${parseFloat(paragraph.style.fontSize) * 0.98}px`;
        attempts++;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    let active = true;
    document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [text]);

  return <div ref={containerRef} className="flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
    <p ref={textRef} className="w-full whitespace-nowrap text-center font-space-mono font-bold uppercase leading-[1.15] text-accent"><span ref={measureRef}>{text}</span></p>
  </div>;
}

type Phase = "powerplay" | "middle" | "death";
type BattingPath = "opening" | "middle" | "finishing";

function dominantPhase(values: [number | undefined, number | undefined, number | undefined]): Phase | null {
  const rated = values.map((value, index) => ({ value, index })).filter((entry): entry is { value: number; index: number } => entry.value != null);
  if (rated.length < 2) return null;
  rated.sort((a, b) => b.value - a.value);
  if (rated[0].value < 75 || rated[0].value - rated[1].value < 5) return null;
  return (["powerplay", "middle", "death"] as const)[rated[0].index];
}

function impression(player: Player): string {
  const batting = player.currentBatting ?? 0;
  const bowling = player.currentBowling ?? 0;
  const aggression = player.battingAggression ?? player.aggression ?? 50;
  const battingConsistency = player.battingConsistency ?? player.stamina ?? 0;
  const bowlingConsistency = player.bowlingConsistency ?? player.consistency ?? 0;
  const battingPhase = dominantPhase([player.powerplayBatting, player.middleOversBatting, player.deathBatting]);
  const bowlingPhase = dominantPhase([player.powerplayBowling, player.middleOversBowling, player.deathBowling]);
  const usage = player.bowlingUsage ?? classifyBowlingUsage(player);
  const genuineBowler = usage === "frontline" || usage === "regular";
  const pace = player.bowlingStyle === "Pacer" || player.role === "Pace Bowler";
  const spinner = player.bowlingStyle === "Spinner" || player.role === "Spin Bowler";
  const opening = player.isOpener || player.onlyOpensOrBenched;
  const finishing = player.isFinisher === true && player.isCoreBatter !== true;
  const hasBattingPosition = opening || finishing || player.hasBattedAt3 || player.hasBattedAt4 || player.hasBattedAt5 || player.hasBattedAt6 || player.hasBattedAt7;
  const path: BattingPath = opening ? "opening" : finishing ? "finishing" : "middle";
  const battingSkillPhase = path === "opening" ? player.powerplayBatting : path === "finishing" ? player.deathBatting : player.middleOversBatting;
  const powerBatting = aggression >= 90 && (battingSkillPhase ?? 0) >= 85;
  const attacking = aggression >= 70;
  const twoWay = player.role === "All-Rounder" && genuineBowler && batting >= 65 && bowling >= 65;
  const legendaryTwoWay = twoWay && batting >= 93 && bowling >= 93;
  const superstarTwoWay = twoWay && batting >= 85 && bowling >= 85;

  // A combined headline needs a real batting position, regular bowling use and a verified phase.
  if (twoWay && hasBattingPosition && bowlingPhase && (pace || spinner)) {
    const bowlingPhaseRating = bowlingPhase === "powerplay" ? player.powerplayBowling! : bowlingPhase === "middle" ? player.middleOversBowling! : player.deathBowling!;
    const bowlingIdentity = pace
      ? bowlingPhase === "powerplay" ? "New-Ball Pacer" : bowlingPhase === "middle" ? "Middle-Overs Seamer" : "Death-Overs Pacer"
      : bowlingPhase === "powerplay" ? "Powerplay Spinner" : bowlingPhase === "middle" ? "Middle-Overs Spinner" : "Death-Overs Spinner";
    const battingIdentity = path === "opening"
      ? powerBatting ? "Power Opener" : attacking ? "Attacking Opener" : "Opening Anchor"
      : path === "finishing"
        ? powerBatting ? "Power Finisher" : attacking ? "Aggressive Finisher" : "Calculated Finisher"
        : powerBatting ? "Middle-Order Hitter" : attacking ? "Middle-Order Attacker" : "Middle-Order Anchor";
    if (legendaryTwoWay) return `Legendary ${bowlingIdentity} and ${battingIdentity}`;
    if (superstarTwoWay) {
      if (pace && bowlingPhase === "powerplay" && path === "finishing" && powerBatting) return "Superstar New-Ball Pacer and Power Finisher";
      return `Superstar ${bowlingIdentity} and ${battingIdentity}`;
    }
    if (usage === "frontline" && bowling >= 80 && bowlingPhaseRating >= 85) {
      const leader = bowlingPhase === "powerplay" ? "Opening-Spell Spearhead" : bowlingPhase === "middle" ? "Middle-Overs Attack Leader" : "Death-Overs Closer";
      return `${leader} and ${battingIdentity}`;
    }
    if (batting >= 80 && (battingSkillPhase ?? 0) >= 85) return `${battingIdentity} and ${bowlingIdentity}`;
    return `${bowlingIdentity} and ${battingIdentity}`;
  }
  if (player.role === "All-Rounder") {
    const weaker = Math.min(batting, bowling);
    const battingIdentity = path === "opening" ? powerBatting ? "Power Opener" : attacking ? "Attacking Opener" : "Opening Anchor"
      : path === "finishing" ? powerBatting ? "Power Finisher" : attacking ? "Aggressive Finisher" : "Calculated Finisher"
      : powerBatting ? "Middle-Order Hitter" : attacking ? "Middle-Order Attacker" : "Middle-Order Anchor";
    const bowlingIdentity = pace ? "Pace-Bowling" : spinner ? "Spin-Bowling" : "Two-Way";
    if (genuineBowler && weaker >= 65) {
      if (legendaryTwoWay) return `Legendary ${bowlingIdentity} ${battingIdentity}`;
      if (superstarTwoWay) return `Superstar ${bowlingIdentity} ${battingIdentity}`;
      if (weaker >= 80) return `Complete ${bowlingIdentity} ${battingIdentity}`;
      return `${bowlingIdentity} ${battingIdentity} All-Rounder`;
    }
    if (batting > bowling + 10 || !genuineBowler) {
      const level = batting >= 93 ? "Legendary" : batting >= 90 ? "Superstar" : batting >= 80 ? "Leading" : "Developing";
      return genuineBowler ? `${level} ${battingIdentity} with the Ball` : `${level} ${battingIdentity}`;
    }
    const level = bowling >= 93 ? "Legendary" : bowling >= 90 ? "Superstar" : bowling >= 80 ? "Leading" : "Developing";
    return `${level} ${pace ? "Pace" : "Spin"}-Bowling All-Rounder`;
  }
  if (player.role === "Pace Bowler" || player.role === "Spin Bowler") {
    const phaseRatings = [player.powerplayBowling, player.middleOversBowling, player.deathBowling];
    const allPhase = phaseRatings.every((rating) => rating != null && rating >= 75);
    const assessedAcrossPhases = phaseRatings.every((rating) => rating != null);
    if (bowling >= 93) return bowlingPhase === "powerplay" ? pace ? "Legendary New-Ball Strike Pacer" : "Legendary Powerplay Spin Threat" : bowlingPhase === "middle" ? pace ? "Legendary Middle-Overs Seam Leader" : "Legendary Middle-Overs Spin Strangler" : bowlingPhase === "death" ? pace ? "Legendary Death-Overs Pace Closer" : "Legendary Death-Overs Spin Ace" : allPhase ? pace ? "Legendary All-Phase Pacer" : "Legendary All-Phase Spinner" : assessedAcrossPhases ? pace ? "Legendary Across-the-Innings Pacer" : "Legendary Across-the-Innings Spinner" : pace ? "Legendary Pace Attack Leader" : "Legendary Spin Attack Leader";
    if (bowling >= 90) return bowlingPhase === "powerplay" ? pace ? "Superstar Opening-Spell Pacer" : "Superstar Powerplay Spinner" : bowlingPhase === "middle" ? pace ? "Superstar Middle-Overs Seam Threat" : "Superstar Middle-Overs Spinner" : bowlingPhase === "death" ? pace ? "Superstar Death-Overs Pacer" : "Superstar Death-Overs Spinner" : allPhase ? pace ? "Superstar All-Phase Seamer" : "Superstar All-Phase Spinner" : assessedAcrossPhases ? pace ? "Superstar Across-the-Innings Seamer" : "Superstar Across-the-Innings Spinner" : pace ? "Superstar Pace Attack Leader" : "Superstar Spin Attack Leader";
    if (bowlingPhase === "powerplay") return bowling >= 85 ? pace ? "New-Ball Pace Spearhead" : "Powerplay Spin Specialist" : pace ? "Opening-Spell Seamer" : "New-Ball Spinner";
    if (bowlingPhase === "middle") return bowling >= 85 && bowlingConsistency >= 75 ? pace ? "Middle-Overs Pace Strangler" : "Middle-Overs Spin Stranglehold" : pace ? "Middle-Overs Pace Controller" : "Middle-Overs Spin Controller";
    if (bowlingPhase === "death") return bowling >= 85 && bowlingConsistency >= 75 ? pace ? "Death-Overs Pace Ace" : "Death-Overs Spin Specialist" : pace ? "Death-Overs Seamer" : "Death-Overs Spinner";
    if (bowling >= 85 && allPhase) return pace ? "All-Phase Pace Mainstay" : "All-Phase Spin Mainstay";
    return bowling >= 70 ? assessedAcrossPhases ? pace ? "Across-the-Innings Seamer" : "Across-the-Innings Spinner" : pace ? "Pace Attack Option" : "Spin Attack Option" : pace ? "Utility Seamer" : "Utility Spinner";
  }
  if (batting >= 93 || batting >= 90) {
    const level = batting >= 93 ? "Legendary" : "Superstar";
    if (path === "opening") return powerBatting ? `${level} Powerplay Destroyer` : attacking ? `${level} Attacking Opener` : `${level} New-Ball Anchor`;
    if (path === "finishing") return powerBatting ? `${level} Last-Over Destroyer` : attacking ? `${level} Boundary-Hunting Finisher` : `${level} Chase Anchor`;
    return powerBatting ? `${level} Middle-Overs Enforcer` : attacking ? `${level} Counterattacking Batter` : `${level} Innings Anchor`;
  }
  if (path === "opening") return powerBatting && batting >= 85 ? "Explosive Powerplay Opener" : attacking && (player.powerplayBatting ?? 0) >= 75 ? "Powerplay Tempo-Setter" : attacking ? "Aggressive Opener" : aggression < 55 && battingConsistency >= 65 ? "New-Ball Negotiator" : "Positive Opener";
  if (path === "finishing") return powerBatting && batting >= 85 ? "Last-Over Destroyer" : attacking && (player.deathBatting ?? 0) >= 75 ? "Boundary-Hunting Finisher" : attacking ? "Attacking Finisher" : aggression < 55 ? "Late-Innings Stabiliser" : "Calculated Finisher";
  if (powerBatting && batting >= 85) return "Middle-Overs Enforcer";
  if (attacking && player.spinRating != null && player.spinRating >= 85 && battingPhase === "middle") return "Spin-Hunting Middle-Order Batter";
  if (attacking) return "Counterattacking Middle-Order Batter";
  return aggression < 55 && battingConsistency >= 65 ? "Innings Anchor" : "Tempo-Building Middle-Order Batter";
}

function additionalNotes(player: Player): Note[] {
  const bats = player.role === "Batsman" || player.role === "WK-Batsman" || player.role === "All-Rounder";
  const bowls = player.role === "Pace Bowler" || player.role === "Spin Bowler" || player.role === "All-Rounder";
  const aggression = player.battingAggression ?? player.aggression ?? 50;
  const opening = player.isOpener || player.onlyOpensOrBenched;
  const finishing = player.isFinisher === true && player.isCoreBatter !== true && !opening;
  const notes: Note[] = [];
  const add = (score: number | undefined, statLabel: string, bands: Array<[number, string]>) => {
    if (score == null) return;
    notes.push({ score, title: bands.find(([minimum]) => score >= minimum)?.[1] ?? bands[bands.length - 1][1], stats: [`${statLabel}: ${score}`] });
  };
  if (bats && opening && aggression >= 70) {
    notes.push({ score: aggression, title: aggression >= 90 && (player.powerplayBatting ?? 0) >= 75 ? "Can take a game away in the powerplay" : "Looks to set the tempo early", stats: [`Batting aggression: ${aggression}`, `Powerplay batting: ${player.powerplayBatting ?? "unrated"}`] });
  }
  if (bats && finishing && aggression >= 70 && (player.deathBatting ?? 0) >= 70) {
    notes.push({ score: Math.max(aggression, player.deathBatting ?? 0), title: aggression >= 90 && (player.deathBatting ?? 0) >= 85 ? "Can turn a chase in a single over" : "Looks for boundaries late", stats: [`Batting aggression: ${aggression}`, `Death batting: ${player.deathBatting ?? "unrated"}`] });
  }
  if (player.role === "All-Rounder") {
    const score = Math.min(player.currentBatting ?? 0, player.currentBowling ?? 0);
    notes.push({ score, title: score >= 80 ? "Can change a match with bat or ball" : score >= 65 ? "Offers something in both disciplines" : "Still developing the weaker discipline", stats: [`Current batting: ${player.currentBatting}`, `Current bowling: ${player.currentBowling}`] });
  }
  // A strong rating away from the usual batting position is worth calling out separately.
  if (bats && opening && (player.deathBatting ?? 0) >= 78) {
    notes.push({ score: player.deathBatting! + 8, title: "Can finish strongly after opening", stats: [`Death batting: ${player.deathBatting}`, "Usual position: opener"] });
  } else if (bats && finishing && (player.powerplayBatting ?? 0) >= 78) {
    notes.push({ score: player.powerplayBatting! + 8, title: "Can make an impact early", stats: [`Powerplay batting: ${player.powerplayBatting}`, "Usual position: finisher"] });
  } else if (bats && !opening && !finishing) {
    const secondaryPhase = Math.max(player.powerplayBatting ?? 0, player.deathBatting ?? 0);
    if (secondaryPhase >= 82 && secondaryPhase >= (player.middleOversBatting ?? 0)) {
      notes.push({ score: secondaryPhase + 5, title: "Can add runs outside his usual phase", stats: [`Powerplay batting: ${player.powerplayBatting ?? "unrated"}`, `Middle-overs batting: ${player.middleOversBatting ?? "unrated"}`, `Death batting: ${player.deathBatting ?? "unrated"}`] });
    }
  }
  if (player.role === "Batsman" && player.bowlingStyle && (player.currentBowling ?? 0) >= 55) {
    const usage = player.bowlingUsage ?? classifyBowlingUsage(player);
    if (usage !== "does_not_bowl") {
      const style = player.bowlingStyle === "Pacer"
        ? player.paceSpeedBand === "medium" ? "medium pace" : "seam bowling"
        : player.spinStyle ? ({ off_spin: "off-spin", leg_spin: "leg-spin", left_arm_orthodox: "left-arm spin", left_arm_wrist_spin: "left-arm wrist-spin", mystery_spin: "mystery spin" } as const)[player.spinStyle] : "spin";
      const handy = player.currentBowling >= 65;
      const description = handy ? `handy ${style}` : `some useful ${style}`;
      notes.push({
        score: player.currentBowling + 16,
        title: handy ? `Offers handy ${style}` : `Offers occasional ${style}`,
        stats: [`Current bowling: ${player.currentBowling}`, `Bowling usage: ${usage}`, `Bowling style: ${style}`],
        wording: { topic: "bowling", clauses: [`can offer ${description}`, `can turn to ${style} when needed`, `can give his side overs of ${style}`, `adds a bowling option alongside his batting with ${style}`, `can contribute with ${style} when needed`] },
      });
    }
  }
  if ((player.role === "Pace Bowler" || player.role === "Spin Bowler") && (player.currentBatting ?? 0) >= 60) {
    notes.push({ score: player.currentBatting + 12, title: player.currentBatting >= 78 ? "Can contribute with the bat" : "Can contribute runs down the order", stats: [`Current batting: ${player.currentBatting}`, `Role: ${player.role}`] });
  }
  if (bowls) {
    const primary = dominantPhase([player.powerplayBowling, player.middleOversBowling, player.deathBowling]);
    const phases = [
      { name: "powerplay", rating: player.powerplayBowling },
      { name: "middle overs", rating: player.middleOversBowling },
      { name: "death overs", rating: player.deathBowling },
    ];
    const secondary = phases.filter((phase) => phase.name !== (primary === "middle" ? "middle overs" : primary === "death" ? "death overs" : "powerplay") && (phase.rating ?? 0) >= 78).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (primary && secondary) {
      notes.push({ score: secondary.rating! + 6, title: "Can bowl beyond his main phase", stats: [`Main phase: ${primary}`, `${secondary.name}: ${secondary.rating}`], wording: { topic: "bowling", clauses: [`can also bowl effectively in the ${secondary.name}`, `offers a strong option in the ${secondary.name} too`, `can be trusted with overs in the ${secondary.name}`, `has the skill to cover the ${secondary.name}`, `brings value in the ${secondary.name} beyond his main role`] } });
    }
  }
  if (bats) {
    add(player.battingConsistency ?? player.stamina, player.battingConsistency != null ? "Batting consistency" : "Stamina", [[85, "Sets the standard with the bat"], [70, "Reliable with the bat"], [56, "Generally steady with the bat"], [45, "Batting consistency is around average"], [0, "Batting output can vary"]]);
    add(player.paceRating, "Pace matchup", [[85, "Takes pace in stride"], [70, "Comfortable against pace"], [56, "Handles pace reasonably well"], [45, "Pace is a neutral matchup"], [0, "Pace can test their scoring"]]);
    add(player.spinRating, "Spin matchup", [[85, "Makes spin a favourable matchup"], [70, "Comfortable against spin"], [56, "Handles spin reasonably well"], [45, "Spin is a neutral matchup"], [0, "Spin can slow their scoring"]]);
  }
  if (bowls) add(player.bowlingConsistency ?? player.consistency, player.bowlingConsistency != null ? "Bowling consistency" : "Consistency", [[85, "Rarely lets a spell drift"], [70, "Reliable with the ball"], [56, "Generally steady with the ball"], [45, "Bowling consistency is around average"], [0, "Bowling spells can fluctuate"]]);
  add(player.pressureRating, "Pressure", [[85, "Thrives when the game tightens"], [70, "Composed under pressure"], [56, "Handles pressure reasonably well"], [45, "Pressure response is around average"], [0, "Tight moments can test them"]]);
  add(player.bigMatchRating, "Big match rating", [[85, "Often saves their best for the biggest stage"], [70, "Raises their game for big occasions"], [56, "Handles big occasions well"], [45, "Big-match response is around average"], [0, "Still finding their mark in big matches"]]);
  add(player.fieldingRating, "Fielding", [[85, "Can change a match in the field"], [75, "Sharp in the field"], [65, "Offers steady work in the field"], [50, "Fielding is around average"], [0, "Fielding remains an area to improve"]]);
  if (player.role === "WK-Batsman") add(player.wicketkeepingRating, "Wicketkeeping", [[85, "Sets the standard behind the stumps"], [75, "Assured behind the stumps"], [60, "Keeps wicket capably"], [0, "Keeping remains a work in progress"]]);
  return notes.sort((a, b) => b.score - a.score).slice(0, 5);
}

function phaseBand(value: number | undefined): number {
  if (value == null) return 0;
  return value >= 72 ? 3 : value >= 50 ? 2 : 1;
}

function PhaseRow({ title, values }: { title: string; values: Array<{ label: string; score?: number }> }) {
  if (values.every(({ score }) => score == null)) return null;
  return <div>
    <div className="mb-1 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">{title}</div>
    <div className="grid grid-cols-3 gap-1.5">
      {values.map(({ label, score }) => <div key={label} className="rounded border border-border/70 bg-bg/70 px-1.5 py-1.5 text-center">
        <div className="font-space-mono text-[8px] font-bold uppercase text-text-primary">{label}</div>
        <div className="mt-1.5 flex justify-center gap-0.5" aria-label={`${label}: ${score == null ? "unassessed" : phaseBand(score) === 3 ? "strong" : phaseBand(score) === 2 ? "steady" : "limited"}`}>
          {[1, 2, 3].map((step) => <span key={step} className={`h-1.5 w-3 rounded-sm ${step <= phaseBand(score) ? "bg-accent" : "bg-border"}`} />)}
        </div>
      </div>)}
    </div>
  </div>;
}

export function ScoutNotesTile({ player }: { player: Player }) {
  const noteAreaRef = useRef<HTMLDivElement>(null);
  const noteTextRef = useRef<HTMLParagraphElement>(null);
  const [noteFontSize, setNoteFontSize] = useState(13);
  const bats = player.role === "Batsman" || player.role === "WK-Batsman" || player.role === "All-Rounder";
  const bowls = player.role === "Pace Bowler" || player.role === "Spin Bowler" || player.role === "All-Rounder";
  const battingPhases = [player.powerplayBatting, player.middleOversBatting, player.deathBatting];
  const bowlingPhases = [player.powerplayBowling, player.middleOversBowling, player.deathBowling];
  const headline = impression(player);
  const notes = additionalNotes(player);
  const sentences = noteParagraph(player, notes);
  const paragraphText = sentences.map((sentence) => sentence.text).join(" ");
  useEffect(() => {
    const area = noteAreaRef.current;
    const paragraph = noteTextRef.current;
    if (!area || !paragraph) return;
    const fit = () => {
      if (area.clientHeight < 32 || area.clientWidth < 32) return;
      paragraph.style.fontSize = "13px";
      let size = 13;
      while (size > 11.5 && paragraph.scrollHeight > area.clientHeight + 1) {
        size = Math.max(11.5, Math.round((size - 0.1) * 10) / 10);
        paragraph.style.fontSize = `${size}px`;
      }
      setNoteFontSize(size);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [paragraphText]);

  return <section className="flex h-[458px] w-full flex-col self-start overflow-hidden rounded border border-border bg-gradient-to-b from-bg to-accent/5 p-3" aria-label="Scout notes">
    <div className="mb-3 shrink-0 border-b border-border pb-2">
      <div className="font-space-mono text-[10px] font-bold uppercase text-text-primary">Scout Notes</div>
      <div className="mt-0.5 font-space-mono text-[8px] uppercase tracking-wider text-text-secondary">On-field impression</div>
    </div>
    <div className="h-[78px] shrink-0 rounded border-l-2 border-accent bg-accent/10 px-2.5 py-2.5">
      <FittedImpression text={headline} />
    </div>
    <div className="mt-2 shrink-0 space-y-1 border-t border-border pt-1.5">
      <div className="font-space-mono text-[8px] uppercase tracking-wider text-text-secondary">Where they make an impact</div>
      {bats && <PhaseRow title="Batting phases" values={[
        { label: "Powerplay", score: battingPhases[0] }, { label: "Middle", score: battingPhases[1] }, { label: "Death", score: battingPhases[2] },
      ]} />}
      {bowls && <PhaseRow title="Bowling phases" values={[
        { label: "Powerplay", score: bowlingPhases[0] }, { label: "Middle", score: bowlingPhases[1] }, { label: "Death", score: bowlingPhases[2] },
      ]} />}
    </div>
    <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-border pt-1.5">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-1">
        <div className="font-space-mono text-[8px] uppercase tracking-wider text-text-secondary">Additional notes</div>
      </div>
      <div ref={noteAreaRef} className="min-h-0 flex-1 overflow-hidden">
      {notes.length > 0
        ? <p ref={noteTextRef} className="font-space-mono font-bold leading-[1.2] text-text-primary" style={{ fontSize: noteFontSize }}>{sentences.map((sentence) => <span key={sentence.topic}>{sentence.text} </span>)}</p>
        : <p className="font-space-mono text-[9px] leading-snug text-text-secondary">No pronounced secondary tendency stands out.</p>}
      </div>
    </div>
  </section>;
}
