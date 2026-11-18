// VICE HEAT: Neon Bay — the things that move.
// Player, cars (player-driven and traffic), pedestrians and police.
// All motion is plain arcade physics: a heading, a speed, and a little
// grip so cars slide a touch through corners.

import { CAR, PLAYER, PISTOL, TRAFFIC, PEDS } from './config.js';
import { onRoad, nearestRoadPoint, hitsBuilding, isWater } from './city.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++,
    kind: 'player',
    x, y, angle: 0,
    vx: 0, vy: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    money: 0,
    ammo: PISTOL.magSize,
    reserve: PISTOL.startReserve,
    hasPistol: true,
    inCar: null,
    punchTimer: 0,
    fireTimer: 0,
    punchAnim: 0,
    muzzle: 0,
    moving: false,
    running: false,
  };
}

const CAR_COLORS = ['#d8443c', '#3c78d8', '#e8b93c', '#7a4fd0', '#3cae6e', '#d8d8d8', '#222831', '#e07b39'];
const CAR_TYPES = [
  { type: 'sedan', maxSpeed: 470, accel: 480, color: '#d8443c' },
  { type: 'taxi', maxSpeed: 450, accel: 460, color: '#e8b93c' },
  { type: 'sports', maxSpeed: 560, accel: 640, color: '#c22a7a' },
  { type: 'truck', maxSpeed: 380, accel: 360, color: '#5a6b7a' },
  { type: 'coupe', maxSpeed: 520, accel: 560, color: '#3c78d8' },
];

export function makeCar(rng, x, y, forcedType) {
  const spec = forcedType
    ? CAR_TYPES.find((t) => t.type === forcedType) || CAR_TYPES[0]
    : rng.pick(CAR_TYPES);
  return {
    id: nextId++,
    kind: 'car',
    type: spec.type,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    color: forcedType === 'police' ? '#20242c' : spec.color,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    targetSpeed: 0,
    roadDir: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    waitTimer: 0,
    police: forcedType === 'police',
    stolen: false,
    smoke: 0,
  };
}

export function makePoliceCar(rng, x, y) {
  const car = makeCar(rng, x, y, 'police');
  car.driver = 'police';
  car.maxSpeed = 540;
  car.accel = 600;
  return car;
}

export function makePedestrian(rng, x, y) {
  return {
    id: nextId++,
    kind: 'ped',
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(PEDS.walkMin, PEDS.walkMax),
    color: rng.pick(['#e8e0c8', '#c8d8e8', '#e8c8c8', '#d8e8c8', '#e8d8a8']),
    shirt: rng.pick(['#b03a3a', '#3a6ab0', '#3a9a4a', '#b07a3a', '#7a3ab0']),
    state: 'walk', // walk | flee | down
    fleeTimer: 0,
    targetAngle: rng.range(0, Math.PI * 2),
    retarget: rng.range(1, 4),
    health: 50,
  };
}

// --- player on foot -------------------------------------------------------

export function updatePlayerOnFoot(p, input, dt, city) {
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  const len = Math.hypot(mx, my) || 1;
  const running = input.run && (mx !== 0 || my !== 0);
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.vx = (mx / len) * speed;
  p.vy = (my / len) * speed;
  p.moving = mx !== 0 || my !== 0;
  p.running = running;
  if (p.moving) p.angle = Math.atan2(p.vy, p.vx);
  moveWithCollision(p, p.vx * dt, p.vy * dt, city, PLAYER.radius);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
}

function moveWithCollision(e, dx, dy, city, radius) {
  const nx = e.x + dx;
  if (!hitsBuilding(city, nx, e.y, radius) && !isWater(nx, e.y) && nx > radius && nx < 3600 - radius) e.x = nx;
  const ny = e.y + dy;
  if (!hitsBuilding(city, e.x, ny, radius) && !isWater(e.x, ny) && ny > radius && ny < 3600 - radius) e.y = ny;
}

// --- driving ---------------------------------------------------------------

export function updateDrivenCar(car, input, dt, city) {
  const forward = input.up ? 1 : 0;
  const reverse = input.down ? 1 : 0;
  if (forward) {
    car.speed += car.accel * dt;
  } else if (reverse) {
    car.speed -= (car.speed > 0 ? CAR.brake : car.accel * 0.55) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 260 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(car.maxSpeed, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * CAR.steerRate * steerAuthority * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = hitsBuilding(city, nx, ny, 16) || isWater(nx, ny);
  if (hit) {
    car.speed *= -0.25; // bounce off, lose most of the speed
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(20, Math.min(3580, car.x));
  car.y = Math.max(20, Math.min(3580, car.y));
}

// Traffic cars crawl along the road grid: pick a road direction, turn at
// intersections, slow down for the car ahead.
export function updateTrafficCar(car, dt, city, cars, rng) {
  if (car.waitTimer > 0) {
    car.waitTimer -= dt;
    car.speed = Math.max(0, car.speed - 400 * dt);
  } else {
    const target = car.targetSpeed || rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.targetSpeed = target;
    car.speed += Math.sign(target - car.speed) * 220 * dt;
    car.speed = Math.max(0, Math.min(target, car.speed));
  }
  const ahead = carAhead(car, cars, 90);
  if (ahead) {
    car.speed = Math.max(0, car.speed - 500 * dt);
  }
  const onIntersection = Math.abs(car.x % 300) < 26 && Math.abs(car.y % 300) < 26;
  if (onIntersection && rng.chance(0.02)) {
    car.roadDir = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }
  car.angle = car.roadDir;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (onRoad(nx, ny) && !hitsBuilding(city, nx, ny, 14)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Reached the edge of the road network: turn around.
    car.roadDir += Math.PI;
    car.angle = car.roadDir;
  }
}

function carAhead(car, cars, dist) {
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < dist && d > 1) {
      const dot = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
      if (dot > 0.85) return other;
    }
  }
  return null;
}

// Police cars chase the player's position, steering straight at them and
// ramming when they get close.
export function updatePoliceCar(car, dt, target, city) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.9 * dt, Math.min(2.9 * dt, diff));
  const targetSpeed = dist > 320 ? car.maxSpeed : Math.max(300, car.maxSpeed * 0.7);
  car.speed += Math.sign(targetSpeed - car.speed) * 620 * dt;
  car.speed = Math.max(0, Math.min(car.maxSpeed, car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsBuilding(city, nx, ny, 14) && !isWater(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed *= 0.4;
    car.angle += 0.6;
  }
  car.x = Math.max(20, Math.min(3580, car.x));
  car.y = Math.max(20, Math.min(3580, car.y));
}

// --- pedestrians ------------------------------------------------------------

export function updatePedestrian(ped, dt, city, threat, rng) {
  if (ped.state === 'down') return;
  if (threat && !ped.rival) {
    const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
    if (d < 260) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
      ped.targetAngle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    }
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  }
  let speed = ped.speed;
  if (ped.state === 'flee') speed = PEDS.fleeSpeed;
  ped.retarget -= dt;
  if (ped.retarget <= 0) {
    ped.retarget = rng.range(2, 6);
    if (ped.state === 'walk') {
      // Stroll along the sidewalks: pick a road direction.
      const dir = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      ped.targetAngle = dir;
      const snapped = nearestRoadPoint(ped.x, ped.y);
      ped.x = snapped.x + rng.range(-40, 40);
      ped.y = snapped.y + rng.range(-40, 40);
    }
  }
  ped.angle = ped.targetAngle;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!hitsBuilding(city, nx, ny, 8) && !isWater(nx, ny) && nx > 10 && nx < 3590 && ny > 10 && ny < 3590) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.targetAngle += Math.PI / 2;
  }
}
