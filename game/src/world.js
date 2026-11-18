// VICE HEAT: Neon Bay — the world.
// Holds everything the game is: the player, the cars, the crowds, the
// wanted level, the active mission, the clock and the money. One update
// tick moves it all forward; rendering only reads it.

import {
  WORLD_SIZE, START_MONEY, START_TIME_HOURS, DAY_LENGTH_SECONDS,
  PLAYER, PISTOL, CAR, TRAFFIC, PEDS, WANTED, PRICES, TAXI_FARE,
} from './config.js';
import { buildCity, hitsBuilding, isWater, onRoad, nearestRoadPoint, districtAt } from './city.js';
import { makeRng } from './random.js';
import { makePlayer, makeCar, makePoliceCar, makePedestrian, updatePlayerOnFoot, updateDrivenCar, updateTrafficCar, updatePoliceCar, updatePedestrian } from './entities.js';
import { MISSIONS, startMissionState, stepTarget } from './missions.js';

const SAVE_KEY = 'vice-heat-neon-bay-save-v1';

export function createWorld(seed = 1, opts = {}) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const places = city.places;

  const world = {
    seed,
    rng,
    city,
    places,
    time: START_TIME_HOURS, // hours, 0-24
    money: START_MONEY,
    wanted: 0,
    wantedTimer: 0,
    player: makePlayer(600, 3000),
    cars: [],
    peds: [],
    police: [],
    rivals: [],
    mission: null,
    missionIndex: 0,
    missionCar: null,
    checkpoints: [],
    checkpointIndex: 0,
    fare: null, // { phase: 'pickup' | 'dropoff', x, y, timer }
    fareTimer: 8,
    toasts: [],
    shopOpen: null,
    busted: false,
    wasted: false,
    respawnTimer: 0,
    playTime: 0,
    kills: 0,
    crimes: 0,
    stats: { topSpeed: 0, distanceDriven: 0 },
    saveTimer: 0,
    gameOver: false,
    started: opts.started ?? false,
    muted: false,
    events: [], // sound triggers the audio layer reads and clears
  };
  world.player.money = START_MONEY;

  // Parked cars scattered on the roads, plus a few near the spawn.
  for (let i = 0; i < 16; i++) {
    const x = rng.range(200, 3200);
    const y = rng.range(200, 3400);
    const spot = nearestRoadPoint(x, y);
    const car = makeCar(rng, spot.x + rng.range(-24, 24), spot.y + rng.range(-24, 24));
    car.driver = null;
    world.cars.push(car);
  }
  // Traffic.
  for (let i = 0; i < TRAFFIC.count; i++) {
    const x = rng.range(150, 3150);
    const y = rng.range(150, 3450);
    const spot = nearestRoadPoint(x, y);
    const car = makeCar(rng, spot.x, spot.y);
    car.driver = 'traffic';
    car.speed = rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
    world.cars.push(car);
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < PEDS.count; i++) {
    const x = rng.range(150, 3200);
    const y = rng.range(150, 3450);
    world.peds.push(makePedestrian(rng, x, y));
  }

  if (!opts.skipMission) startMission(world, 0);
  return world;
}

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) {
    world.mission = null;
    world.toasts.push({ text: 'All missions complete — Neon Bay is yours.', t: 6 });
    return;
  }
  world.missionIndex = index;
  world.mission = startMissionState(index);
  world.mission.started = true;
  world.toasts.push({ text: def.intro, t: 7 });
  world.events.push('mission');
  // Mission 1: the red sports car waits by the docks, a short walk away,
  // parked facing south down the road toward the garage.
  if (index === 0) {
    const car = makeCar(world.rng, 600, 3060, 'sports');
    car.color = '#d8443c';
    car.angle = Math.PI / 2;
    car.driver = null;
    car.missionTarget = true;
    world.missionCar = car;
    world.cars.push(car);
  }
  // Mission 4: the sports car waits at Sunset Beach, on the road,
  // parked facing south down the road.
  if (index === 3) {
    const car = makeCar(world.rng, 3000, 1500, 'sports');
    car.angle = Math.PI / 2;
    car.driver = null;
    car.missionTarget = true;
    world.missionCar = car;
    world.cars.push(car);
    world.checkpoints = [
      { x: 600, y: 600 }, { x: 2700, y: 2700 }, { x: 300, y: 300 },
    ];
    world.checkpointIndex = 0;
  }
  // Mission 5: five rivals hold the Strip.
  if (index === 4) {
    world.rivals = [];
    for (let i = 0; i < 5; i++) {
      const r = makePedestrian(world.rng, 900 + world.rng.range(-260, 260), 1800 + world.rng.range(-260, 260));
      r.state = 'walk';
      r.rival = true;
      r.health = 100;
      r.shirt = '#1a1a1a';
      world.rivals.push(r);
    }
  }
  saveGame(world);
}

function addWanted(world, stars) {
  const before = world.wanted;
  world.wanted = Math.min(WANTED.maxStars, world.wanted + stars);
  if (world.wanted > before) {
    world.wantedTimer = 0;
    world.events.push('siren');
  }
}

export function commitCrime(world, kind) {
  world.crimes += 1;
  if (kind === 'steal') addWanted(world, WANTED.stealCar);
  if (kind === 'punch') addWanted(world, WANTED.punchPed);
  if (kind === 'kill') addWanted(world, WANTED.killPed);
  if (kind === 'shoot') addWanted(world, WANTED.shoot);
}

function spawnPolice(world) {
  const want = WANTED.policePerStar[world.wanted] || 0;
  while (world.police.length < want) {
    const angle = world.rng.range(0, Math.PI * 2);
    const dist = 750;
    const x = Math.max(60, Math.min(3540, world.player.x + Math.cos(angle) * dist));
    const y = Math.max(60, Math.min(3540, world.player.y + Math.sin(angle) * dist));
    world.police.push(makePoliceCar(world.rng, x, y));
  }
  while (world.police.length > want) world.police.pop();
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function nearestPed(world, x, y, maxDist, includeRivals = true) {
  let best = null;
  let bestD = maxDist;
  const list = includeRivals ? [...world.peds, ...world.rivals] : world.peds;
  for (const ped of list) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  return best;
}

export function enterCar(world, car) {
  const p = world.player;
  p.inCar = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  p.vx = 0;
  p.vy = 0;
  world.events.push('car');
  if (car.missionTarget) {
    // Rico cleared the heat on the job car — no wanted for this one.
  } else if (!car.stolen) {
    car.stolen = true;
    commitCrime(world, 'steal');
    world.toasts.push({ text: 'Car stolen — the cops noticed.', t: 3 });
  }
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  const side = nearestRoadPoint(car.x, car.y);
  p.x = Math.max(20, Math.min(3580, car.x + Math.cos(car.angle + Math.PI / 2) * 40));
  p.y = Math.max(20, Math.min(3580, car.y + Math.sin(car.angle + Math.PI / 2) * 40));
  p.inCar = null;
  void side;
}

function firePistol(world) {
  const p = world.player;
  if (p.fireTimer > 0 || p.ammo <= 0) return;
  p.fireTimer = PISTOL.fireCooldown;
  p.ammo -= 1;
  p.muzzle = 0.08;
  world.events.push('shot');
  const aim = p.aimAngle ?? p.angle;
  let best = null;
  let bestD = PISTOL.range;
  // Only people can be shot — police cars are armoured, bullets just spark.
  for (const target of [...world.peds, ...world.rivals]) {
    if (target.state === 'down') continue;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > PISTOL.range || d < 1) continue;
    const ang = Math.atan2(dy, dx);
    let diff = ang - aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < PISTOL.aimTolerance && d < bestD) {
      best = target;
      bestD = d;
    }
  }
  if (best) {
    best.health -= PISTOL.damage;
    if (best.health <= 0) {
      best.state = 'down';
      if (best.rival) {
        world.kills += 1;
        if (world.mission?.def.steps[world.mission.step]?.type === 'defeat') {
          world.mission.done += 1;
        }
      } else {
        commitCrime(world, 'kill');
      }
      world.events.push('down');
    }
  }
  if (p.ammo === 0 && p.reserve > 0) {
    const reload = Math.min(PISTOL.magSize, p.reserve);
    p.reserve -= reload;
    p.ammo = reload;
    world.toasts.push({ text: 'Reloaded.', t: 1.5 });
  }
}

function punch(world) {
  const p = world.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = PLAYER.punchCooldown;
  p.punchAnim = 0.22;
  world.events.push('punch');
  const target = nearestPed(world, p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, PLAYER.punchRange);
  if (!target) return;
  target.health -= PLAYER.punchDamage;
  if (target.health <= 0) {
    target.state = 'down';
    if (target.rival) {
      world.kills += 1;
      if (world.mission?.def.steps[world.mission.step]?.type === 'defeat') world.mission.done += 1;
    } else {
      commitCrime(world, 'kill');
    }
  } else {
    commitCrime(world, 'punch');
    target.state = 'flee';
    target.fleeTimer = 3;
  }
}

function tryShop(world) {
  const p = world.player;
  const near = (place) => Math.hypot(p.x - place.x, p.y - place.y) < 90;
  const pl = world.places;
  if (p.inCar && near(pl.spray)) {
    if (world.money >= PRICES.spray && world.wanted > 0) {
      world.money -= PRICES.spray;
      world.wanted = 0;
      world.police = [];
      p.inCar.color = ['#3c78d8', '#7a4fd0', '#3cae6e'][world.rng.int(0, 2)];
      world.toasts.push({ text: "Pay 'n' Spray — fresh paint, clean slate. -$200", t: 3 });
      world.events.push('cash');
    } else if (world.wanted === 0) {
      world.toasts.push({ text: "Pay 'n' Spray — no heat to clear.", t: 2 });
    } else {
      world.toasts.push({ text: "Pay 'n' Spray costs $200 — you're short.", t: 2 });
    }
    return;
  }
  if (!p.inCar && near(pl.gunShop)) {
    if (world.money >= PRICES.ammo) {
      world.money -= PRICES.ammo;
      p.reserve += 48;
      world.toasts.push({ text: 'Ammo bought: +48 rounds. -$50', t: 2 });
      world.events.push('cash');
    } else world.toasts.push({ text: 'Ammo costs $50 — not enough cash.', t: 2 });
    return;
  }
  if (!p.inCar && near(pl.burger)) {
    if (world.money >= PRICES.burger && p.health < PLAYER.maxHealth) {
      world.money -= PRICES.burger;
      p.health = Math.min(PLAYER.maxHealth, p.health + 50);
      world.toasts.push({ text: 'Burger Shot — feeling better. -$15', t: 2 });
      world.events.push('cash');
    } else if (p.health >= PLAYER.maxHealth) {
      world.toasts.push({ text: 'You are already at full health.', t: 2 });
    } else world.toasts.push({ text: 'A burger costs $15 — not enough cash.', t: 2 });
    return;
  }
  if (!p.inCar && near(pl.clothes)) {
    if (world.money >= PRICES.clothes) {
      world.money -= PRICES.clothes;
      world.toasts.push({ text: 'New threads — looking sharp. -$80', t: 2 });
      world.events.push('cash');
    } else world.toasts.push({ text: 'Threads cost $80 — not enough cash.', t: 2 });
    return;
  }
}

function updateFare(world, dt) {
  const p = world.player;
  if (!p.inCar || world.mission) {
    world.fare = null;
    return;
  }
  if (!world.fare) {
    world.fareTimer -= dt;
    if (world.fareTimer <= 0) {
      const spot = nearestRoadPoint(p.x + world.rng.range(-700, 700), p.y + world.rng.range(-700, 700));
      world.fare = { phase: 'pickup', x: Math.max(60, Math.min(3200, spot.x)), y: Math.max(60, Math.min(3500, spot.y)), timer: 60 };
      world.toasts.push({ text: 'Taxi fare nearby — pick up the passenger.', t: 3 });
    }
    return;
  }
  world.fare.timer -= dt;
  const d = Math.hypot(p.x - world.fare.x, p.y - world.fare.y);
  if (d < 70) {
    if (world.fare.phase === 'pickup') {
      const dest = nearestRoadPoint(p.x + world.rng.range(-900, 900), p.y + world.rng.range(-900, 900));
      world.fare = { phase: 'dropoff', x: Math.max(60, Math.min(3200, dest.x)), y: Math.max(60, Math.min(3500, dest.y)), timer: 75 };
      world.toasts.push({ text: 'Passenger aboard — take them to the marker.', t: 3 });
    } else {
      world.money += TAXI_FARE;
      world.toasts.push({ text: `Fare complete — +$${TAXI_FARE}.`, t: 3 });
      world.events.push('cash');
      world.fare = null;
      world.fareTimer = 10;
      saveGame(world);
    }
  }
  if (world.fare && world.fare.timer <= 0) {
    world.toasts.push({ text: 'Fare expired — the passenger gave up.', t: 3 });
    world.fare = null;
    world.fareTimer = 12;
  }
}

function updateMission(world, dt) {
  const m = world.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = world.player;

  if (step.type === 'enterCar') {
    if (p.inCar && p.inCar.missionTarget) advanceStep(world);
    return;
  }
  if (step.type === 'reach') {
    const target = stepTarget(world, m, step);
    if (!target) return;
    if (step.onFoot && p.inCar) return;
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (step.heat && m.stepStarted !== true) {
      // First time closing in: the heat turns up.
      if (d < 400) {
        m.stepStarted = true;
        addWanted(world, step.heat);
      }
    }
    if (d < step.radius) advanceStep(world);
    return;
  }
  if (step.type === 'survive') {
    if (!m.stepStarted) {
      m.stepStarted = true;
      m.timer = step.seconds;
      addWanted(world, step.heat);
    }
    m.timer -= dt;
    if (m.timer <= 0) advanceStep(world);
    return;
  }
  if (step.type === 'checkpoints') {
    if (!m.stepStarted) {
      m.stepStarted = true;
      m.timer = step.seconds;
    }
    m.timer -= dt;
    const cp = world.checkpoints[world.checkpointIndex];
    if (cp && p.inCar) {
      const d = Math.hypot(p.x - cp.x, p.y - cp.y);
      if (d < 90) {
        world.checkpointIndex += 1;
        m.done += 1;
        world.events.push('cash');
        world.toasts.push({ text: `Checkpoint ${m.done}/3!`, t: 2 });
        if (m.done >= 3) {
          advanceStep(world);
          return;
        }
      }
    }
    if (m.timer <= 0) {
      // Out of time: restart this step, not the whole mission.
      m.stepStarted = false;
      m.timer = step.seconds;
      m.done = 0;
      world.checkpointIndex = 0;
      world.toasts.push({ text: 'Too slow — the checkpoints reset.', t: 3 });
    }
    return;
  }
  if (step.type === 'defeat') {
    if (m.done >= step.count) advanceStep(world);
    return;
  }
}

function advanceStep(world) {
  const m = world.mission;
  m.step += 1;
  m.stepStarted = false;
  m.timer = 0;
  if (m.step >= m.def.steps.length) {
    const payout = m.def.payout;
    world.money += payout;
    world.toasts.push({ text: `Mission complete: ${m.def.name} — +$${payout}`, t: 5 });
    world.events.push('mission');
    const next = m.index + 1;
    world.mission = null;
    world.missionCar = null;
    saveGame(world);
    if (next < MISSIONS.length) startMission(world, next);
    else {
      world.toasts.push({ text: 'All missions complete — Neon Bay is yours.', t: 6 });
    }
  } else {
    saveGame(world);
  }
}

function collideCars(world) {
  const p = world.player;
  // Player car vs traffic: scrape speed off, small health cost on hard hits.
  if (p.inCar) {
    for (const car of world.cars) {
      if (car === p.inCar || car.driver === 'police') continue;
      const d = Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y);
      if (d < 48) {
        const push = 60;
        const ang = Math.atan2(car.y - p.inCar.y, car.x - p.inCar.x);
        car.x += Math.cos(ang) * push * 0.016;
        car.y += Math.sin(ang) * push * 0.016;
        if (Math.abs(p.inCar.speed) > 260) {
          p.health -= 2;
          p.inCar.speed *= 0.82;
        }
      }
    }
  }
  // Police ramming.
  for (const cop of world.police) {
    const target = p.inCar ?? p;
    const d = Math.hypot(cop.x - target.x, cop.y - target.y);
    if (d < 52) {
      if (p.inCar) {
        p.inCar.speed *= 0.86;
        p.health -= 3;
        cop.speed *= 0.5;
        world.events.push('crash');
      } else if (world.wanted > 0) {
        bustPlayer(world);
        return;
      }
    }
  }
  // Player car running over pedestrians: a crime, and it slows the car.
  if (p.inCar) {
    for (const ped of [...world.peds, ...world.rivals]) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y);
      if (d < 34 && Math.abs(p.inCar.speed) > 60) {
        ped.state = 'down';
        ped.health = 0;
        if (ped.rival) {
          world.kills += 1;
          if (world.mission?.def.steps[world.mission.step]?.type === 'defeat') world.mission.done += 1;
        } else {
          commitCrime(world, 'kill');
        }
        p.inCar.speed *= 0.7;
      }
    }
  }
}

function bustPlayer(world) {
  const p = world.player;
  world.busted = true;
  world.respawnTimer = 2.5;
  world.wanted = 0;
  world.police = [];
  const fine = Math.min(world.money, WANTED.bustFine);
  world.money -= fine;
  world.toasts.push({ text: `BUSTED — the cops took $${fine}.`, t: 4 });
  world.events.push('busted');
  saveGame(world);
}

function wastePlayer(world) {
  const p = world.player;
  world.wasted = true;
  world.respawnTimer = 2.5;
  world.wanted = 0;
  world.police = [];
  const fine = Math.min(world.money, WANTED.wastedFine);
  world.money -= fine;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  world.toasts.push({ text: `WASTED — the hospital patched you up. -$${fine}`, t: 4 });
  world.events.push('wasted');
  saveGame(world);
}

function respawn(world) {
  const p = world.player;
  p.health = PLAYER.maxHealth;
  p.x = world.places.hospital.x;
  p.y = world.places.hospital.y;
  p.inCar = null;
  world.busted = false;
  world.wasted = false;
  world.wanted = 0;
  world.police = [];
}

// --- save / load ------------------------------------------------------------

export function saveGame(world) {
  try {
    const data = {
      money: world.money,
      missionIndex: world.missionIndex,
      missionStep: world.mission?.step ?? 0,
      health: world.player.health,
      ammo: world.player.ammo,
      reserve: world.player.reserve,
      x: world.player.x,
      y: world.player.y,
      time: world.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, headless): the game still runs.
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

// --- main update --------------------------------------------------------------

export function updateWorld(world, input, dt) {
  const p = world.player;
  world.playTime += dt;
  world.time = (START_TIME_HOURS + world.playTime / DAY_LENGTH_SECONDS * 24) % 24;

  // Toasts age out.
  for (const t of world.toasts) t.t -= dt;
  world.toasts = world.toasts.filter((t) => t.t > 0);

  if (world.busted || world.wasted) {
    world.respawnTimer -= dt;
    if (world.respawnTimer <= 0) respawn(world);
    return;
  }

  // Aim: mouse position in world space, or the facing direction on foot.
  if (input.aimX !== undefined && input.aimY !== undefined) {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }

  if (input.interact) {
    input.interact = false;
    if (p.inCar) {
      exitCar(world);
    } else {
      const car = nearestCar(world, p.x, p.y, CAR.enterRadius);
      if (car) enterCar(world, car);
      else tryShop(world);
    }
  }
  if (input.punch) {
    input.punch = false;
    if (!p.inCar) punch(world);
  }
  if (input.fire) {
    if (!p.inCar) firePistol(world);
  }

  if (p.inCar) {
    updateDrivenCar(p.inCar, input, dt, world.city);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    const speed = Math.abs(p.inCar.speed);
    world.stats.topSpeed = Math.max(world.stats.topSpeed, speed);
    world.stats.distanceDriven += speed * dt;
    p.muzzle = Math.max(0, p.muzzle - dt);
  } else {
    updatePlayerOnFoot(p, input, dt, world.city);
  }

  // Traffic and crowds.
  for (const car of world.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, dt, world.city, world.cars, world.rng);
  }
  const threat = p.inCar ? null : p;
  for (const ped of world.peds) updatePedestrian(ped, dt, world.city, threat, world.rng);
  for (const rival of world.rivals) {
    updatePedestrian(rival, dt, world.city, threat, world.rng);
    // Rivals close in and swing when the player is near.
    if (rival.state !== 'down') {
      const d = Math.hypot(rival.x - p.x, rival.y - p.y);
      if (d < 300 && !p.inCar) {
        rival.targetAngle = Math.atan2(p.y - rival.y, p.x - rival.x);
        rival.speed = 130;
        if (d < 30) {
          p.health -= 12 * dt;
          rival.punchAnim = 0.2;
        }
      }
    }
  }

  // Wanted: police spawn and chase; stars fade when the heat dies down.
  spawnPolice(world);
  for (const cop of world.police) {
    updatePoliceCar(cop, dt, p.inCar ?? p, world.city);
  }
  if (world.wanted > 0) {
    const nearestCop = world.police.reduce((best, cop) => {
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      return best === null || d < best ? d : best;
    }, null);
    if (nearestCop === null || nearestCop > 900) {
      world.wantedTimer += dt;
      if (world.wantedTimer >= WANTED.decaySeconds) {
        world.wanted -= 1;
        world.wantedTimer = 0;
        world.toasts.push({ text: 'The heat is cooling off…', t: 2 });
      }
    } else {
      world.wantedTimer = 0;
    }
  }

  collideCars(world);
  updateMission(world, dt);
  updateFare(world, dt);

  // Slow health regen out of combat.
  if (p.health < PLAYER.maxHealth && world.wanted === 0) {
    p.health = Math.min(PLAYER.maxHealth, p.health + 2 * dt);
  }
  if (p.health <= 0) {
    wastePlayer(world);
  }

  // Autosave every 10 seconds of play.
  world.saveTimer += dt;
  if (world.saveTimer > 10) {
    world.saveTimer = 0;
    saveGame(world);
  }

  // Keep the player out of the water on foot.
  if (!p.inCar && isWater(p.x, p.y)) {
    p.x = Math.max(20, Math.min(3290, p.x));
  }
}

export function districtNameAt(world, x, y) {
  return districtAt(x, y).name;
}
