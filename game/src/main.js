// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// four screens: title, play, paused and game over. Progress autosaves.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, BEST_KEY, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Ignore.
  }
}

// Sounds for the world's events, and the mission banner they raise.
let banner = null;
let bannerTimer = 0;
function handleEvents() {
  for (const event of world.events) {
    switch (event) {
      case 'shot': audio.shot(); break;
      case 'punch': case 'punched': audio.punch(); break;
      case 'crash': case 'rammed': audio.crash(); break;
      case 'pickup': case 'cash': audio.pickup(); break;
      case 'bought': case 'fare-paid': case 'healed': case 'sprayed': audio.cash(); break;
      case 'horn': audio.horn(); break;
      case 'enter': case 'exit': case 'step': audio.click(); break;
      case 'busted': case 'wasted': audio.busted(); break;
      case 'mission': {
        audio.mission();
        const next = world.missions.current();
        if (next) {
          banner = { title: `MISSION ${world.missions.index + 1} — ${next.title}`, text: next.intro };
          bannerTimer = 5;
        }
        writeSave();
        break;
      }
      case 'story':
        audio.mission();
        banner = { title: 'STORY COMPLETE', text: 'Neon Bay is yours. Keep driving, keep earning.' };
        bannerTimer = 6;
        writeSave();
        break;
      case 'ambush':
        banner = { title: 'AMBUSH', text: 'The Neon Kings are here. Take them out!' };
        bannerTimer = 4;
        break;
      default:
        break;
    }
  }
  world.events.length = 0;
}

function announce(message) {
  status.textContent = message;
}

function respawn() {
  const p = world.player;
  const lost = Math.min(world.cash, Math.max(150, Math.floor(world.cash * 0.1)));
  world.cash -= lost;
  p.health = 100;
  p.armor = 0;
  p.inCar = null;
  p.busted = false;
  p.wasted = false;
  p.bustTimer = 0;
  world.over = null;
  world.overTimer = 0;
  world.setWanted(0);
  world.cops.length = 0;
  // A busted getaway restarts its mission from the first step.
  const step = world.missions.currentStep();
  if (step && step.type === 'survive') world.missions.step = 0;
  world.rivalsSpawned = false;
  world.rivals.length = 0;
  const hospital = world.city.shops.hospital;
  p.x = hospital.x;
  p.y = hospital.y + 80;
  writeSave();
  announce('Back on the streets.');
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotState = {
    wanted: world.wanted,
    cops: world.cops.length,
    policeCars: world.cars.filter((c) => c.kind === 'police').length,
    mission: world.missions.index,
    missionStep: world.missions.step,
    missionObjective: world.missions.objectiveText(),
    inCar: !!world.player.inCar,
    carSpeed: world.player.inCar ? Math.round(world.player.inCar.speed) : 0,
    cash: world.cash,
    rivals: world.rivals.length,
    x: Math.round(world.player.x),
    y: Math.round(world.player.y),
  };
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, readSave(), readBest(), scene.banner);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function startGame(fresh) {
    audio.unlock();
    audio.startMusic();
    if (fresh || !save) {
      world.reset();
      save = null;
    } else {
      world.loadSave(save);
    }
    const mission = world.missions.current();
    if (mission && world.missions.step === 0) {
      banner = { title: `MISSION ${world.missions.index + 1} — ${mission.title}`, text: mission.intro };
      bannerTimer = 5;
    }
    screen = SCREEN_PLAY;
    announce('Playing. Follow the yellow marker.');
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (input.wasPressed('mute')) audio.setMuted(!audio.isMuted());

    if (screen === SCREEN_TITLE) {
      world.time += elapsed; // the city lives behind the menu
      if (input.wasPressed('confirm')) startGame(false);
      if (input.wasPressed('attack') && save) startGame(true); // Space = new game when a save exists
      renderer.draw(world, screen, save, best, null);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('pause') || input.wasPressed('confirm')) screen = SCREEN_PLAY;
      renderer.draw(world, screen, save, best, null);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    if (screen === SCREEN_OVER) {
      if (input.wasPressed('confirm') && world.overTimer > 1) {
        respawn();
        screen = SCREEN_PLAY;
      }
      renderer.draw(world, screen, save, best, null);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    // SCREEN_PLAY
    if (input.wasPressed('pause')) {
      screen = SCREEN_PAUSED;
      writeSave();
      renderer.draw(world, screen, save, best, null);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }
    accumulator += elapsed;
    while (accumulator >= STEP) {
      world.step(STEP, input, audio);
      input.endFrame();
      accumulator -= STEP;
      if (world.over) break;
    }
    handleEvents();
    if (bannerTimer > 0) {
      bannerTimer -= elapsed;
      if (bannerTimer <= 0) banner = null;
    }
    saveTimer += elapsed;
    if (saveTimer >= AUTOSAVE_SECONDS) {
      saveTimer = 0;
      writeSave();
      if (world.cash > best) {
        best = world.cash;
        writeBest(best);
      }
    }
    if (world.over) screen = SCREEN_OVER;
    renderer.draw(world, screen, save, best, banner);
    requestAnimationFrame(frame);
  }

  // A handle for the playtest: the live state, without touching the DOM.
  window.__game = () => ({
    screen,
    x: Math.round(world.player.x),
    y: Math.round(world.player.y),
    angle: world.player.angle,
    cash: world.cash,
    wanted: world.wanted,
    health: Math.round(world.player.health),
    inCar: !!world.player.inCar,
    carSpeed: world.player.inCar ? Math.round(world.player.inCar.speed) : 0,
    mission: world.missions.index,
    missionStep: world.missions.step,
    missionObjective: world.missions.objectiveText(),
    cars: world.cars.length,
    peds: world.peds.length,
    cops: world.cops.length,
    rivals: world.rivals.length,
    over: world.over,
    seed,
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
