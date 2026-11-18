// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always
// gives the same frame. The four shots are the entry's screenshots:
// 1-start (title over the living city), 2-drive (driving through traffic),
// 3-chase (three-star police chase), 4-mission (the Neon King shootout).
import { STEP, VIEW, WORLD } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const SAMPLE = STEP;

function fakeInput() {
  const keys = new Set();
  const pressed = new Set();
  const input = {
    keys,
    pressed,
    mouse: { x: VIEW.width / 2, y: VIEW.height / 2, down: false, pressed: false },
    isDown(action) { return keys.has(action); },
    wasPressed(action) { return pressed.has(action); },
    mousePressed() { return this.mouse.pressed; },
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (keys.has('up')) y -= 1;
      if (keys.has('down')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    setKey(action, on) {
      if (on) keys.add(action);
      else keys.delete(action);
    },
    press(action) {
      pressed.add(action);
      keys.add(action);
    },
    endFrame() {
      pressed.clear();
      this.mouse.pressed = false;
    },
  };
  return input;
}

function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer a car toward a waypoint with the fake input.
 *  `slow` is false (full throttle), 'ease' (lift off if fast) or 'brake'
 *  (brake if fast). A slow car keeps the gas: it needs speed for the
 *  steering to bite, and it can never reach a corner it never drives to. */
function driveToward(input, player, tx, ty, speed, slow) {
  const desired = Math.atan2(ty - player.y, tx - player.x);
  const diff = angleDiff(desired, player.angle);
  let up = true;
  let down = false;
  if (slow === 'brake' && speed > 150) {
    up = false;
    down = true;
  } else if ((slow === 'ease' || Math.abs(diff) > 0.9) && speed > 180) {
    up = false;
  }
  input.setKey('up', up);
  input.setKey('down', down);
  input.setKey('left', diff < -0.12);
  input.setKey('right', diff > 0.12);
}

/** Road-graph navigation: the nearest intersection, then a Manhattan route
 *  along the roads to the target's nearest intersection, then the target.
 *  Cars can only drive on roads — a straight line to a waypoint would cut
 *  through buildings. */
function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}

function computePath(city, fx, fy, tx, ty) {
  const start = nearestIntersection(city, fx, fy);
  const end = nearestIntersection(city, tx, ty);
  const path = [start];
  let cx = start.x;
  let cy = start.y;
  while (cx !== end.x || cy !== end.y) {
    // Move on ONE axis per step (Manhattan route): x first, then y. Moving
    // both at once would cut diagonally through a city block.
    let nx = cx;
    let ny = cy;
    if (cx !== end.x) nx = cx + Math.sign(end.x - cx) * 420;
    else ny = cy + Math.sign(end.y - cy) * 420;
    // Aim for the correct lane of the segment just driven, not the road
    // centre: a car that turns at the intersection centre cuts the corner
    // and ends up on the pavement against a building.
    let px = nx;
    let py = ny;
    if (nx > cx) py = ny - 24; // eastbound: north lane
    else if (nx < cx) py = ny + 24; // westbound: south lane
    else if (ny > cy) px = nx - 24; // southbound: west lane
    else px = nx + 24; // northbound: east lane
    path.push({ x: px, y: py });
    cx = nx;
    cy = ny;
  }
  path.push({ x: tx, y: ty });
  return path;
}

function makeDriver(city) {
  let path = null;
  let index = 0;
  let target = null;
  return {
    reset() {
      path = null;
      index = 0;
      target = null;
    },
    drive(input, player, tx, ty) {
      if (!target || target.x !== tx || target.y !== ty) {
        target = { x: tx, y: ty };
        path = computePath(city, player.x, player.y, tx, ty);
        index = 0;
      }
      while (index < path.length && Math.hypot(path[index].x - player.x, path[index].y - player.y) < 45) index += 1;
      if (index >= path.length) {
        input.setKey('up', false);
        input.setKey('down', false);
        return true; // arrived
      }
      const node = path[index];
      // Look ahead: if the turn after this node is sharp, brake while
      // approaching it so the car is slow enough (~150 px/s) to make the
      // corner on the road instead of sliding wide into a building. The
      // final node gets the same treatment: the car must arrive at the
      // waypoint, not barrel past it and wedge into a corner.
      let slow = false;
      const dNode = Math.hypot(node.x - player.x, node.y - player.y);
      if (index + 1 < path.length) {
        const a1 = Math.atan2(node.y - player.y, node.x - player.x);
        const a2 = Math.atan2(path[index + 1].y - node.y, path[index + 1].x - node.x);
        let turn = a2 - a1;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        if (Math.abs(turn) > 0.5 && dNode < 300) slow = 'brake';
      } else if (dNode < 300) {
        slow = 'brake';
      }
      const speed = Math.abs(player.inCar ? player.inCar.speed : 0);
      driveToward(input, player, node.x, node.y, speed, slow);
      return false;
    },
  };
}

/** Walk toward a point with the fake input. */
function walkToward(input, player, tx, ty) {
  const dx = tx - player.x;
  const dy = ty - player.y;
  input.setKey('left', dx < -8);
  input.setKey('right', dx > 8);
  input.setKey('up', dy < -8);
  input.setKey('down', dy > 8);
}

function nearestParkedCar(world) {
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (!car.parked) continue;
    const d = (car.x - world.player.x) ** 2 + (car.y - world.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Drive a loop of intersections for `seconds`, stealing a car first if needed. */
function driveScene(world, seconds, wantedAfter) {
  const input = fakeInput();
  const driver = makeDriver(world.city);
  const waypoints = [
    // A rectangular loop around the city: every turn is 90 degrees, never
    // a U-turn (the old loop reversed direction at the first waypoint and
    // the car swung wide into the building on the corner).
    { x: 2310, y: 630 }, { x: 630, y: 630 }, { x: 630, y: 2310 },
    { x: 2310, y: 2310 },
  ];
  let wp = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = world.player;
    if (!p.inCar) {
      const car = nearestParkedCar(world);
      if (car) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < 50) input.press('enter');
        else walkToward(input, p, car.x, car.y);
      }
    } else {
      const target = waypoints[wp];
      if (driver.drive(input, p, target.x, target.y)) wp = (wp + 1) % waypoints.length;
    }
    if (wantedAfter !== null && i === Math.floor(6 / STEP)) world.setWanted(wantedAfter);
    world.step(STEP, input, null);
    input.endFrame();
  }
  return { screen: SCREEN_PLAY, banner: null };
}

/** The final mission's shootout, staged mid-fight. */
function missionScene(world) {
  const input = fakeInput();
  const p = world.player;
  p.hasPistol = true;
  p.ammo = 60;
  world.missions.index = 4;
  world.missions.step = 1; // the shootout step
  world.missions.rivalsLeft = 0;
  world.rivalsSpawned = false;
  const meet = world.city.shops.meet;
  p.x = meet.x - 220;
  p.y = meet.y + 60;
  p.angle = 0;
  const steps = Math.floor(5 / STEP);
  for (let i = 0; i < steps; i += 1) {
    // Strafe around the fight and shoot the nearest rival in bursts, so the
    // frame catches the shootout mid-fight rather than after it is over.
    let nearest = null;
    let nearestD = Infinity;
    for (const r of world.rivals) {
      if (r.state === 'down') continue;
      const d = (r.x - p.x) ** 2 + (r.y - p.y) ** 2;
      if (d < nearestD) {
        nearestD = d;
        nearest = r;
      }
    }
    if (nearest) {
      const aim = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      input.mouse.x = VIEW.width / 2 + Math.cos(aim) * 220;
      input.mouse.y = VIEW.height / 2 + Math.sin(aim) * 220;
      input.mouse.down = Math.floor(world.time * 2) % 2 === 0;
      // Sidestep perpendicular to the aim.
      const strafe = Math.sin(world.time * 0.9) > 0 ? 1 : -1;
      const px = Math.cos(aim + (Math.PI / 2) * strafe);
      const py = Math.sin(aim + (Math.PI / 2) * strafe);
      input.setKey('left', px < -0.3);
      input.setKey('right', px > 0.3);
      input.setKey('up', py < -0.3);
      input.setKey('down', py > 0.3);
      p.angle = aim;
    }
    world.step(STEP, input, null);
    input.endFrame();
  }
  return {
    screen: SCREEN_PLAY,
    banner: { title: 'MISSION 5 — Neon King', text: 'Take out the Neon Kings at Sunset Pier' },
  };
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'drive') return driveScene(world, 24, null);
  if (name === 'chase') return driveScene(world, 26, 3);
  if (name === 'mission') return missionScene(world);
  // start: let the city live for a few seconds behind the title.
  const input = fakeInput();
  for (let i = 0; i < Math.floor(5 / STEP); i += 1) {
    world.step(STEP, input, null);
    input.endFrame();
  }
  return { screen: SCREEN_TITLE, banner: null };
}
