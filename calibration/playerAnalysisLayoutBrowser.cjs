const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');
const WebSocket = require('next/dist/compiled/ws');

async function main() {
  const output = path.join(os.tmpdir(), 'ipl-analysis-layout-check');
  fs.mkdirSync(output, { recursive: true });
  esbuild.buildSync({ entryPoints: ['calibration/playerAnalysisLayoutBrowser.tsx'], bundle: true, platform: 'browser', outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"development"' } });
  execFileSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', 'app/globals.css', '-o', path.join(output, 'styles.css')], { stdio: 'pipe' });
  fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body style="margin:0;overflow:hidden"><div id="root"></div><script src="fixture.js"></script></body></html>');
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${path.join(output, 'chrome-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let buffer = '';
      const timer = setTimeout(() => reject(new Error('Chrome debug endpoint timed out')), 20000);
      chrome.stderr.on('data', (chunk) => { buffer += chunk; const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
      chrome.on('exit', () => reject(new Error('Chrome exited before testing')));
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve) => socket.once('open', resolve));
    let sequence = 0;
    const pending = new Map();
    socket.on('message', (raw) => { const data = JSON.parse(String(raw)); if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    const evaluate = async (expression) => { const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
    await command('Page.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await command('Page.navigate', { url: pathToFileURL(path.join(output, 'index.html')).href });
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate('Boolean(window.analysisTest)')) break; await new Promise((resolve) => setTimeout(resolve, 50)); }
    const cases = [
      { name: 'largest-scatter', diagrams: ['scatter', 'scatter', 'scatter'] },
      { name: 'largest-mixed', diagrams: ['scatter', 'bubble', 'radar'] },
      { name: 'smallest-ranking', diagrams: ['ranking', 'ranking', 'ranking'] },
      { name: 'smallest-mixed', diagrams: ['ranking', 'table', 'horizontal'] },
      { name: 'one-large', diagrams: ['scatter'] },
      { name: 'two-large', diagrams: ['scatter', 'bubble'] },
      { name: 'three-only', diagrams: ['scatter', 'bubble', 'radar'], hidden: true },
      { name: 'default', diagrams: [] },
    ];
    for (let removed = 1; removed <= 8; removed++) {
      cases.push({ name: `large-remove-${removed}`, diagrams: ['scatter', 'bubble', 'radar'], removeCount: removed });
      cases.push({ name: `small-remove-${removed}`, diagrams: ['ranking', 'ranking', 'ranking'], removeCount: removed });
    }
    cases.push({ name: 'empty', diagrams: [], hidden: true });
    for (const diagram of ['bars', 'horizontal', 'grouped', 'pie', 'doughnut', 'treemap', 'line', 'area', 'dot', 'box', 'table', 'stacked', 'percent', 'cumulative', 'rolling', 'histogram']) cases.push({ name: `three-${diagram}`, diagrams: [diagram, diagram, diagram] });
    const results = [];
    for (const [width, height] of [[1440, 900], [1280, 800], [1920, 1080]]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      for (const scenario of cases) {
        await evaluate(`window.analysisTest.render(${JSON.stringify(scenario.diagrams)}, ${scenario.hidden ? 'window.analysisTest.ids' : scenario.removeCount ? `window.analysisTest.ids.slice(0, ${scenario.removeCount})` : '[]'})`);
        await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
        const result = await evaluate('window.analysisTest.measure()');
        results.push({ name: scenario.name, ...result });
        if (width === 1440 && ['largest-mixed', 'smallest-ranking'].includes(scenario.name)) {
          const screenshot = await command('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(output, `${scenario.name}.png`), Buffer.from(screenshot.data, 'base64'));
        }
      }
    }
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const theme of ['dark', 'retro']) {
      for (const scenario of cases.filter((entry) => ['largest-mixed', 'smallest-ranking'].includes(entry.name))) {
        await evaluate(`document.documentElement.className = ${JSON.stringify(theme)}; window.analysisTest.render(${JSON.stringify(scenario.diagrams)})`);
        await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
        results.push({ name: `${theme}-${scenario.name}`, ...await evaluate('window.analysisTest.measure()') });
        const screenshot = await command('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(output, `${theme}-${scenario.name}.png`), Buffer.from(screenshot.data, 'base64'));
      }
    }
    await evaluate('document.documentElement.className = ""');
    for (const diagram of ['scatter', 'bubble']) {
      await evaluate(`window.analysisTest.renderPreview(${JSON.stringify(diagram)})`);
      await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
      results.push({ name: `preview-${diagram}`, ...await evaluate('window.analysisTest.measurePreview()') });
      const screenshot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `preview-${diagram}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ output, cases: results.length, failures: results.filter((result) => result.issues.length).map(({ name, width, height, issues }) => ({ name, width, height, issues })), sample: results.filter((result) => result.width === 1440 && ['largest-mixed', 'smallest-ranking'].includes(result.name)) }, null, 2));
    if (results.some((result) => result.issues.length)) process.exitCode = 1;
  } finally { socket?.close(); chrome.kill(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
