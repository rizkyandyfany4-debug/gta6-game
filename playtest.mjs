// VICE HEAT: Neon Bay — headless playtest.
// Serves game/ with serve.ts, drives it in headless Chromium, and checks:
//   1. The four ?shot= scenes are byte-identical across two runs.
//   2. Mission 1 plays end-to-end: $120 -> $520.
//   3. A sports car reaches ~560 px/s top speed.
//   4. The five-star chase scene has police actively pursuing.
//   5. Zero console errors and zero page errors anywhere.
// Usage: node playtest.mjs [--serve-port 8901]
// Exits 0 when every check passes, 1 otherwise.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/tmp/vh-playtest/node_modules/playwright-core/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv.find((a) => a.startsWith('--serve-port='))?.split('=')[1] ?? '8901');
const BASE = `http://localhost:${PORT}`;
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome';
const SHOTS_DIR = join(HERE, 'screenshots');
const TMP = '/tmp/vh-shots';

const errors = [];
const results = {};
let failures = 0;
function check(name, ok, detail = '') {
  results[name] = { ok, detail };
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}
function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return { context, page };
}

// A closed-loop driver: steer toward a target point using real key events.
async function driveTo(page, getTarget, timeoutMs, label) {
  const held = new Set();
  const setKeys = async (want) => {
    for (const k of [...held]) {
      if (!want.has(k)) {
        await page.keyboard.up(k);
        held.delete(k);
      }
    }
    for (const k of want) {
      if (!held.has(k)) {
        await page.keyboard.down(k);
        held.add(k);
      }
    }
  };
  const start = Date.now();
  let lastDist = Infinity;
  let stuckSince = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await page.evaluate(() => window.__game.state);
    const target = await getTarget(s);
    if (!target) return { ok: true, state: s };
    const dx = target.x - s.player.x;
    const dy = target.y - s.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (target.radius ?? 60)) {
      await setKeys(new Set());
      return { ok: true, state: s };
    }
    if (dist < lastDist - 2) {
      lastDist = dist;
      stuckSince = Date.now();
    } else if (Date.now() - stuckSince > 2500) {
      // Wedged against something: back up briefly, then try again.
      await setKeys(new Set(['KeyS']));
      await sleep(900);
      await setKeys(new Set());
      lastDist = Infinity;
      stuckSince = Date.now();
      if (Date.now() - start > timeoutMs - 5000) {
        return { ok: false, state: s, reason: `stuck at ${Math.round(dist)}px from ${label}` };
      }
      continue;
    }
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - s.player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const want = new Set(['KeyW']);
    if (diff > 0.12) want.add('KeyD');
    else if (diff < -0.12) want.add('KeyA');
    if (s.speed > 420 && Math.abs(diff) > 0.5) want.delete('KeyW');
    await setKeys(want);
    await sleep(90);
  }
  await setKeys(new Set());
  const s = await page.evaluate(() => window.__game.state);
  return { ok: false, state: s, reason: `timeout driving to ${label}` };
}

async function walkTo(page, getTarget, timeoutMs, label) {
  const held = new Set();
  const setKeys = async (want) => {
    for (const k of [...held]) {
      if (!want.has(k)) {
        await page.keyboard.up(k);
        held.delete(k);
      }
    }
    for (const k of want) {
      if (!held.has(k)) {
        await page.keyboard.down(k);
        held.add(k);
      }
    }
  };
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await page.evaluate(() => window.__game.state);
    const target = await getTarget(s);
    if (!target) return { ok: true, state: s };
    const dx = target.x - s.player.x;
    const dy = target.y - s.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (target.radius ?? 40)) {
      await setKeys(new Set());
      return { ok: true, state: s };
    }
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - s.player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // On foot the player moves in the pressed direction, not by heading,
    // so pick the dominant axis keys directly.
    const want = new Set();
    if (dx > 12) want.add('KeyD');
    else if (dx < -12) want.add('KeyA');
    if (dy > 12) want.add('KeyS');
    else if (dy < -12) want.add('KeyW');
    want.add('ShiftLeft');
    void diff;
    await setKeys(want);
    await sleep(90);
  }
  await setKeys(new Set());
  const s = await page.evaluate(() => window.__game.state);
  return { ok: false, state: s, reason: `timeout walking to ${label}` };
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(SHOTS_DIR, { recursive: true });
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: HERE, stdio: 'pipe' });
  server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));
  await sleep(1200);

  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  try {
    // --- 1. Screenshot determinism --------------------------------------
    const shots = [
      ['1-start.jpg', 'start'],
      ['2-drive.jpg', 'drive'],
      ['3-chase.jpg', 'chase'],
      ['4-mission.jpg', 'mission'],
    ];
    for (const run of [1, 2]) {
      const runDir = join(TMP, `run${run}`);
      mkdirSync(runDir, { recursive: true });
      for (const [name, shot] of shots) {
        const { context, page } = await newPage(browser, errors);
        await page.goto(`${BASE}/?shot=${shot}&seed=1`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
        await page.screenshot({ path: join(runDir, name), type: 'jpeg', quality: 85 });
        await context.close();
      }
    }
    for (const [name] of shots) {
      const a = readFileSync(join(TMP, 'run1', name));
      const b = readFileSync(join(TMP, 'run2', name));
      const sizeOk = a.length < 262144 && b.length < 262144;
      check(`shot ${name} deterministic`, sha256(a) === sha256(b) && sizeOk,
        `${a.length} bytes, sha ${sha256(a).slice(0, 12)}`);
      writeFileSync(join(SHOTS_DIR, name), b);
    }

    // --- 2. Mission 1 end to end -----------------------------------------
    {
      const { context, page } = await newPage(browser, errors);
      await page.goto(BASE, { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(300);
      let s = await page.evaluate(() => window.__game.state);
      check('mission 1 starts with $120', s.money === 120, `$${s.money}`);
      check('mission 1 active', s.mission?.id === 1, s.mission?.name ?? 'none');

      // Walk to the red sports car and steal it.
      const walk = await walkTo(page, (st) => st.missionCar ? { x: st.missionCar.x, y: st.missionCar.y, radius: 55 } : null, 30000, 'mission car');
      check('walked to mission car', walk.ok, walk.reason ?? '');
      await page.keyboard.press('KeyE');
      await sleep(400);
      s = await page.evaluate(() => window.__game.state);
      check('entered mission car', !!s.player.inCar, s.player.inCar ? 'in car' : 'on foot');
      check('no wanted from the job car', s.wanted === 0, `${s.wanted} stars`);

      // Drive south to Rico's garage.
      const drive = await driveTo(page, (st) => st.missionMarker ? { x: st.missionMarker.x, y: st.missionMarker.y, radius: 80 } : null, 45000, "Rico's Garage");
      check('drove to garage marker', drive.ok, drive.reason ?? '');
      await sleep(600);
      s = await page.evaluate(() => window.__game.state);
      check('mission 1 complete: $120 -> $520', s.money === 520, `$${s.money}`);
      check('mission 2 unlocked', s.mission?.id === 2, s.mission ? `mission ${s.mission.id}` : 'none');

      // --- 3. Top speed: keep driving north on the x=600 road ------------
      // Still in the sports car at the garage; turn north and floor it.
      const topStart = Date.now();
      let maxSeen = 0;
      const held = new Set();
      const setKeys = async (want) => {
        for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
        for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
      };
      while (Date.now() - topStart < 9000) {
        const st = await page.evaluate(() => window.__game.state);
        maxSeen = Math.max(maxSeen, st.speed, st.topSpeed);
        if (st.player.y < 400) break;
        // Steer toward x=600, heading north (angle -PI/2).
        const dx = 600 - st.player.x;
        const wantAngle = -Math.PI / 2 + Math.max(-0.4, Math.min(0.4, dx / 300));
        let diff = wantAngle - st.player.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const want = new Set(['KeyW']);
        if (diff > 0.1) want.add('KeyD');
        else if (diff < -0.1) want.add('KeyA');
        await setKeys(want);
        await sleep(90);
      }
      await setKeys(new Set());
      check('top speed around 560 px/s', maxSeen >= 520 && maxSeen <= 600, `${maxSeen} px/s`);
      await context.close();
    }

    // --- 4. Five-star chase scene -----------------------------------------
    {
      const { context, page } = await newPage(browser, errors);
      await page.goto(`${BASE}/?shot=chase&seed=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
      const s = await page.evaluate(() => window.__game.state);
      check('chase scene: 5 stars', s.wanted === 5, `${s.wanted} stars`);
      check('chase scene: police pursuing', s.police >= 2, `${s.police} police cars`);
      await context.close();
    }

    // --- 5. No console / page errors ---------------------------------------
    check('zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('playtest crashed:', e);
  process.exit(1);
});
