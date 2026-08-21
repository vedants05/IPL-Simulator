# Staff rating guidelines

Canonical version: `2026-08-19-v1`. The executable source of truth is
`lib/logic/staffRatingGuidelines.ts`; every script that writes staff ratings
must run its validator before touching Supabase.

## Non-negotiable principles

- Rate demonstrated coaching, not playing greatness. Playing legacy belongs in reputation.
- Compare new scores with existing staff benchmarks to prevent rating inflation.
- Research depth improves confidence; it does not automatically increase a rating.
- Scores of 19 and especially 20 are rare, world-leading benchmarks requiring attributable, sustained results.
- An appointment alone is not proof of technical coaching, development, tactics or people leadership.
- Helping players reach international level contributes to player/youth development and judging evidence; it is not a separate attribute.
- People leadership must correlate strongly with man management.
- Reputation is rated from 0–100 and contributes heavily to mentor suitability, but does not inflate specialist or head-coach roles.

## The 1–20 scale

| Score | Required standard |
|---|---|
| 1–4 | No relevant evidence or outside the coach's domain |
| 5–7 | Limited transferable knowledge; not sustained professional evidence |
| 8–10 | Some exposure, below established professional-coach standard |
| 11–13 | Competent professional capability with limited credible evidence |
| 14–16 | Strong, clearly demonstrated professional capability |
| 17 | Excellent and proven over meaningful work |
| 18 | Elite evidence over multiple seasons or major assignments |
| 19 | World-leading and sustained across contexts or elite outcomes |
| 20 | Generational database benchmark; exceptional, rare and never reputation-only |

## Attribute meanings

- Batting, pace, spin, fielding and wicketkeeping coaching measure demonstrated diagnosis and teaching within that specialty.
- Technical coaching measures diagnosis, communication, drill design and correction—not how technically gifted the person was as a player.
- Tactical knowledge measures planning, squad balance, role clarity, adaptation and decisions.
- Player development measures attributable improvement of senior players, including progression to international cricket.
- Youth development measures academy, age-group, emerging and inexperienced professional development.
- Judging ability measures assessment of present quality and readiness.
- Judging potential measures forecasting ceiling and identifying players who later progress.
- Man management measures trust, clarity, accountability, conflict handling and individual relationships.
- Motivation measures confidence, standards, resilience and competitive intensity.

## Role formulas

The canonical formula implementation is `lib/logic/staffRatings.ts`. Do not
manually assign overall role ratings. They must always be derived from the
agreed weights in that module after the underlying attributes are validated.

## Required workflow

1. Research person-specific evidence and record it in `rating_basis`.
2. Score one attribute at a time using the scale above.
3. Compare against established benchmarks in the same attribute and role.
4. Validate the profile using `validateStaffRatingProfile`.
5. Derive every role rating using `calculateStaffRoleRatings`.
6. Run the full distribution audit before applying changes to Supabase.
