# Economy Control career development

Postseason development now changes Economy Control. Players under 22 have a base annual learning rate of 1.8 points, ages 22–25 1.2, ages 26–29 0.5, ages 30–33 0.2. Learning scales with legal balls bowled, reaching full exposure at 240 balls (40 overs); additional overs do not increase it further. No bowling means no learning gain.

The active club pace/spin bowling coach contributes through the relevant role rating. Coaching scales learning from roughly 0.75 to 1.25; no assigned specialist uses a neutral multiplier of 1. Head coaches count when explicitly assigned the relevant secondary bowling-coach role. The best relevant assigned coach is used, rather than stacking multiple coaches.

Learning tapers above 74 Economy Control as headroom closes toward 99. Gradual decline begins at age 35 (0.2 points), increasing by 0.15 per year up to 1.5 points annually. This is a design calibration, not a fitted empirical ageing curve. Fractional changes accumulate in the career development bank. Current values and season history are saved; repeated postseason processing cannot apply growth twice. Database refresh preserves developed ratings.

A 20-year-old at 60 control bowling 40 overs with a 95-rated coach gains about 2.21 points before integer banking. At 10 overs the gain is about 0.55 points. With a 40-rated coach and 40 overs it is about 1.71 points. Economy outcomes themselves do not generate growth, avoiding rewarding seasonal luck twice.

Checks: `node scripts/runCalibration.cjs calibration/economyDevelopmentVerification.ts` covers workload, age, relevant coaching roles, diminishing headroom, exposure limits, history, duplicate processing and save/reload persistence. New-player population regression (10,000 players) and TypeScript checks also pass.
