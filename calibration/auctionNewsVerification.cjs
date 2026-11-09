const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("lib/logic/auctionNews.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(js, { module: moduleObject, exports: moduleObject.exports });
const { getRecordedAuctionBuys } = moduleObject.exports;
const players = { old: { id: "old", currentTeamId: "KKR" }, sold: { id: "sold", currentTeamId: "MI" } };
const auction = { season: 2029, phase: "completed", saleHistory: [
  { playerId: "sold", teamId: "KKR", price: 1100 },
  { playerId: "sold", teamId: "MI", price: 1200 },
] };
const buys = getRecordedAuctionBuys(auction, 2029, players);
assert.equal(buys.length, 1);
assert.equal(buys[0].player.id, "sold");
assert.equal(buys[0].sale.teamId, "MI");
assert.equal(buys[0].sale.price, 1200);
assert.equal(getRecordedAuctionBuys(auction, 2028, players).length, 0);
assert.equal(getRecordedAuctionBuys({ ...auction, phase: "bidding" }, 2029, players).length, 0);
assert.equal(getRecordedAuctionBuys({ ...auction, saleHistory: [] }, 2029, players).length, 0);
console.log("Auction news uses only completed, season-matched recorded sales.");
