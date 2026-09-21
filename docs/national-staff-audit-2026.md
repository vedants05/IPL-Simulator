# National staff directory audit (21 September 2026)

Scope: the 113 active `staff_members` returned by `/api/staff`, the 27 men's T20 countries in `INTERNATIONAL_TEAMS`, and the game's existing coaching roles. `lib/data/nationalStaffSeeds.ts` records the sources for every national starting assignment.

| Country | National staff seeded from the existing directory |
| --- | --- |
| India | Gautam Gambhir (head), Sitanshu Kotak (batting), Morne Morkel (pace bowling) |
| Australia | Andrew McDonald (head) |
| England | Brendon McCullum (T20 head); Stephen Fleming (separate Test head, user directed) |
| South Africa | Shukri Conrad (head) |
| New Zealand | Rob Walter (head) |
| West Indies | Daren Sammy (head) |
| Sri Lanka | Gary Kirsten (head) |
| Pakistan | Mike Hesson (head) |
| Afghanistan | Richard Pybus (head) |
| Malaysia | Dav Whatmore (head) |
| Bangladesh, Zimbabwe, Ireland, Scotland, Netherlands, Nepal, United States, Canada, Namibia, United Arab Emirates, Oman, Papua New Guinea, Uganda, Kenya, Hong Kong, Italy, Jersey | No current national coach in the existing staff directory could be assigned with a supported role. These posts remain vacant in new saves. |

The audit only seeds supported, current appointments for people in the directory. It does not interpret a former national post or a brief tournament consultancy as a permanent appointment. In particular, [Ryan ten Doeschate and T Dilip left India's staff in July 2026](https://www.icc-cricket.com/news/coaching-duo-part-ways-ahead-of-india-s-sri-lanka-series); [R Sridhar's Sri Lanka role was short term](https://www.icc-cricket.com/news/former-india-fielding-coach-joins-sri-lanka-setup-on-short-term-deal). Some active coaches are already committed to club posts in the game. For example, [Sairaj Bahutule joined India](https://www.bcci.tv/news/article/bcci-appoints-sairaj-bahutule-as-india-s-spin-bowling-coach) while the user provided a Punjab Kings starting contract for him. The current contract model permits one employer, so the user provided club assignment is preserved.

Several real national heads are outside the current directory, including [Bangladesh's Phil Simmons](https://www.icc-cricket.com/news/bangladesh-back-head-coach-with-extension-until-2027-world-cup), [Ireland's Gary Wilson](https://www.icc-cricket.com/news/world-cup-qualification-the-main-focus-for-new-ireland-coach), [Scotland's Owen Dawkins](https://www.icc-cricket.com/news/scotland-appoint-new-men-s-head-coach), and [Canada's Monty Desai](https://www.icc-cricket.com/news/canada-appoint-new-head-coach-for-men-s-team). They need complete staff profiles before the game can contract them.
