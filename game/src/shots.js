// VICE HEAT: Neon Bay — staged scenes for screenshots.
// ?shot=<name>&seed=1 builds a fixed scene: the same seed, the same time
// of day, the same positions, the same number of update ticks. The game
// is paused afterwards, so a screenshot taken at that moment is identical
// every run. The four names match shots.json.

import { createWorld, updateWorld } from './world.js';
import { makeCar, makePoliceCar } from './entities.js';

// Settle the world with a fixed number of ticks so traffic and crowds are
// mid-motion, then freeze it for the picture.
function settle(world, ticks = 40) {
  const idle = { up: false, down: false, left: false, right: false, run: false, fire: false };
  for (let i = 0; i < ticks; i++) {
    updateWorld(world, { ...idle }, 1 / 60);
  }
}

export function stageShot(name, seed = 1) {
  const world = createWorld(seed, { started: true, skipMission: false });
  world.started = true;
  const p = world.player;

  if (name === 'start') {
    // Dusk in Neon Bay: the player on foot beside a parked sports car,
    // mission 1 live, the city lights coming on.
    world.time = 18.6;
    p.x = 1350;
    p.y = 450;
    p.angle = -Math.PI / 2;
    const car = makeCar(world.rng, 1420, 450, 'sports');
    car.driver = null;
    car.angle = Math.PI;
    world.cars.push(car);
    settle(world, 30);
  } else if (name === 'drive') {
    // Midday on the Strip, flat out in a sports car.
    world.time = 13.0;
    const car = makeCar(world.rng, 900, 1800, 'sports');
    car.driver = 'player';
    car.angle = 0;
    car.speed = 540;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    world.cars.push(car);
    settle(world, 12);
    car.speed = 540; // hold the speed for the picture
    p.inCar = car;
  } else if (name === 'chase') {
    // Night, five stars, three police cars closing in on the player.
    world.time = 22.5;
    world.wanted = 5;
    p.x = 900;
    p.y = 1800;
    p.angle = Math.PI / 4;
    const car = makeCar(world.rng, 900, 1800, 'coupe');
    car.driver = 'player';
    car.angle = Math.PI / 4;
    car.speed = 420;
    p.inCar = car;
    world.cars.push(car);
    const spots = [
      { x: 620, y: 1560 },
      { x: 1180, y: 1620 },
      { x: 900, y: 2140 },
    ];
    for (const s of spots) {
      const cop = makePoliceCar(world.rng, s.x, s.y);
      world.police.push(cop);
    }
    settle(world, 20);
    world.wanted = 5;
  } else if (name === 'mission') {
    // Mission 1: the player on foot next to the red sports car at the docks,
    // Rico's garage marker glowing to the south.
    world.time = 10.5;
    p.x = 540;
    p.y = 3060;
    p.angle = 0;
    if (world.missionCar) {
      world.missionCar.x = 600;
      world.missionCar.y = 3060;
      world.missionCar.angle = Math.PI / 2;
    }
    settle(world, 30);
  } else {
    // Unknown shot name: fall back to the start scene.
    return stageShot('start', seed);
  }

  world.shotName = name;
  world.shotReady = true;
  return world;
}
