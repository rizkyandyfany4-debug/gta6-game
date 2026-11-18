// The world: everything that moves in Neon Bay and the rules between them.
// Fixed 1/60 s steps, all randomness from the seeded RNG, so a seed plus an input
// script replays exactly — the screenshots and the playtests rely on that.
import { STEP, WORLD, PLAYER, CAR, TRAFFIC, PEDS, POLICE, WANTED, ECONOMY, DAY_LENGTH } from './config.js';
import { buildCity, circleHitsBuilding, districtAt, isInWater } from './city.js';
import {
  makeCar, makePed, makePickup, makeBullet, stepCar, collideCars, stepPed,
  pedPickTarget, stepBullet, trafficDrive, policeDrive, movePlayerOnFoot,
} from './entities.js';
import { createMissionController, createTaxi } from './missions.js';
import { createRandom } from './random.js';

// (Re)initialise the SAME world object in place. Every method closes over that
// one object, so a reset can never leave the simulation and the renderer pointing
// at different worlds — and a fresh RNG from the seed makes a reset deterministic.
function initWorld(world, seed) {
  const rng = createRandom(seed);
  world.rng = rng;
  world.seed = seed;
  const city = buildCity(rng);
  world.city = city;
  world.time = 0;
  world.timeOfDay = 0.32; // morning
  world.cash = ECONOMY.startCash;
  world.wanted = 0;
  world.wantedTimer = 0;
  world.crimeTimer = 0;
  world.events = [];
  world.cars = [];
  world.peds = [];
  world.cops = []; // on-foot police
  world.rivals = [];
  world.bullets = [];
  world.pickups = [];
  world.rivalsSpawned = false;
  world.stats = { carsStolen: 0, fares: 0, missionsDone: 0, pedsHit: 0 };
  world.missions = createMissionController(city);
  world.taxi = createTaxi(rng, city);
  world.over = null; // 'busted' | 'wasted' | null
  world.overTimer = 0;

  world.player = {
    x: city.spawn.x, y: city.spawn.y, angle: 0,
    health: PLAYER.health, armor: 0,
    hasPistol: false, ammo: 0,
    inCar: null, moving: false,
    punchCooldown: 0, shootCooldown: 0,
    bustTimer: 0, busted: false, wasted: false,
  };

  // Seed the streets with traffic and the sidewalks with pedestrians.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const road = rng.pick(city.roadsX);
    const car = makeCar(rng, 'traffic', road, rng.range(200, 3400), rng.chance(0.5) ? 0 : Math.PI);
    car.axis = 'x';
    car.targetX = rng.pick(city.roadsX);
    car.targetY = car.y;
    car.speed = rng.range(80, TRAFFIC.speed);
    world.cars.push(car);
  }
  // Two taxis among the traffic.
  for (let i = 0; i < 2; i += 1) {
    const road = rng.pick(city.roadsY);
    const car = makeCar(rng, 'taxi', rng.range(200, 3400), road, rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    car.axis = 'y';
    car.targetY = rng.pick(city.roadsY);
    car.targetX = car.x;
    car.speed = rng.range(80, TRAFFIC.speed);
    world.cars.push(car);
  }
  for (let i = 0; i < PEDS.count; i += 1) {
    const ped = makePed(rng, city);
    pedPickTarget(rng, ped, city);
    world.peds.push(ped);
  }
  // One parked car on the garage street (road x=630), so the first mission is
  // always doable; two more elsewhere in the city. They never move on their own.
  const parkedSpots = [
    { x: 606, y: 900 }, { x: 1600, y: 1600 }, { x: 3360, y: 900 },
  ];
  for (const spot of parkedSpots) {
    const car = makeCar(rng, 'traffic', spot.x, spot.y, Math.PI / 2);
    car.driver = false;
    car.parked = true;
    car.speed = 0;
    world.cars.push(car);
  }
}

export function createWorld(rng, seed) {
  const world = { rng, seed };

  world.setWanted = function setWanted(stars) {
    world.wanted = Math.max(0, Math.min(WANTED.maxStars, stars));
    world.wantedTimer = WANTED.decaySeconds;
    if (stars > 0) world.events.push('siren');
  };

  world.addHeat = function addHeat(stars) {
    if (world.wanted < WANTED.maxStars) {
      world.wanted = Math.min(WANTED.maxStars, world.wanted + stars);
      world.events.push('siren');
    }
    world.wantedTimer = WANTED.decaySeconds;
    world.crimeTimer = 5;
  };

  world.district = function district() {
    return districtAt(world.player.x, world.player.y);
  };

  world.reset = function reset() {
    initWorld(world, world.seed);
  };

  world.saveData = function saveData() {
    return {
      cash: world.cash,
      missionsDone: world.missions.index,
      hasPistol: world.player.hasPistol,
      ammo: world.player.ammo,
      x: Math.round(world.player.x),
      y: Math.round(world.player.y),
      timeOfDay: world.timeOfDay,
    };
  };

  world.loadSave = function loadSave(save) {
    if (!save) return;
    world.cash = save.cash ?? ECONOMY.startCash;
    world.missions.index = save.missionsDone ?? 0;
    world.missions.step = 0;
    world.player.hasPistol = !!save.hasPistol;
    world.player.ammo = save.ammo ?? 0;
    world.player.x = save.x ?? world.city.spawn.x;
    world.player.y = save.y ?? world.city.spawn.y;
    world.timeOfDay = save.timeOfDay ?? 0.32;
  };

  world.step = function step(dt, input, audio) {
    if (world.over) {
      world.overTimer += dt;
      return;
    }
    world.time += dt;
    world.timeOfDay = (world.timeOfDay + dt / DAY_LENGTH) % 1;
    const p = world.player;
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    world.crimeTimer = Math.max(0, world.crimeTimer - dt);

    // ---- Wanted decay: quiet for a while and the heat drops a star. ----
    if (world.wanted > 0 && world.crimeTimer <= 0) {
      world.wantedTimer -= dt;
      if (world.wantedTimer <= 0) {
        world.wanted -= 1;
        world.wantedTimer = WANTED.decaySeconds;
        world.events.push('heat-down');
      }
    }

    // ---- Player: on foot or driving. ----
    if (p.inCar) stepPlayerCar(world, dt, input);
    else stepPlayerOnFoot(world, dt, input);

    // ---- Traffic, police cars, pedestrians, cops, rivals. ----
    stepTraffic(world, dt);
    stepPolice(world, dt);
    // Collisions in stepTraffic can push the player's car AFTER stepPlayerCar
    // already synced the player to it — re-sync here, or the camera, the
    // mission distances and the player all follow a stale position while the
    // car itself drifts away (it compounds over repeated collisions).
    if (p.inCar) {
      p.x = p.inCar.x;
      p.y = p.inCar.y;
      p.angle = p.inCar.angle;
    }
    stepPeds(world, dt);
    stepRivals(world, dt);
    stepBullets(world, dt);
    stepPickups(world, dt);

    // ---- Missions and the taxi job. ----
    const mission = world.missions.current();
    if (mission) {
      const step = world.missions.currentStep();
      if (step && step.type === 'shootout' && !world.rivalsSpawned) {
        // The ambush only springs when the player reaches the meet.
        const dx = world.player.x - step.x;
        const dy = world.player.y - step.y;
        if (dx * dx + dy * dy < 520 * 520) spawnRivals(world, step);
      }
      const event = world.missions.update(world, dt);
      if (event === 'step') world.events.push('step');
      if (event === 'mission') {
        world.stats.missionsDone += 1;
        world.events.push('mission');
        world.rivalsSpawned = false;
      }
      if (event === 'story') {
        world.stats.missionsDone += 1;
        world.events.push('story');
        world.rivalsSpawned = false;
      }
    }
    const taxiEvent = world.taxi.update(dt, p, world);
    if (taxiEvent === 'picked-up') world.events.push('fare-pickup');
    if (taxiEvent === 'paid') {
      world.stats.fares += 1;
      world.events.push('fare-paid');
    }

    // ---- Busted / wasted. ----
    if (p.health <= 0 && !p.wasted) {
      p.wasted = true;
      world.over = 'wasted';
      world.overTimer = 0;
      world.events.push('wasted');
    }
    if (p.bustTimer > 1.2 && !p.busted) {
      p.busted = true;
      world.over = 'busted';
      world.overTimer = 0;
      world.events.push('busted');
    }

    if (audio) {
      const speedRatio = p.inCar ? Math.abs(p.inCar.speed) / p.inCar.topSpeed : 0;
      audio.update(speedRatio, world.wanted);
    }
  };

  initWorld(world, seed);
  return world;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of world.cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function stepPlayerOnFoot(world, dt, input) {
  const p = world.player;
  const city = world.city;
  const mv = input.moveVector();
  const speed = input.isDown('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  movePlayerOnFoot(p, dt, city, mv.x * speed, mv.y * speed);

  // Punch: nearest ped / rival / cop in range and roughly ahead.
  if ((input.wasPressed('attack') || input.mousePressed()) && p.punchCooldown <= 0 && !p.hasPistol) {
    p.punchCooldown = PLAYER.punchCooldown;
    punchAt(world, p.x, p.y, p.angle);
  }
  if (input.wasPressed('attack') && p.punchCooldown <= 0 && p.hasPistol) {
    // Space with a pistol still punches; F shoots.
    p.punchCooldown = PLAYER.punchCooldown;
    punchAt(world, p.x, p.y, p.angle);
  }
  // Shoot toward the mouse (or facing direction when the mouse is centred).
  if ((input.wasPressed('shoot') || (input.mouse.down && p.shootCooldown <= 0)) && p.hasPistol && p.ammo > 0 && p.shootCooldown <= 0) {
    p.shootCooldown = PLAYER.pistolCooldown;
    p.ammo -= 1;
    const aim = Math.atan2(input.mouse.y - 360, input.mouse.x - 640);
    const angle = Number.isFinite(aim) ? aim : p.angle;
    world.bullets.push(makeBullet(p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, angle, 'player'));
    world.events.push('shot');
    world.addHeat(0); // firing alone is loud; the heat comes from hitting someone
    world.crimeTimer = 5;
    scarePeds(world, p.x, p.y, 300);
  }

  // Enter a car, or use a shop door.
  if (input.wasPressed('enter')) {
    if (tryShop(world)) return;
    const car = nearestCar(world, p.x, p.y, 56);
    if (car) {
      p.inCar = car;
      car.parked = false;
      p.x = car.x;
      p.y = car.y;
      if (car.driver) {
        // Pull the driver out onto the sidewalk as a pedestrian.
        const driver = makePed(world.rng, city);
        driver.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        driver.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
        driver.state = 'flee';
        driver.fleeTimer = 4;
        pedPickTarget(world.rng, driver, city);
        world.peds.push(driver);
        car.driver = false;
        world.stats.carsStolen += 1;
        world.addHeat(WANTED.stealCar);
        world.events.push('steal');
      } else {
        world.events.push('enter');
      }
    }
  }
}

function punchAt(world, x, y, angle) {
  const targets = [...world.peds, ...world.cops, ...world.rivals];
  let hit = false;
  for (const t of targets) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.punchRange + 12) continue;
    const toTarget = Math.atan2(dy, dx);
    let diff = toTarget - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.3) continue;
    hit = true;
    if (t.health === undefined) t.health = 30;
    t.health -= PLAYER.punchDamage;
    t.state = 'flee';
    t.fleeTimer = 2;
    if (t.health <= 0) {
      t.state = 'down';
      t.downTimer = 6;
      if (t.kind === 'rival') {
        world.missions.rivalsLeft -= 1;
        world.events.push('rival-down');
        dropCash(world, t.x, t.y);
      } else if (t.kind === 'cop') {
        world.addHeat(WANTED.killCop);
      }
    }
    break;
  }
  if (hit) world.events.push('punch');
}

function stepPlayerCar(world, dt, input) {
  const p = world.player;
  const car = p.inCar;
  const mv = input.moveVector();
  const drive = {
    throttle: mv.y !== 0 ? -mv.y : 0, // up = accelerate
    steer: mv.x,
  };
  // W/S double as throttle when driving: up accelerates, down brakes/reverses.
  if (input.isDown('up')) drive.throttle = 1;
  if (input.isDown('down')) drive.throttle = -1;
  if (input.isDown('left')) drive.steer = -1;
  if (input.isDown('right')) drive.steer = 1;
  const result = stepCar(car, dt, world.city, drive);
  if (result.crashed) world.events.push('crash');
  if (input.wasPressed('horn')) world.events.push('horn');
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.moving = Math.abs(car.speed) > 10;
  if (input.wasPressed('enter')) {
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    car.speed = 0;
    world.events.push('exit');
  }
  // Hitting a pedestrian at speed is a crime.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    if (dx * dx + dy * dy < 34 * 34 && Math.abs(car.speed) > 120) {
      ped.state = 'down';
      ped.downTimer = 8;
      world.stats.pedsHit += 1;
      world.addHeat(WANTED.hitPed);
      world.events.push('hit-ped');
      if (world.rng.chance(0.4)) dropCash(world, ped.x, ped.y);
    }
  }
}

function dropCash(world, x, y) {
  world.pickups.push(makePickup('cash', x + world.rng.range(-14, 14), y + world.rng.range(-14, 14)));
}

function scarePeds(world, x, y, radius) {
  for (const ped of world.peds) {
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius && ped.state !== 'down') {
      ped.state = 'flee';
      ped.fleeTimer = 3;
    }
  }
}

// Shops: standing on a shop door and pressing E spends money instead of entering a car.
function tryShop(world) {
  const p = world.player;
  const shops = world.city.shops;
  const near = (place, r = 52) => {
    const dx = p.x - place.x;
    const dy = p.y - place.y;
    return dx * dx + dy * dy < r * r;
  };
  if (near(shops.gunshop)) {
    if (!p.hasPistol && world.cash >= ECONOMY.pistolPrice) {
      world.cash -= ECONOMY.pistolPrice;
      p.hasPistol = true;
      p.ammo = ECONOMY.ammoPack;
      world.events.push('bought');
      return true;
    }
    if (p.hasPistol && world.cash >= ECONOMY.ammoPrice) {
      world.cash -= ECONOMY.ammoPrice;
      p.ammo += ECONOMY.ammoPack;
      world.events.push('bought');
      return true;
    }
    world.events.push('no-cash');
    return true;
  }
  if (near(shops.spray)) {
    if (world.wanted > 0 && world.cash >= ECONOMY.sprayPrice) {
      world.cash -= ECONOMY.sprayPrice;
      world.setWanted(0);
      world.events.push('sprayed');
      return true;
    }
    world.events.push('no-cash');
    return true;
  }
  if (near(shops.hospital)) {
    if (p.health < PLAYER.health && world.cash >= 100) {
      world.cash -= 100;
      p.health = PLAYER.health;
      world.events.push('healed');
      return true;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Traffic / police / pedestrians / rivals / bullets / pickups
// ---------------------------------------------------------------------------

function stepTraffic(world, dt) {
  const city = world.city;
  for (const car of world.cars) {
    if (car === world.player.inCar) continue;
    if (car.kind === 'police') continue;
    if (car.speed === 0 && !car.driver) continue; // parked
    const drive = trafficDrive(car, dt, city, world.cars, world.rng);
    stepCar(car, dt, city, drive);
  }
  // Car-to-car collisions.
  const all = world.cars;
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (collideCars(all[i], all[j]) && (all[i] === world.player.inCar || all[j] === world.player.inCar)) {
        world.events.push('crash');
      }
    }
  }
  // Keep the streets full: replace cars that wandered off or died.
  // The player's car is never culled: it is the car the camera follows,
  // and removing it would leave the player driving an invisible car.
  world.cars = world.cars.filter((c) => c.health > -60 || c === world.player.inCar);
  while (world.cars.filter((c) => c.kind === 'traffic' || c.kind === 'taxi').length < TRAFFIC.count + 2) {
    const road = world.rng.pick(city.roadsX);
    const car = makeCar(world.rng, 'traffic', road, world.rng.range(200, 3400), world.rng.chance(0.5) ? 0 : Math.PI);
    car.axis = 'x';
    car.targetX = world.rng.pick(city.roadsX);
    car.targetY = car.y;
    car.speed = world.rng.range(80, TRAFFIC.speed);
    world.cars.push(car);
  }
}

function stepPolice(world, dt) {
  const p = world.player;
  // How many police cars should be hunting right now.
  const wantCars = Math.min(world.wanted, 3);
  const policeCars = world.cars.filter((c) => c.kind === 'police');
  if (policeCars.length < wantCars) {
    const road = world.rng.pick(world.city.roadsX);
    const angle = Math.atan2(p.y - 400, p.x - 400);
    const car = makeCar(world.rng, 'police', p.x + Math.cos(angle + Math.PI) * POLICE.spawnDistance, p.y + Math.sin(angle + Math.PI) * POLICE.spawnDistance, angle);
    car.speed = 200;
    world.cars.push(car);
  }
  if (policeCars.length > wantCars) {
    // Despawn the farthest one.
    let far = null;
    let farD = 0;
    for (const c of policeCars) {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d > farD) {
        farD = d;
        far = c;
      }
    }
    if (far && farD > 900 * 900) world.cars.splice(world.cars.indexOf(far), 1);
  }
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    const drive = policeDrive(car, p.x, p.y);
    const result = stepCar(car, dt, world.city, drive);
    if (result.crashed) world.events.push('crash');
    // Ramming the player's car hurts the player.
    if (p.inCar) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      if (dx * dx + dy * dy < 52 * 52 && Math.abs(car.speed) > 150) {
        car.ramCooldown -= dt;
        if (car.ramCooldown <= 0) {
          car.ramCooldown = 1.2;
          p.health -= POLICE.ramDamage;
          world.events.push('rammed');
        }
      }
      // Busted: boxed in while barely moving.
      if (Math.abs(p.inCar.speed) < 40 && dx * dx + dy * dy < 60 * 60) p.bustTimer += dt;
      else if (p.bustTimer > 0) p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
    }
  }
  // Foot cops when the player is on foot.
  const wantCops = p.inCar ? 0 : Math.min(world.wanted, 3);
  while (world.cops.length < wantCops) {
    const cop = makePed(world.rng, world.city);
    cop.x = p.x + world.rng.range(-500, 500);
    cop.y = p.y + world.rng.range(-500, 500);
    cop.state = 'cop';
    cop.kind = 'cop';
    cop.health = 60;
    cop.shirt = '#1c2733';
    world.cops.push(cop);
  }
  while (world.cops.length > wantCops) world.cops.pop();
  for (const cop of world.cops) {
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    const speed = POLICE.footSpeed;
    const nx = cop.x + (dx / d) * speed * dt;
    const ny = cop.y + (dy / d) * speed * dt;
    if (!circleHitsBuilding(world.city, nx, ny, 10)) {
      cop.x = nx;
      cop.y = ny;
    }
    if (d < 34) {
      // A cop on top of the player starts the bust clock; a punch breaks it.
      p.bustTimer += dt;
      if (world.rng.chance(0.02)) {
        p.health -= 4;
        world.events.push('punched');
      }
    }
  }
  if (world.wanted === 0) p.bustTimer = 0;
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.wait > 0) {
      ped.wait -= dt;
      if (ped.wait <= 0) pedPickTarget(world.rng, ped, world.city);
      continue;
    }
    const threat = world.player.inCar && Math.abs(world.player.inCar.speed) > 200
      ? { x: world.player.x, y: world.player.y }
      : null;
    stepPed(ped, dt, world.city, threat);
    if (Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y) < 14) ped.wait = world.rng.range(1, 5);
  }
}

function spawnRivals(world, step) {
  world.rivalsSpawned = true;
  world.missions.rivalsLeft = step.count;
  for (let i = 0; i < step.count; i += 1) {
    const rival = makePed(world.rng, world.city);
    rival.x = step.x + world.rng.range(-160, 160);
    rival.y = step.y + world.rng.range(-120, 120);
    rival.state = 'rival';
    rival.kind = 'rival';
    rival.health = 100;
    rival.shirt = '#ff2e88';
    rival.shootCooldown = world.rng.range(0.5, 1.5);
    world.rivals.push(rival);
  }
  world.events.push('ambush');
}

function stepRivals(world, dt) {
  const p = world.player;
  for (const rival of world.rivals) {
    if (rival.state === 'down') continue;
    const dx = p.x - rival.x;
    const dy = p.y - rival.y;
    const d = Math.hypot(dx, dy) || 1;
    rival.angle = Math.atan2(dy, dx);
    rival.shootCooldown -= dt;
    if (d > 260) {
      // Close the distance.
      const nx = rival.x + (dx / d) * 90 * dt;
      const ny = rival.y + (dy / d) * 90 * dt;
      if (!circleHitsBuilding(world.city, nx, ny, 10)) {
        rival.x = nx;
        rival.y = ny;
      }
    } else if (rival.shootCooldown <= 0) {
      rival.shootCooldown = world.rng.range(0.9, 1.6);
      const aim = Math.atan2(dy, dx) + world.rng.range(-0.12, 0.12);
      world.bullets.push(makeBullet(rival.x, rival.y, aim, 'rival'));
      world.events.push('shot');
    }
  }
  world.rivals = world.rivals.filter((r) => r.state !== 'down' || r.downTimer > 0);
}

function stepBullets(world, dt) {
  const p = world.player;
  const next = [];
  for (const b of world.bullets) {
    const result = stepBullet(b, dt, world.city);
    if (result === 'dead') continue;
    if (result === 'hit') {
      world.events.push('wall-hit');
      continue;
    }
    let consumed = false;
    if (b.from !== 'player') {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const radius = p.inCar ? 26 : 14;
      if (dx * dx + dy * dy < radius * radius) {
        const damage = p.armor > 0 ? PLAYER.pistolDamage * 0.5 : PLAYER.pistolDamage;
        if (p.armor > 0) p.armor = Math.max(0, p.armor - PLAYER.pistolDamage);
        p.health -= damage;
        world.events.push('player-hit');
        consumed = true;
      }
    } else {
      const targets = [...world.peds, ...world.cops, ...world.rivals];
      for (const t of targets) {
        if (t.state === 'down') continue;
        const dx = t.x - b.x;
        const dy = t.y - b.y;
        if (dx * dx + dy * dy < 20 * 20) {
          if (t.health === undefined) t.health = 30;
          t.health -= PLAYER.pistolDamage;
          world.events.push('hit');
          if (t.health <= 0) {
            t.state = 'down';
            t.downTimer = 8;
            if (t.kind === 'rival') {
              world.missions.rivalsLeft -= 1;
              world.events.push('rival-down');
              dropCash(world, t.x, t.y);
            } else if (t.kind === 'cop') {
              world.addHeat(WANTED.killCop);
            } else {
              world.addHeat(WANTED.hitPed);
            }
          } else {
            t.state = 'flee';
            t.fleeTimer = 2;
          }
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) next.push(b);
  }
  world.bullets = next;
}

function stepPickups(world, dt) {
  const p = world.player;
  const next = [];
  for (const pk of world.pickups) {
    pk.bob += dt;
    pk.ttl -= dt;
    if (pk.ttl <= 0) continue;
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 30 * 30) {
      if (pk.kind === 'cash') {
        const amount = world.rng.int(25, 80);
        world.cash += amount;
        world.events.push('cash');
      } else if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
        world.events.push('pickup');
      } else if (pk.kind === 'ammo') {
        p.ammo += 12;
        world.events.push('pickup');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        world.events.push('pickup');
      }
      continue;
    }
    next.push(pk);
  }
  world.pickups = next;
}
