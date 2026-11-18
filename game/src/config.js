// VICE HEAT: Neon Bay — shared constants and tuning numbers.
// Every number here is a design choice for this build: movement speeds,
// car handling, wanted rules, prices and the layout of the six districts.

export const WORLD_SIZE = 3600;
export const ROAD_SPACING = 300;
export const BEACH_X = 3300;
export const WATER_X = 3460;

export const START_MONEY = 120;
export const START_TIME_HOURS = 18.5; // dusk, the city lights are coming on
export const DAY_LENGTH_SECONDS = 480; // one full day/night cycle, real seconds

// Six districts, laid out as rectangles across the map. The east strip
// (x >= BEACH_X) is sand, then open water — no roads or buildings there.
export const DISTRICTS = [
  { name: 'Neon Bay', x0: 0, y0: 0, x1: 1800, y1: 1200, ground: '#20243a', roof: ['#3b2d5e', '#4a2a52', '#2d3a5e', '#5e2a4a'], neon: '#ff4fd8', label: '#8f7bff' },
  { name: 'Palm Heights', x0: 1800, y0: 0, x1: 3300, y1: 1200, ground: '#232d24', roof: ['#2e4030', '#3a4a2e', '#26403a', '#40502e'], neon: '#7dff6a', label: '#a8e6a1' },
  { name: 'The Strip', x0: 0, y0: 1200, x1: 1800, y1: 2400, ground: '#2b2133', roof: ['#4a2f3a', '#3a2f4a', '#54402a', '#402a3a'], neon: '#ffc233', label: '#ffd166' },
  { name: 'Sunset Beach', x0: 1800, y0: 1200, x1: 3300, y1: 2400, ground: '#38291f', roof: ['#4a3a2a', '#54402e', '#3f3226', '#5e4630'], neon: '#ff7a3c', label: '#ffb08a' },
  { name: 'Old Docks', x0: 0, y0: 2400, x1: 1800, y1: 3600, ground: '#22262b', roof: ['#2f3438', '#38302a', '#2a3238', '#3a3630'], neon: '#4fd2ff', label: '#9fb4c0' },
  { name: 'Harbor Point', x0: 1800, y0: 2400, x1: 3300, y1: 3600, ground: '#1f2a33', roof: ['#2a3844', '#33424e', '#24323c', '#3a4a52'], neon: '#3cffb0', label: '#8fd8b8' },
];

export const PLAYER = {
  walkSpeed: 180,
  runSpeed: 305,
  radius: 14,
  maxHealth: 100,
  punchRange: 50,
  punchDamage: 25,
  punchCooldown: 0.35,
  arrestRadius: 34,
};

export const PISTOL = {
  damage: 34,
  range: 540,
  magSize: 12,
  fireCooldown: 0.22,
  aimTolerance: 0.11, // radians off the aim line that still counts as a hit
  startReserve: 48,
};

export const CAR = {
  maxSpeed: 560, // px/s — the top speed the playtest measures
  reverseSpeed: 190,
  accel: 520,
  brake: 780,
  steerRate: 2.7, // radians per second at full lock, scaled by speed
  grip: 0.86, // how much of the velocity follows the heading each tick
  length: 52,
  width: 26,
  enterRadius: 70,
};

export const TRAFFIC = {
  count: 26,
  speedMin: 130,
  speedMax: 230,
};

export const PEDS = {
  count: 42,
  walkMin: 45,
  walkMax: 85,
  fleeSpeed: 150,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 22, // one star fades after this long with no crime and no police near
  stealCar: 1,
  punchPed: 1,
  killPed: 2,
  shoot: 1,
  policePerStar: [0, 1, 1, 2, 2, 3], // police cars chasing, by star count
  bustFine: 100,
  wastedFine: 150,
};

export const PRICES = {
  spray: 200,
  ammo: 50,
  medkit: 30,
  armor: 100,
  clothes: 80,
  burger: 15,
  taxiFare: 90,
};

export const MISSION_PAYOUTS = [400, 650, 900, 1400, 2500];
export const TAXI_FARE = 90;

export const COLORS = {
  road: '#33363d',
  roadLine: '#c9c25a',
  sidewalk: '#45484f',
  sand: '#c9a86a',
  water: '#1d4e6e',
  waterDeep: '#14405e',
  palm: '#3f7a3a',
  player: '#ffd23c',
  marker: '#ff4fd8',
};
