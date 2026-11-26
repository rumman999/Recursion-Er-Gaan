// Dev helper: drives headless Edge/Chrome over CDP to screenshot the app and catch console errors.
// Usage: node scripts/shoot.mjs <url> <outDir> [width] [height] [steps-json]
// Steps: [{"evalFile": "path.js", "saveTo": "out.png"} (saves a returned data: URL),, {"eval": "js"}, {"wait": ms}, {"shot": "name"}, {"key": "f"}]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [url, outDir, w = '1440', h = '900', stepsJson = '[]'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
mkdirSync(outDir, { recursive: true });

const candidates = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const exe = candidates.find((p) => existsSync(p));
if (!exe) throw new Error('No Chrome or Edge found; set BROWSER');

const port = 9333 + Math.floor(Math.random() * 500);
const proc = spawn(exe, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--window-size=${w},${h}`,
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run',
  `--user-data-dir=${join(tmpdir(), 'reg-shoot-' + port)}`,
  'about:blank',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const logs = { push: (line) => console.log(line) };
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    logs.push('[exception] ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
await send('Page.navigate', { url });
await sleep(2500);

for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.evalFile) s.eval = readFileSync(s.evalFile, 'utf8');
  if (s.eval) {
    const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true, userGesture: true });
    const value = r.result?.result?.value;
    if (s.saveTo && typeof value === 'string' && value.startsWith('data:')) {
      writeFileSync(s.saveTo, Buffer.from(value.split(',')[1], 'base64'));
      logs.push(`[saved] ${s.saveTo}`);
    } else {
      logs.push('[eval] ' + JSON.stringify(value ?? r.result?.exceptionDetails?.exception?.description ?? r.result?.exceptionDetails?.text ?? null));
    }
  }
  if (s.key) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: s.key, text: s.key });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: s.key });
  }
  if (s.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, s.shot + '.png'), Buffer.from(r.result.data, 'base64'));
  }
}

ws.close();
proc.kill();
process.exit(0);
