const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const source = fs.readFileSync("lib/logic/dayTicker.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(js, { module: moduleObject, exports: moduleObject.exports, setTimeout, clearTimeout, Promise });

async function test() {
  const timers = new Map();
  let nextId = 0;
  let finishOldTick;
  let finishNewTick;
  let calls = 0;
  const ticker = moduleObject.exports.createDayTicker({
    intervalMs: 1,
    schedule: callback => { const id = ++nextId; timers.set(id, callback); return id; },
    cancel: id => timers.delete(id),
    onTick: () => {
      calls += 1;
      if (calls === 1) return new Promise(resolve => { finishOldTick = resolve; });
      if (calls === 2) return new Promise(resolve => { finishNewTick = resolve; });
    },
  });
  const fire = () => { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); };
  ticker.start();
  fire();
  ticker.stop();
  ticker.start();
  fire();
  assert.equal(timers.size, 0);
  finishOldTick();
  await Promise.resolve();
  assert.equal(timers.size, 0, "a tick from a previous run must not add a timer");
  finishNewTick();
  await Promise.resolve();
  assert.equal(timers.size, 1);
  fire();
  assert.equal(calls, 3);
  assert.equal(timers.size, 1);
  ticker.dispose();
  assert.equal(timers.size, 0);
}

test().then(() => console.log("Day ticker restart race passed."), error => { console.error(error); process.exitCode = 1; });
