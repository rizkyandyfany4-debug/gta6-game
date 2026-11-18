// Entities: cars (player-driven, traffic, police), pedestrians, pickups and bullets.
// Car physics are one shared arcade model: a signed speed along the heading, steering
// that bites harder the faster the car goes, and a soft bounce off buildings.
import { CAR, TRAFFIC, PEDS, PLAYER, WORLD } from './config.js';
import { circleHitsBuilding, isInWater } from './city.js';

export const CAR_MODELS = [
  { name: 'Comet', color: '#e33e3e', top: 600 },
  { name: 'Sunrise', color: '#f2a541', top: 520 },
  { name: 'Oceanic', color: '#3a86d8', top: 540 },
  { name: 'Lime', color: '#7ed321', top: 500 },
  { name: 'Violet', color: '#9b59d0', top: 560 },
  { name: 'Pearl', color: '#e8e8e8', top: 520 },
  { name: 'Taxi', color: '#f7d117', top: 500 },
  { name: 'Van', color: '#8a6d4b', top: 420 },
];

export function makeCar(rng, kind, x, y, angle) {
  const model = kind === 'police'
    ? { name: 'Interceptor', color: '#1c2733', top: 620 }
    : kind === 'taxi'
      ? CAR_MODELS[6]
      : CAR_MODELS[Math.floor(rng.next() * 6)];
  return {
    kind, x, y, angle,
    speed: 0,
    steer: 0,
    color: model.color,
    topSpeed: model.top,
    name: model.name,
    health: 100,
    driver: kind !== 'police',
    parked: false,
    // traffic AI
    axis: 'x',
    dir: 1,
    lane: 24,
    targetX: x,
    targetY: y,
    stuck: 0,
    // police AI
    ramCooldown: 0,
    sirenPhase: rng ? rng.next() * 6 : 0,
  };
}

/** One physics step for any car. `drive` is {throttle:-1..1, steer:-1..1} or null (parked). */
export function stepCar(car, dt, city, drive) {
  if (drive) {
    const maxF = car.topSpeed;
    if (drive.throttle > 0) car.speed += CAR.accel * drive.throttle * dt;
    else if (drive.throttle < 0) {
      if (car.speed > 20) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * 1.6 * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    if (car.speed > maxF) car.speed = maxF;
    if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
    // Steering bites even at low speed (arcade feel): a slow car can still
    // make a tight corner, which is what the city grid demands.
    const grip = Math.min(1, 0.45 + Math.abs(car.speed) / 400);
    car.angle += drive.steer * CAR.turnRate * grip * Math.sign(car.speed || 1) * dt;
  } else {
    car.speed -= car.speed * 2.5 * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car with a bounce; the beach and water stop it dead.
  const hit = circleHitsBuilding(city, nx, ny, CAR.width / 2 + 4);
  if (hit) {
    car.speed *= -0.32;
    car.health -= Math.abs(car.speed) * 0.02 + 2;
    return { crashed: true };
  }
  if (nx < 20 || nx > WORLD.size - 20 || ny < 20 || ny > WORLD.size - 20 || isInWater(nx)) {
    car.speed *= -0.3;
    return { crashed: true };
  }
  car.x = nx;
  car.y = ny;
  return { crashed: false };
}

/** Keep two cars from overlapping: push apart and trade a little speed.
 *  A parked car is immovable: the other car is pushed clear and stopped. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = 44;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const ux = dx / d;
  const uy = dy / d;
  if (a.parked && !b.parked) {
    b.x += ux * (min - d);
    b.y += uy * (min - d);
    b.speed = 0;
    return true;
  }
  if (b.parked && !a.parked) {
    a.x -= ux * (min - d);
    a.y -= uy * (min - d);
    a.speed = 0;
    return true;
  }
  const push = (min - d) / 2;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.6;
  b.speed = avg * 0.6;
  a.health -= 2;
  b.health -= 2;
  return true;
}

export function makePed(rng, city) {
  const road = rng.pick(city.roadsX);
  const along = rng.range(100, WORLD.size - 100);
  const side = rng.chance(0.5) ? 1 : -1;
  return {
    x: road + side * (WORLD.roadWidth / 2 + 10),
    y: along,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    targetX: 0,
    targetY: 0,
    state: 'walk', // walk | flee | down | cop
    downTimer: 0,
    fleeTimer: 0,
    color: rng.pick(['#e8b48a', '#c98a5a', '#8a5a3a', '#f2d0a0']),
    shirt: rng.pick(['#d83a3a', '#3a86d8', '#2ea86a', '#e8c832', '#9b59d0', '#e8e8e8']),
    wait: rng.range(0, 2),
  };
}

export function pedPickTarget(rng, ped, city) {
  const road = rng.pick(city.roadsX);
  const along = rng.range(100, WORLD.size - 100);
  const side = rng.chance(0.5) ? 1 : -1;
  ped.targetX = road + side * (WORLD.roadWidth / 2 + 10);
  ped.targetY = along;
}

/** One step for a pedestrian: wander the sidewalks, flee danger, stay out of the water. */
export function stepPed(ped, dt, city, threat) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.state = 'walk';
      ped.wait = 1;
    }
    return;
  }
  let speed = PEDS.speed;
  let tx = ped.targetX;
  let ty = ped.targetY;
  if (ped.state === 'flee' && threat) {
    ped.fleeTimer -= dt;
    const dx = ped.x - threat.x;
    const dy = ped.y - threat.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / d) * 200;
    ty = ped.y + (dy / d) * 200;
    speed = PEDS.speed * 2.4;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.speed = 0;
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!circleHitsBuilding(city, nx, ny, 10) && !isInWater(nx) && nx > 16 && nx < WORLD.size - 16 && ny > 16 && ny < WORLD.size - 16) {
    ped.x = nx;
    ped.y = ny;
    ped.speed = speed;
  } else {
    ped.targetX = ped.x;
    ped.targetY = ped.y;
  }
}

export function makePickup(kind, x, y) {
  return { kind, x, y, bob: 0, ttl: 45 };
}

export function makeBullet(x, y, angle, from) {
  return { x, y, angle, speed: 900, from, life: 0.6 };
}

export function stepBullet(b, dt, city) {
  b.x += Math.cos(b.angle) * b.speed * dt;
  b.y += Math.sin(b.angle) * b.speed * dt;
  b.life -= dt;
  if (b.life <= 0) return 'dead';
  if (b.x < 0 || b.y < 0 || b.x > WORLD.size || b.y > WORLD.size) return 'dead';
  if (circleHitsBuilding(city, b.x, b.y, 4)) return 'hit';
  return 'fly';
}

/** Traffic AI: drive along roads, turn at intersections, queue behind cars ahead. */
export function trafficDrive(car, dt, city, cars, rng) {
  // Reached the current target intersection? Pick a new leg.
  const dx = car.targetX - car.x;
  const dy = car.targetY - car.y;
  if (Math.hypot(dx, dy) < 30) {
    const roads = car.axis === 'x' ? city.roadsY : city.roadsX;
    const current = car.axis === 'x' ? car.y : car.x;
    const next = roads[Math.floor(rng.next() * roads.length)];
    if (rng.chance(0.5)) {
      // Turn onto the crossing road.
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.targetX = car.axis === 'x' ? car.x : next;
      car.targetY = car.axis === 'x' ? next : car.y;
      car.lane = rng.chance(0.5) ? 24 : -24;
    } else {
      // Keep going straight to another intersection on the same road.
      const cur = car.axis === 'x' ? car.x : car.y;
      let dest = next;
      if (Math.abs(dest - cur) < 200) dest = cur + (rng.chance(0.5) ? 420 : -420);
      car.targetX = car.axis === 'x' ? dest : car.x;
      car.targetY = car.axis === 'x' ? car.y : dest;
    }
  }
  // Desired heading: along the road toward the target, offset into the lane.
  let desired;
  if (car.axis === 'x') {
    const dir = Math.sign(car.targetX - car.x) || 1;
    // Lane offset: drive on the right side of the road for the direction.
    const laneY = car.targetY + (dir > 0 ? car.lane : -car.lane);
    desired = Math.atan2((laneY - car.y) * 0.35, dir);
  } else {
    const dir = Math.sign(car.targetY - car.y) || 1;
    const laneX = car.targetX + (dir > 0 ? -car.lane : car.lane);
    desired = Math.atan2(dir, (laneX - car.x) * 0.35);
  }
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow down for a car ahead in the same lane.
  let throttle = 0.55;
  const aheadX = car.x + Math.cos(car.angle) * 60;
  const aheadY = car.y + Math.sin(car.angle) * 60;
  for (const other of cars) {
    if (other === car) continue;
    const ox = other.x - aheadX;
    const oy = other.y - aheadY;
    if (ox * ox + oy * oy < TRAFFIC.safeGap * TRAFFIC.safeGap) {
      throttle = 0.1;
      break;
    }
  }
  if (Math.abs(car.speed) < 5) {
    car.stuck += dt;
    if (car.stuck > 3) {
      car.targetX = car.x;
      car.targetY = car.y;
      car.stuck = 0;
    }
  } else car.stuck = 0;
  return { throttle, steer };
}

/** Police pursuit AI: steer toward the player and ram. */
export function policeDrive(car, tx, ty) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.6));
  return { throttle: 1, steer };
}

/** On-foot player movement with building collision and a slide along walls. */
export function movePlayerOnFoot(player, dt, city, vx, vy) {
  const nx = player.x + vx * dt;
  const ny = player.y + vy * dt;
  if (!circleHitsBuilding(city, nx, player.y, PLAYER.radius) && nx > 16 && nx < WORLD.size - 16 && !isInWater(nx)) player.x = nx;
  if (!circleHitsBuilding(city, player.x, ny, PLAYER.radius) && ny > 16 && ny < WORLD.size - 16 && !isInWater(player.x)) player.y = ny;
  if (vx !== 0 || vy !== 0) player.angle = Math.atan2(vy, vx);
  player.moving = vx !== 0 || vy !== 0;
}
