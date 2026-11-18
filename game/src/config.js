// VICE HEAT — Neon Bay. World constants and tuning for the open-world crime game.
// Everything here is original: the city, its districts, vehicles and names are our own.
export const STEP = 1 / 60;
export const SAVE_KEY = 'vice-heat-save-v1';
export const BEST_KEY = 'vice-heat-best-v1';

// World: a coastal city grid. Roads run every BLOCK+ROAD px; the east edge is the beach.
export const WORLD = {
  size: 3600,
  roadGap: 420, // distance between road centre lines
  roadWidth: 96,
  sidewalk: 18,
  beachX: 3300, // sand starts here; water past 3480
  waterX: 3480,
};

export const DISTRICTS = [
  { name: 'Neon Bay', x: 0, y: 0, w: 1200, h: 1200, tint: '#ff2e88' },
  { name: 'Old Docks', x: 0, y: 1200, w: 1200, h: 1200, tint: '#3aa7ff' },
  { name: 'Palm Heights', x: 1200, y: 0, w: 1200, h: 1200, tint: '#ffb03a' },
  { name: 'The Strip', x: 1200, y: 1200, w: 1200, h: 1200, tint: '#b44bff' },
  { name: 'Sunset Beach', x: 2400, y: 0, w: 1200, h: 2400, tint: '#2ee6a8' },
  { name: 'Harbor Point', x: 2400, y: 2400, w: 1200, h: 1200, tint: '#ff5a3a' },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  runSpeed: 235,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 560,
  maxReverse: 160,
  turnRate: 3.2,
  grip: 3.2,
};

export const TRAFFIC = { count: 26, speed: 150, safeGap: 70 };
export const PEDS = { count: 34, speed: 46 };
export const POLICE = { carSpeed: 520, footSpeed: 205, ramDamage: 8, spawnDistance: 700 };

// Wanted: stars 0..5. Crimes add heat; heat decays when the player is unseen and quiet.
export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  decaySeconds: 26,
  bustDistance: 46,
  maxStars: 5,
};

export const ECONOMY = {
  startCash: 120,
  pistolPrice: 500,
  ammoPrice: 120,
  ammoPack: 24,
  sprayPrice: 200, // Pay 'n' Spray: clears wanted
  taxiFare: 90,
  missionPay: [400, 650, 900, 1400, 2500],
};

export const MISSIONS = [
  { id: 'wheels', title: 'First Wheels', giver: 'Rico', pay: 400 },
  { id: 'drop', title: 'The Drop', giver: 'Rico', pay: 650 },
  { id: 'pursuit', title: 'Hot Pursuit', giver: 'Mara', pay: 900 },
  { id: 'getaway', title: 'The Getaway', giver: 'Mara', pay: 1400 },
  { id: 'king', title: 'Neon King', giver: 'Rico', pay: 2500 },
];

export const DAY_LENGTH = 300; // seconds per full day/night cycle

export const VIEW = { width: 1280, height: 720 };
