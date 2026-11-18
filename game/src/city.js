// VICE HEAT: Neon Bay — the city itself.
// A 3600x3600 coastal grid: roads every 300px, buildings packed into the
// blocks between them, sand and water along the east edge. Everything is
// placed by the seeded RNG, so the same seed builds the same city.

import { WORLD_SIZE, ROAD_SPACING, BEACH_X, WATER_X, DISTRICTS, COLORS } from './config.js';

const ROAD_HALF = 34; // half the width of a road, in px

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function isWater(x, y) {
  return x >= WATER_X;
}

export function isBeach(x, y) {
  return x >= BEACH_X && x < WATER_X;
}

// Roads run at multiples of ROAD_SPACING. Returns true when a point is on
// a road (or on the beach road that runs down the sand).
export function onRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return false;
  if (x >= BEACH_X) return false;
  const rx = x % ROAD_SPACING;
  const ry = y % ROAD_SPACING;
  const nearX = Math.min(rx, ROAD_SPACING - rx) <= ROAD_HALF;
  const nearY = Math.min(ry, ROAD_SPACING - ry) <= ROAD_HALF;
  return nearX || nearY;
}

// Snap a point onto the centre line of the nearest road.
export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / ROAD_SPACING) * ROAD_SPACING;
  const gy = Math.round(y / ROAD_SPACING) * ROAD_SPACING;
  if (Math.abs(x - gx) < Math.abs(y - gy)) return { x: gx, y };
  return { x, y: gy };
}

// The centre lines of every road, for traffic to follow.
export function roadLines() {
  const lines = [];
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    lines.push({ x1: v, y1: 0, x2: v, y2: BEACH_X, vertical: true });
    lines.push({ x1: 0, y1: v, x2: BEACH_X, y2: v, vertical: false });
  }
  return lines;
}

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const blocks = [];
  // One building cluster per block, kept clear of the roads.
  for (let bx = 0; bx < WORLD_SIZE / ROAD_SPACING; bx++) {
    for (let by = 0; by < WORLD_SIZE / ROAD_SPACING; by++) {
      const x0 = bx * ROAD_SPACING + ROAD_HALF + 14;
      const y0 = by * ROAD_SPACING + ROAD_HALF + 14;
      const x1 = (bx + 1) * ROAD_SPACING - ROAD_HALF - 14;
      const y1 = (by + 1) * ROAD_SPACING - ROAD_HALF - 14;
      if (x0 >= BEACH_X) continue; // the sand stays empty
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      blocks.push({ x0, y0, x1, y1, district: district.name });
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.range(70, 150);
        const h = rng.range(70, 150);
        const px = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const py = rng.range(y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x: px, y: py, w, h,
          color: rng.pick(district.roof),
          neon: district.neon,
          tall: rng.chance(0.3),
          district: district.name,
        });
      }
      if (district.name === 'Palm Heights' || district.name === 'Sunset Beach') {
        const palmsHere = rng.int(2, 5);
        for (let i = 0; i < palmsHere; i++) {
          palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1) });
        }
      }
    }
  }

  // Named places the missions and shops need. All sit on or beside roads.
  const places = {
    ricoGarage: { x: 600, y: 3450, name: "Rico's Garage" },
    maraOffice: { x: 1350, y: 450, name: "Mara's Office" },
    hospital: { x: 150, y: 1950, name: 'General Hospital' },
    spray: { x: 1500, y: 1650, name: "Pay 'n' Spray" },
    gunShop: { x: 750, y: 1350, name: 'Gun Shop' },
    burger: { x: 2250, y: 1950, name: 'Burger Shot' },
    clothes: { x: 2550, y: 750, name: 'Threads' },
    docks: { x: 300, y: 3300, name: 'Old Docks' },
    strip: { x: 900, y: 1800, name: 'The Strip' },
    beach: { x: 3220, y: 1800, name: 'Sunset Beach' },
    harbor: { x: 3000, y: 3150, name: 'Harbor Point' },
  };

  return { buildings, palms, blocks, places, roads: roadLines() };
}

// Point-in-building test, used by movement and traffic.
export function hitsBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

export { COLORS };
