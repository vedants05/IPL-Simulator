# Phase Ratings Performance Plan

## Purpose

The six phase ratings describe how effectively a player applies their existing
batting or bowling ability in a specific part of an innings:

- `powerplayBatting`, `middleOversBatting`, `deathBatting`
- `powerplayBowling`, `middleOversBowling`, `deathBowling`

This system must make specialists visibly different without turning phase
ratings into a second overall-ability score. `currentBatting` and
`currentBowling` remain the foundation of every delivery. Phase ratings shape
the distribution of likely outcomes in the relevant overs.

This document is an implementation and calibration plan only. None of these
performance modifiers should be considered active until the statistical gates
at the end pass.

## Rating meaning

All phase ratings use a `0..100` scale with `50` as the exact neutral baseline.

| Rating | Intended meaning |
|---:|---|
| 0-19 | Severe phase weakness |
| 20-39 | Clear weakness |
| 40-49 | Slight weakness |
| 50 | Exactly neutral |
| 51-60 | Slight strength |
| 61-79 | Clear specialist strength |
| 80-94 | Elite phase specialist |
| 95-100 | Exceptional/extreme |

Missing, invalid, or non-finite values resolve to `50`, preserving old saves.
Values outside the supported range are clamped to `0..100`.

Normalise a selected rating as follows:

```text
signal(rating) = clamp((rating - 50) / 50, -1, 1)
```

Examples:

| Rating | Signal |
|---:|---:|
| 0 | -1.00 |
| 20 | -0.60 |
| 40 | -0.20 |
| 50 | 0.00 |
| 60 | +0.20 |
| 70 | +0.40 |
| 80 | +0.60 |
| 100 | +1.00 |

## Phase boundaries

Use the simulator's existing `inningsPhaseThresholds()` as the single source of
truth.

For a 20-over innings:

- Powerplay: overs 1-6
- Middle: overs 7-15
- Death: overs 16-20

For shortened matches, retain the existing proportional thresholds. Do not
hard-code 6 and 16 in the phase-rating helpers.

For example, a 10-over innings uses powerplay overs 1-3, middle overs 4-7 and
death overs 8-10 under the current threshold calculation.

## The matchup model

On each delivery, select the striker's batting rating and the bowler's bowling
rating for the current phase. Calculate:

```text
battingSignal = signal(selected batting phase rating)
bowlingSignal = signal(selected bowling phase rating)
phaseEdge = clamp(battingSignal - bowlingSignal, -2, 2)
```

Interpretation:

- Positive edge: phase matchup favours the batter.
- Zero edge: neither player has a phase advantage.
- Negative edge: phase matchup favours the bowler.

This is deliberately a contest, not two unrelated bonuses. A 70 phase batter
against a 70 phase bowler produces a zero phase edge. Their overall abilities,
form, consistency, pitch suitability, tactics, pressure and fatigue still
determine the underlying delivery quality.

## Performance effects by phase

Apply phase effects to the existing outcome weights and probabilities. Do not
add the phase value directly to `battingRating` or `bowlingRating`.

The coefficients below are version-one calibration targets. Each multiplier is
clamped to its stated safety range before use.

### Powerplay performance

Powerplay batting measures exploitation of field restrictions and control
against the new ball. Powerplay bowling measures early movement, accuracy,
boundary prevention and wicket threat.

Apply:

```text
fourWeightMultiplier   = clamp(1 + 0.09 * phaseEdge, 0.82, 1.18)
sixWeightMultiplier    = clamp(1 + 0.07 * phaseEdge, 0.86, 1.14)
dotWeightMultiplier    = clamp(1 - 0.055 * phaseEdge, 0.89, 1.11)
wicketMultiplier       = clamp(1 - 0.075 * phaseEdge, 0.85, 1.15)
```

A positive batting edge creates more converted boundaries, fewer dots and a
lower chance of losing an early wicket. A negative edge does the reverse.

The four multiplier is stronger than the six multiplier because exploiting the
circle should primarily create conventional boundaries rather than turn every
powerplay specialist into a six-hitter.

### Middle-overs performance

Middle-overs batting measures strike rotation, manipulation of spread fields
and control against spin or pace-off bowling. Middle-overs bowling measures
control, dot-ball pressure and the ability to break partnerships.

Apply:

```text
singleWeightMultiplier = clamp(1 + 0.06 * phaseEdge, 0.88, 1.12)
twoWeightMultiplier    = clamp(1 + 0.05 * phaseEdge, 0.90, 1.10)
dotWeightMultiplier    = clamp(1 - 0.07 * phaseEdge, 0.86, 1.14)
fourWeightMultiplier   = clamp(1 + 0.035 * phaseEdge, 0.93, 1.07)
sixWeightMultiplier    = clamp(1 + 0.025 * phaseEdge, 0.95, 1.05)
wicketMultiplier       = clamp(1 - 0.06 * phaseEdge, 0.88, 1.12)
```

The identity of this rating is rotation and pressure management. Its boundary
effect must remain smaller than the powerplay and death effects.

### Death-overs performance

Death batting measures boundary execution and control while attacking. Death
bowling measures yorker/variation execution, boundary suppression and accuracy
under maximum pressure.

Apply:

```text
fourWeightMultiplier   = clamp(1 + 0.075 * phaseEdge, 0.85, 1.15)
sixWeightMultiplier    = clamp(1 + 0.10 * phaseEdge, 0.80, 1.20)
singleWeightMultiplier = clamp(1 - 0.025 * phaseEdge, 0.95, 1.05)
dotWeightMultiplier    = clamp(1 - 0.06 * phaseEdge, 0.88, 1.12)
wicketMultiplier       = clamp(1 - 0.035 * phaseEdge, 0.93, 1.07)
```

The six multiplier is strongest because death specialists distinguish
themselves through boundary conversion. The wicket coefficient stays modest:
the existing aggression and required-rate systems already create death-over
dismissal risk.

The small inverse single modifier moves successful high-edge attacks toward
boundaries rather than granting runs through every outcome channel.

## Bowling accuracy and extras

Death-over extras are an execution property of the bowler, so they should use
the bowler's individual phase signal rather than the batter-versus-bowler edge.

After `deathExtrasPressure()` calculates the existing pressure increase, apply:

```text
widePressureMultiplier  = clamp(1 - 0.10 * bowlingSignal, 0.90, 1.10)
noBallPressureMultiplier = clamp(1 - 0.08 * bowlingSignal, 0.92, 1.08)
```

Only multiply the pressure-derived portion, not the simulator's universal base
wide/no-ball probability. A great death bowler remains capable of an occasional
extra; the phase rating only improves execution under pressure.

Do not apply these extras modifiers in the powerplay or middle overs in version
one. Expand later only if calibration demonstrates a meaningful need.

## Worked examples

### Finisher rated 70 against neutral death bowling

```text
battingSignal = (70 - 50) / 50 = +0.40
bowlingSignal = 0
phaseEdge = +0.40
```

Before normalization of the complete run distribution:

- Four weight: `+3.0%`
- Six weight: `+4.0%`
- Single weight: `-1.0%`
- Dot weight: `-2.4%`
- Wicket probability: `-1.4%`

This is a useful but controlled advantage. It is not a `+20` overall batting
bonus and does not guarantee a successful finish.

### Finisher rated 70 against a death bowler rated 70

Both signals are `+0.40`, so the phase edge is zero. No run or wicket modifier
is applied. The bowler still receives their personal pressure-extras benefit.

### Finisher rated 70 against weak death bowling rated 30

The batter signal is `+0.40`, the bowler signal is `-0.40`, and the edge is
`+0.80`:

- Four weight: `+6.0%`
- Six weight: `+8.0%`
- Dot weight: `-4.8%`
- Wicket probability: `-2.8%`

This should be visibly favourable across many innings while remaining uncertain
in any single over.

### Weak finisher rated 30 against elite death bowling rated 90

The phase edge is `-1.20`:

- Four weight: `-9.0%`
- Six weight: `-12.0%`
- Dot weight: `+7.2%`
- Wicket probability: `+4.2%`

Overall ability and aggression still matter, but this is a clearly poor phase
matchup.

## Relationship with existing attributes

### Overall ability

Overall batting/bowling determines the base contest. Phase ratings reshape a
small part of the outcome distribution. A 70-overall player with a 90 phase
rating should specialize, not become equivalent to a 90-overall player.

### Aggression

Aggression controls intent: how often a batter pursues attacking outcomes and
accepts risk. Phase batting controls execution: how effectively those attempts
are converted in the current phase.

High aggression plus low death batting should remain volatile and wasteful.
High aggression plus high death batting should produce a genuine finisher.

### Consistency

Consistency controls match-level and delivery-level variance around ability.
Phase strength controls the expected outcome distribution for the current
matchup. A low-consistency elite finisher should have a high ceiling but still
produce erratic innings.

### Tactics and playable controls

Apply phase modifiers after tactical intent has shaped the base outcome weights
but before final weight normalization and sampling. Tactics decide the chosen
approach; phase ratings affect execution of that approach.

### Pitch, weather, form and fatigue

Keep these systems independent. Phase ratings must not bypass their existing
adjustments or their safety clamps.

## Bowler selection and over allocation

Phase bowling ratings must affect whether a player is actually used in their
best phase.

Inside `chooseBowler()`, calculate the selected bowling signal and add:

```text
phaseSelectionBonus = bowlingSignal * 6
```

This gives a bounded `-6..+6` selection score. It is strong enough to separate
otherwise similar bowlers but smaller than a major gap in current bowling.

Update death-over reservation as follows:

1. Rank candidates using current bowling, death signal, pitch fit and tactical
   compatibility.
2. Identify the best two qualified death options as a reserve group, but reserve
   only **three overs of combined remaining capacity** for that group. Do not
   assign all five death overs in advance and do not require a fixed split
   between the two bowlers.
3. Before the death, penalise a selection only when using that bowler would take
   the group's combined remaining capacity below the active reserve floor.
4. Preserve all existing maximum-over, no-consecutive-over, cooldown and
   rotation-feasibility checks.
5. Never reserve a part-timer solely because of a high phase value; require the
   existing minimum bowling-option qualification.
6. Recalculate the reserve group and remaining capacity before every over so
   impact substitutions, prior usage and match state are respected.
7. Let captaincy decision noise affect which suitable bowler is chosen, not
   whether legal completion of the innings is possible.

### Rolling quota and early release

The three-over combined reserve is a planned quota, not a lock that suddenly
disappears at a run-rate threshold. Give each established/high-rated bowler a
rolling schedule for their remaining overs. If the chase is projected to finish
before one of those scheduled overs occurs, bring that endangered over forward.
Do not release every reserved over at once.

Track recent and innings-wide scoring and estimate the ball on which the target
will be reached:

```text
recentRate = runs from last 12 legal balls / available recent legal balls
inningsRate = chase runs / legal balls bowled
projectedRate = 0.65 * recentRate + 0.35 * inningsRate
projectedBallsToTarget = runsRemaining / max(projectedRate, minimumRate)
projectedFinishBall = legalBallsBowled + projectedBallsToTarget
```

For each established bowler, retain:

```text
remainingOverQuota
plannedOverSlots
nextLegalOver
```

An over becomes endangered when its planned start ball is at or beyond the
projected finish ball. Move the earliest endangered over to the current over if
the bowler is legal, otherwise to their next legal over. Rebuild the remaining
schedule around that change.

Use a continuous urgency score rather than abrupt reserve levels:

```text
oversTooLate = (plannedStartBall - projectedFinishBall) / 6
useItOrLoseItBonus = clamp(oversTooLate * 8, 0, 24)
```

The bonus grows as the planned over moves further beyond the projected end of
the chase. A marginal forecast can move the bowler to the next legal over; a
target projected to be completed several overs early makes selection immediate.
The normal phase-selection, pitch and tactical scores still decide close calls.

Early release applies only to an established/high-rated defensive option:

```text
currentBowling >= 75
or the player is one of the attack's top two bowlers by currentBowling
```

The bowler must also be legal for the over and have remaining quota. A high death
rating alone does not qualify a weak bowler for emergency use.

Using the over early consumes one over from that bowler's ordinary quota; it
does not grant an additional over. The remaining combined death reserve falls
naturally from three to two only because one planned over has now been used.

Recalculate after every completed over. If the established bowler slows the
chase, later quota can remain in its original death slots. If the projected
finish still precedes another planned slot, bring the next endangered over
forward. This produces a gradual response to the match rather than switching
from full reservation to no reservation.

Example: Bowler A is scheduled for overs 17 and 19, but the chase is projected
to finish in over 16. Their over 17 is already endangered, so A is considered
for the next legal over. After A bowls, project the chase again. Over 19 is moved
forward only if it is still expected to arrive too late.

When there is no target, keep the normal three-over combined reserve. Recent
punishment may increase an established bowler's ordinary current-over selection
score, but it should not erase their complete remaining death quota because
there is no projected target-completion deadline.

Phase batting ratings should not automatically reorder the batting lineup in
version one. Batting position and impact-sub logic can consume them in a later,
separately calibrated feature.

## Code integration points

Implement pure helpers in `lib/logic/matchSimulation.ts` or a dedicated
`lib/logic/phaseRatings.ts` module:

1. `normalizePhaseRating(value)`
2. `getInningsPhase(overNumber, maxOvers)`
3. `getPlayerPhaseRating(player, discipline, phase)`
4. `getPhaseMatchup(batter, bowler, overNumber, maxOvers)`
5. `getPhaseOutcomeModifiers(matchup)`

Integrate them at these existing stages:

- `sampleBatRuns()`: dot, single, two, four and six weights.
- `simulateInnings()`: final wicket probability before the wicket roll.
- `deathExtrasPressure()`: pressure-derived wide and no-ball increases.
- `chooseBowler()`: phase fit and death-over reservation.

Pass a prepared modifier object into `sampleBatRuns()` rather than repeatedly
looking up player fields inside the sampling function.

Increment `MATCH_SIMULATION_VERSION` when outcome integration lands.

## Randomness and save compatibility

- Do not introduce new random draws for phase ratings.
- Modify existing deterministic weights and probabilities only.
- Identical seed and identical player data must remain reproducible.
- Old saves need no migration because missing ratings resolve to 50.
- Persist the raw six ratings exactly as loaded; never persist derived signals.

## Test plan

### Pure unit tests

- Ratings 0, 50 and 100 normalize to -1, 0 and +1.
- Missing/invalid values normalize to zero signal.
- Standard and shortened-match boundaries select the correct field.
- 50 batting versus 50 bowling returns exact `1.0` multipliers.
- 70 versus 70 returns neutral matchup modifiers.
- Positive edges monotonically favour batting; negative edges favour bowling.
- Every modifier remains inside its declared clamp.
- Death extras use bowling signal, not matchup edge.

### Outcome-weight tests

- Powerplay strength primarily changes fours and early wickets.
- Middle strength primarily changes dots, singles and twos.
- Death strength primarily changes fours and sixes.
- Applying modifiers never creates negative or non-finite weights.
- Free-hit dismissal restrictions remain unchanged.
- Existing aggression modifiers remain monotonic after phase modifiers.

### Bowler-selection tests

- Similar bowlers are separated by the relevant phase rating.
- A death specialist retains enough capacity for the final overs.
- A high phase rating cannot violate over limits or consecutive-over rules.
- A strong overall bowler is not displaced by a weak part-timer solely due to
  phase rating.
- Pitch and tactical preferences remain effective.

## Statistical calibration matrix

Use paired simulations: identical teams, seeds and conditions, changing only
the tested phase values.

For each phase, test these batter/bowler pairs:

```text
20/50, 35/50, 50/50, 65/50, 80/50
50/20, 50/35, 50/65, 50/80
30/70, 70/30, 70/70, 90/90
```

Run at least 10,000 relevant phase samples per pair and record:

- runs per over
- dot-ball percentage
- single/two percentage
- four and six percentage
- wicket probability per legal delivery
- wide and no-ball rate
- bowler overs by phase
- match win rate

## Acceptance criteria

1. The `50/50` cohort reproduces the pre-feature baseline exactly at the helper
   level and within `0.5%` statistically at the innings level.
2. Results are monotonic across `20, 35, 50, 65, 80` with sufficient samples.
3. A rating of 70 against 50 creates a visible but modest phase advantage; it
   must not behave like a 20-point increase in overall ability.
4. Equal non-neutral matchups such as 70/70 preserve neutral run/wicket effects.
5. Phase extremes do not change whole-innings average totals by more than 12%
   when only one player's phase rating is changed.
6. A 10-15 point overall-ability advantage remains more valuable across a full
   innings than a comparable phase-rating advantage.
7. League-level average totals, wickets, boundary rates and extras remain within
   the existing calibration bands.
8. Bowling rotations always complete legally.
9. No existing deterministic test changes unless its player data contains a
   non-neutral phase rating and the changed result is explicitly approved.

## Delivery sequence

1. Add pure phase helpers and unit tests with no simulation integration.
2. Add outcome modifiers behind a temporary internal feature flag.
3. Run paired phase calibration and tune coefficients.
4. Integrate bowler selection and death-over reservation.
5. Run match, season and long-career regression suites.
6. Remove the feature flag only after every acceptance criterion passes.
7. Document the calibrated coefficients and reports beside the tests.

Do not tune coefficients from individual scorecards. Only change them in
response to paired aggregate results so phase ratings remain understandable,
balanced and reproducible.
