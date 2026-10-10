import assert from "node:assert/strict";
import { compareNewsArticles, getNewsArticleExpiry, isNewsActive, isNewsBreaking, isNewsPublished, newsWindowEnd } from "../lib/logic/newsArticlePolicy";
import { buildStaffNewsArticles } from "../lib/logic/staffNewsArticles";
import type { StaffNewsEvent } from "../lib/logic/staffContracts";

const report = { id: "match", publishedAt: "2027-04-10", expiresAt: newsWindowEnd("2027-04-10", 4), isBreaking: true };
assert.equal(report.expiresAt, "2027-04-13");
assert.equal(isNewsActive(report, "2027-04-09"), false, "Future articles are hidden");
assert.equal(isNewsActive(report, "2027-04-13"), true);
assert.equal(isNewsActive(report, "2027-04-14"), false);
assert.equal(isNewsBreaking(report, "2027-04-11"), true);
assert.equal(isNewsBreaking(report, "2027-04-12"), false, "Breaking status ends before feed visibility");
assert.equal(isNewsPublished(report, "2028-01-01"), true, "A saved pin remains readable after expiry");
assert.equal(newsWindowEnd("2028-02-28", 3), "2028-03-01");
assert.equal(newsWindowEnd("2027-12-31", 2), "2028-01-01");
const champion = { id: "champion", publishedAt: "2027-04-10", expiresAt: "2028-03-31", requiresFinalResult: true };
const routine = { id: "routine", publishedAt: "2027-04-11", expiresAt: "2027-04-20", category: "user_team" };
assert.ok(compareNewsArticles(champion, routine, "2027-04-11") < 0, "Fresh major story receives promotion");
assert.ok(compareNewsArticles(champion, routine, "2027-04-12") > 0, "Long visibility does not mean permanent promotion");
const policy = {
  publishedDate: "2027-06-01", durationDays: 7, isFinalResult: false, isFinalRunnerUp: false,
  isRetirement: false, isLegendRetirement: false, nextRetentionDate: "2027-11-15",
  isPostAuction: false, postAuctionCutoffDate: "2027-03-20", isFixtureAnnouncement: false,
  seasonStartDate: "2027-03-27", nextSeasonStartDate: "2028-03-27",
};
assert.equal(getNewsArticleExpiry(policy), "2027-06-07");
assert.equal(getNewsArticleExpiry({ ...policy, isFinalRunnerUp: true }), "2027-06-14");
assert.equal(getNewsArticleExpiry({ ...policy, isFinalResult: true }), "2028-03-26");
assert.equal(getNewsArticleExpiry({ ...policy, isRetirement: true }), "2027-11-14");

const state = {
  newsEvents: [] as StaffNewsEvent[],
  contracts: { retiring: { fullName: "Retiring Coach" }, old: { fullName: "Former Coach" }, interim: { fullName: "Interim Coach" }, next: { fullName: "New Coach" } },
  generatedProfiles: { generated: { full_name: "Generated Coach" } },
};
const event = (id: string, kind: StaffNewsEvent["kind"], publishedOn: string, staffId: string | null): StaffNewsEvent => ({ id, kind, publishedOn, staffId, teamId: "KKR" });
const generate = (date: string) => buildStaffNewsArticles(state, (id) => id, "KKR", date);
state.newsEvents = [event("retirement", "staff_retired", "2027-06-02", "retiring")];
assert.equal(generate("2027-06-01").length, 0);
const retirement = generate("2027-06-02")[0];
assert.match(retirement.title, /Retiring Coach retires/);
assert.doesNotMatch(retirement.content, /interim|search|appointed/);
assert.equal(retirement.expiresAt, "2027-06-15");
state.newsEvents = [event("generated-retirement", "staff_retired", "2027-06-02", "generated")];
assert.match(generate("2027-06-02")[0].title, /Generated Coach retires/);

state.newsEvents = [
  event("dismissal", "head_coach_sacked", "2027-06-01", "old"),
  event("vacancy", "head_coach_vacancy", "2027-06-03", "interim"),
  event("appointment", "head_coach_appointed", "2027-06-06", "next"),
];
assert.equal(generate("2027-06-01").length, 1, "A future vacancy must not hide today's dismissal");
const vacancy = generate("2027-06-03");
assert.equal(vacancy.length, 1, "Related dismissal and vacancy are consolidated");
assert.match(vacancy[0].title, /Former Coach.*Interim Coach/);
const appointed = generate("2027-06-06");
assert.equal(isNewsActive(appointed.find((item) => item.id === "vacancy")!, "2027-06-06"), false);
assert.doesNotMatch(appointed.find((item) => item.id === "appointment")!.content, /mid-season/);

state.newsEvents.push(event("later-vacancy", "head_coach_vacancy", "2027-08-01", null));
assert.doesNotMatch(generate("2027-08-01").find((item) => item.id === "later-vacancy")!.title, /Former Coach|dismiss/);
state.newsEvents = [event("dismissal", "head_coach_sacked", "2027-12-30", "old"), event("vacancy", "head_coach_vacancy", "2028-01-02", "interim")];
assert.equal(generate("2028-01-02").length, 1, "Event pairing crosses calendar years");
assert.match(generate("2028-01-02")[0].title, /Former Coach/);
console.log("News timing, promotion and staff article checks passed.");
