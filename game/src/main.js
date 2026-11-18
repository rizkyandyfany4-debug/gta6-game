// VICE HEAT: Neon Bay — bootstrap and game loop.
// Reads the URL (?shot=<name>&seed=1 for a staged screenshot scene,
// otherwise a fresh game), runs the world on a fixed 60 Hz timestep,
// and exposes a small read-only snapshot for automated playtesting at
// window.__game. Nothing here talks to the network.

import { createWorld, updateWorld, loadGame } from './world.js';
import { createRenderer, render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { stepTarget } from './missions.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const { input, attach, endTick } = createInput();
const audio = createAudio();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

let world;
let shotMode = false;
if (shotName) {
  shotMode = true;
  world = stageShot(shotName, seed);
} else {
  const save = loadGame();
  world = createWorld(seed, { started: false });
  if (save && typeof save.money === 'number') {
    // Continue where the player left off.
    world.money = save.money;
    world.player.health = save.health ?? 100;
    world.player.ammo = save.ammo ?? 12;
    world.player.reserve = save.reserve ?? 48;
    world.player.x = save.x ?? world.player.x;
    world.player.y = save.y ?? world.player.y;
    world.time = save.time ?? world.time;
  }
}
attach();

function resize() {
  const w = Math.min(window.innerWidth, 1600);
  const h = Math.min(window.innerHeight, 1000);
  renderer.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Mouse aim: convert screen pixels to world coordinates.
let mouseX = renderer.vw / 2;
let mouseY = renderer.vh / 2;
window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

function camera() {
  const p = world.player;
  return {
    x: Math.max(0, Math.min(3600 - renderer.vw, p.x - renderer.vw / 2)),
    y: Math.max(0, Math.min(3600 - renderer.vh, p.y - renderer.vh / 2)),
  };
}

function snapshot() {
  const p = world.player;
  const m = world.mission;
  let marker = null;
  if (m) {
    const step = m.def.steps[m.step];
    if (step) {
      const t = stepTarget(world, m, step);
      if (t) marker = { x: Math.round(t.x), y: Math.round(t.y), label: step.label };
    }
  }
  return {
    money: world.money,
    health: Math.round(p.health),
    wanted: world.wanted,
    player: { x: Math.round(p.x), y: Math.round(p.y), angle: p.angle, inCar: !!p.inCar },
    speed: p.inCar ? Math.round(Math.abs(p.inCar.speed)) : Math.round(Math.hypot(p.vx, p.vy)),
    topSpeed: Math.round(world.stats.topSpeed),
    police: world.police.length,
    mission: m ? { id: m.def.id, name: m.def.name, step: m.step, done: m.done } : null,
    missionCar: world.missionCar ? { x: Math.round(world.missionCar.x), y: Math.round(world.missionCar.y) } : null,
    missionMarker: marker,
    fare: world.fare,
    busted: world.busted,
    wasted: world.wasted,
    started: world.started,
    shotReady: !!world.shotReady,
    shotName: world.shotName || null,
    time: world.time,
  };
}

window.__game = {
  get state() {
    return snapshot();
  },
};

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frames += 1;

  if (!shotMode) {
    if (!world.started) {
      if (input.enter) {
        world.started = true;
        audio.unlock();
      }
      render(renderer, world);
      endTick();
      return;
    }
    // First gesture unlocks audio.
    if (input.up || input.down || input.left || input.right || input.fire || input.punch) audio.unlock();
    const cam = camera();
    input.aimX = cam.x + mouseX;
    input.aimY = cam.y + mouseY;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      updateWorld(world, input, STEP);
      endTick();
      acc -= STEP;
      steps += 1;
    }
    if (steps === 5) acc = 0;
    // Drain sound events.
    for (const ev of world.events) audio.play(ev);
    world.events.length = 0;
    audio.setEngine(!!world.player.inCar, world.player.inCar ? Math.abs(world.player.inCar.speed) / 560 : 0);
    audio.update(dt, world.wanted);
  }
  render(renderer, world);
  if (shotMode && frames === 3) {
    // The staged scene is already settled; a few frames let the canvas
    // paint, then the shot is ready to capture.
    window.__shotReady = true;
  }
}

requestAnimationFrame(frame);
