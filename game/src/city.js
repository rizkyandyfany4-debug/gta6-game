// Neon Bay: a coastal grid city, generated from a seed. Roads on a regular grid,
// buildings filling the blocks between them, a beach and water on the east edge,
// palms, neon signs and the named places missions use (garage, bank, docks,
// diner, hospital, pay 'n' spray, gun shop, safehouse).
import { WORLD, DISTRICTS } from './config.js';

const ROOF_COLORS = ['#7a5c8e', '#5c7a8e', '#8e6a5c', '#5c8e6a', '#8e5c6e', '#6a6a8e', '#9c8464', '#64707d'];
const NEON_COLORS = ['#ff2e88', '#2ee6ff', '#ffb03a', '#b44bff', '#2ee6a8', '#ff5a3a'];

export function buildCity(rng) {
  const roadsX = [];
  const roadsY = [];
  for (let k = 0; k < 8; k += 1) {
    roadsX.push(210 + k * WORLD.roadGap);
    roadsY.push(210 + k * WORLD.roadGap);
  }

  const buildings = [];
  // Blocks between neighbouring roads; skip blocks east of the beach.
  for (let bx = 0; bx < roadsX.length - 1; bx += 1) {
    for (let by = 0; by < roadsY.length - 1; by += 1) {
      const x0 = roadsX[bx] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const x1 = roadsX[bx + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      const y0 = roadsY[by] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const y1 = roadsY[by + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      if (x0 >= WORLD.beachX - 60) continue; // beach blocks stay open sand
      // The central block is the park.
      if (bx === 3 && by === 3) continue;
      const lots = rng.pick([1, 2, 2, 4]);
      if (lots === 1) {
        buildings.push(makeBuilding(rng, x0, y0, x1 - x0, y1 - y0));
      } else if (lots === 2) {
        const vertical = rng.chance(0.5);
        if (vertical) {
          const mid = (x0 + x1) / 2;
          buildings.push(makeBuilding(rng, x0, y0, mid - x0 - 10, y1 - y0));
          buildings.push(makeBuilding(rng, mid + 10, y0, x1 - mid - 10, y1 - y0));
        } else {
          const mid = (y0 + y1) / 2;
          buildings.push(makeBuilding(rng, x0, y0, x1 - x0, mid - y0 - 10));
          buildings.push(makeBuilding(rng, x0, mid + 10, x1 - x0, y1 - mid - 10));
        }
      } else {
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0, y0, mx - x0 - 8, my - y0 - 8));
        buildings.push(makeBuilding(rng, mx + 8, y0, x1 - mx - 8, my - y0 - 8));
        buildings.push(makeBuilding(rng, x0, my + 8, mx - x0 - 8, y1 - my - 8));
        buildings.push(makeBuilding(rng, mx + 8, my + 8, x1 - mx - 8, y1 - my - 8));
      }
    }
  }

  // Named landmarks overwrite a few buildings near their spots.
  const landmarks = [
    { name: "Rico's Garage", x: 630, y: 630, color: '#c94f32' },
    { name: "Mara's Diner", x: 1470, y: 630, color: '#2e88c9' },
    { name: 'Bay Bank', x: 2310, y: 1470, color: '#8e7a3a' },
    { name: 'Neon Hotel', x: 1890, y: 2310, color: '#c92e88' },
    { name: 'St. Mercy Hospital', x: 630, y: 2310, color: '#e8e8e8' },
    { name: "Ironworks Guns", x: 2730, y: 2310, color: '#5c5c6e' },
    { name: "Pay 'n' Spray", x: 2730, y: 630, color: '#2ee6a8' },
    { name: 'Sunset Mall', x: 3150, y: 1470, color: '#b44bff' },
  ];
  for (const mark of landmarks) {
    const b = nearestBuilding(buildings, mark.x, mark.y);
    if (b) {
      b.name = mark.name;
      b.color = mark.color;
      b.landmark = true;
    }
  }

  // Palms along the beach and the park.
  const palms = [];
  for (let y = 120; y < WORLD.size - 120; y += 130) {
    palms.push({ x: WORLD.beachX + rng.range(20, 130), y: y + rng.range(-30, 30), s: rng.range(0.8, 1.3) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: rng.range(1500, 2100), y: rng.range(1500, 2100), s: rng.range(0.8, 1.4) });
  }
  // Neon signs on random buildings.
  const signs = [];
  for (let i = 0; i < 22; i += 1) {
    const b = buildings[Math.floor(rng.next() * buildings.length)];
    if (!b) continue;
    signs.push({ x: b.x + b.w / 2, y: b.y - 6, color: NEON_COLORS[i % NEON_COLORS.length], text: rng.pick(['NEON', 'HOTEL', '24H', 'BAR', 'CLUB', 'EAT', 'CASINO', 'MOTEL']) });
  }

  const shops = {
    garage: { x: 630, y: 690, name: "Rico's Garage" },
    diner: { x: 1470, y: 690, name: "Mara's Diner" },
    bank: { x: 2310, y: 1530, name: 'Bay Bank' },
    hospital: { x: 630, y: 2370, name: 'St. Mercy Hospital' },
    gunshop: { x: 2730, y: 2370, name: 'Ironworks Guns' },
    spray: { x: 2730, y: 690, name: "Pay 'n' Spray" },
    docks: { x: 420, y: 3150, name: 'Old Docks' },
    meet: { x: 3150, y: 2730, name: 'Sunset Pier' },
  };

  return {
    roadsX, roadsY, buildings, palms, signs, shops,
    spawn: { x: 630, y: 760, angle: 0 },
    park: { x: 1680, y: 1680, r: 230 },
  };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w: Math.max(60, w), h: Math.max(60, h),
    color: ROOF_COLORS[Math.floor(rng.next() * ROOF_COLORS.length)],
    height: rng.int(1, 4),
    name: null,
    landmark: false,
  };
}

function nearestBuilding(buildings, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const b of buildings) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** True when the point is on a road (or sidewalk) rather than inside a block. */
export function isOnRoad(city, x, y) {
  const half = WORLD.roadWidth / 2 + WORLD.sidewalk;
  for (const rx of city.roadsX) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) <= half) return true;
  return false;
}

/** Circle vs buildings: returns the building hit, or null. */
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** The nearest road centre line to a point, as {axis:'x'|'y', line, dist}. */
export function nearestRoad(city, x, y) {
  let best = { axis: 'x', line: city.roadsX[0], dist: Infinity };
  for (const rx of city.roadsX) {
    const d = Math.abs(x - rx);
    if (d < best.dist) best = { axis: 'x', line: rx, dist: d };
  }
  for (const ry of city.roadsY) {
    const d = Math.abs(y - ry);
    if (d < best.dist) best = { axis: 'y', line: ry, dist: d };
  }
  return best;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Neon Bay';
}

export function isInWater(x) {
  return x > WORLD.waterX;
}
