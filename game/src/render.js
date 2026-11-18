// VICE HEAT: Neon Bay — everything the player sees.
// Canvas 2D, flat colours and neon accents. The camera follows the player;
// only what is on screen gets drawn. Day and night come from the world
// clock: a dark blue overlay that deepens after sunset, with headlights
// and window lights glowing at night.

import { WORLD_SIZE, ROAD_SPACING, BEACH_X, WATER_X, DISTRICTS, COLORS, PLAYER } from './config.js';
import { districtAt, isBeach, isWater } from './city.js';
import { stepTarget, stepLabel } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280;
  let vh = 720;
  function resize(w, h) {
    vw = w;
    vh = h;
    canvas.width = w;
    canvas.height = h;
  }
  return { ctx, resize, get vw() { return vw; }, get vh() { return vh; } };
}

// 0 = noon, 1 = midnight. The overlay alpha follows this curve.
export function darknessAt(timeHours) {
  const t = ((timeHours % 24) + 24) % 24;
  if (t >= 7 && t < 17) return 0;
  if (t >= 17 && t < 19.5) return (t - 17) / 2.5 * 0.55;
  if (t >= 19.5 || t < 5) return 0.55;
  return (7 - t) / 2 * 0.55;
}

function drawGround(ctx, world, camX, camY, vw, vh) {
  const { city } = world;
  // District ground.
  for (const d of DISTRICTS) {
    const x0 = Math.max(d.x0, camX);
    const y0 = Math.max(d.y0, camY);
    const x1 = Math.min(d.x1, camX + vw);
    const y1 = Math.min(d.y1, camY + vh);
    if (x1 <= x0 || y1 <= y0) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // Sand and water on the east edge.
  const sandX0 = Math.max(BEACH_X, camX);
  const sandX1 = Math.min(WATER_X, camX + vw);
  if (sandX1 > sandX0) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(sandX0, camY, sandX1 - sandX0, vh);
  }
  const waterX0 = Math.max(WATER_X, camX);
  const waterX1 = Math.min(WORLD_SIZE, camX + vw);
  if (waterX1 > waterX0) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(waterX0, camY, waterX1 - waterX0, vh);
    ctx.fillStyle = COLORS.waterDeep;
    for (let y = Math.floor(camY / 90) * 90; y < camY + vh; y += 90) {
      ctx.fillRect(waterX0 + 30, y + 30, 90, 6);
      ctx.fillRect(waterX0 + 130, y + 65, 70, 5);
    }
  }
  // Roads: dark strips with a dashed centre line.
  ctx.fillStyle = COLORS.road;
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    if (v < BEACH_X) {
      ctx.fillRect(v - 34, camY, 68, vh);
      ctx.fillRect(camX, v - 34, vw, 68);
    }
  }
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    if (v < BEACH_X) {
      ctx.moveTo(v, camY);
      ctx.lineTo(v, camY + vh);
      ctx.moveTo(camX, v);
      ctx.lineTo(camX + vw, v);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalk edges.
  ctx.strokeStyle = COLORS.sidewalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    if (v < BEACH_X) {
      ctx.moveTo(v - 37, camY);
      ctx.lineTo(v - 37, camY + vh);
      ctx.moveTo(v + 37, camY);
      ctx.lineTo(v + 37, camY + vh);
      ctx.moveTo(camX, v - 37);
      ctx.lineTo(camX + vw, v - 37);
      ctx.moveTo(camX, v + 37);
      ctx.lineTo(camX + vw, v + 37);
    }
  }
  ctx.stroke();
}

function drawBuildings(ctx, world, camX, camY, vw, vh, dark) {
  for (const b of world.city.buildings) {
    if (b.x + b.w < camX || b.x > camX + vw || b.y + b.h < camY || b.y > camY + vh) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillRect(b.x, b.y, 8, b.h);
    // Lit windows after dark.
    if (dark > 0.2) {
      ctx.fillStyle = '#ffd977';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.x) % 5 < 2) {
            ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 10, 12);
          }
        }
      }
    }
    if (b.tall) {
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + b.w / 2 - 2, b.y - 14, 4, 14);
    }
  }
  // Palm trees on the beach side.
  ctx.fillStyle = '#2d5a2a';
  for (const palm of world.city.palms) {
    if (palm.x < camX || palm.x > camX + vw || palm.y < camY || palm.y > camY + vh) continue;
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath();
    ctx.arc(palm.x - 6, palm.y - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d5a2a';
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = 52;
  const wid = 26;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.color;
  ctx.fillRect(-len / 2, -wid / 2, len, wid);
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(-8, -wid / 2 + 4, 18, wid - 8); // cabin
  ctx.fillStyle = '#dfe9f2';
  ctx.fillRect(len / 2 - 6, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 6, wid / 2 - 8, 3, 5); // headlights
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-len / 2 + 1, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2 + 1, wid / 2 - 8, 3, 5); // tail lights
  if (car.police) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-14, -wid / 2, 28, wid);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    // Light bar.
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(-4, -wid / 2 - 4, 8, 5);
    ctx.fillStyle = '#2d7bff';
    ctx.fillRect(-4, wid / 2 - 1, 8, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.missionTarget) {
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 3;
    ctx.strokeRect(-len / 2 - 5, -wid / 2 - 5, len + 10, wid + 10);
  }
  ctx.restore();
}

function drawPedShape(ctx, ped) {
  if (ped.state === 'down') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(10, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (ped.rival) {
    ctx.fillStyle = '#ff2d55';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VIPER', ped.x, ped.y - 16);
  }
}

function drawPlayerShape(ctx, p, world) {
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head.
  ctx.fillStyle = '#ffd23c';
  ctx.fillRect(-8, -9, 16, 18);
  ctx.fillStyle = '#f2c98a';
  ctx.beginPath();
  ctx.arc(12, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand.
  if (p.hasPistol) {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(6, 6, 12, 4);
  }
  if (p.punchAnim > 0) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(14, -6, 14, 12);
  }
  if (p.muzzle > 0) {
    ctx.fillStyle = '#ffe95e';
    ctx.beginPath();
    ctx.arc(24, 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, label, pulse) {
  const bob = Math.sin(pulse * 4) * 6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#ff4fd8';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-11, -14);
  ctx.lineTo(11, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const w = ctx.measureText(label).width + 12;
    ctx.fillRect(x - w / 2, y - 52 + bob, w, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 38 + bob);
  }
  // Ground ring.
  ctx.strokeStyle = 'rgba(255,79,216,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 34, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMinimap(ctx, world, vw, vh) {
  const size = 190;
  const x0 = vw - size - 16;
  const y0 = 16;
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = 'rgba(8,10,16,0.82)';
  ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.strokeStyle = '#5a6272';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(x0 + d.x0 * scale, y0 + d.y0 * scale, (d.x1 - d.x0) * scale, (d.y1 - d.y0) * scale);
  }
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0 + WATER_X * scale, y0, (WORLD_SIZE - WATER_X) * scale, size);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x0 + BEACH_X * scale, y0, (WATER_X - BEACH_X) * scale, size);
  // Roads.
  ctx.strokeStyle = 'rgba(200,200,200,0.35)';
  ctx.lineWidth = 1;
  for (let v = 0; v <= WORLD_SIZE; v += ROAD_SPACING) {
    if (v < BEACH_X) {
      ctx.beginPath();
      ctx.moveTo(x0 + v * scale, y0);
      ctx.lineTo(x0 + v * scale, y0 + size);
      ctx.moveTo(x0, y0 + v * scale);
      ctx.lineTo(x0 + size, y0 + v * scale);
      ctx.stroke();
    }
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Mission marker and fare.
  const m = world.mission;
  if (m) {
    const step = m.def.steps[m.step];
    if (step) {
      const target = stepTarget(world, m, step);
      if (target) dot(target.x, target.y, '#ff4fd8', 5);
    }
  }
  if (world.fare) dot(world.fare.x, world.fare.y, '#e8b93c', 4);
  for (const cop of world.police) dot(cop.x, cop.y, '#2d7bff', 3);
  if (world.missionCar) dot(world.missionCar.x, world.missionCar.y, '#ff4fd8', 3);
  dot(world.player.x, world.player.y, '#ffd23c', 4);
  // District label.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(world.player.x, world.player.y).name, x0, y0 + size + 20);
}

function drawHUD(ctx, world, vw, vh) {
  const p = world.player;
  // Money.
  ctx.fillStyle = 'rgba(8,10,16,0.8)';
  ctx.fillRect(16, 16, 210, 64);
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${world.money.toLocaleString('en-US')}`, 28, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Health ${Math.max(0, Math.round(p.health))}`, 28, 66);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(150, 56, 62, 10);
  ctx.fillStyle = p.health > 30 ? '#37d67a' : '#ff2d55';
  ctx.fillRect(150, 56, 62 * Math.max(0, p.health / 100), 10);
  // Wanted stars.
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 240 + i * 30, 44);
  }
  // Ammo.
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Ammo ${p.ammo} / ${p.reserve}`, 16, 100);
  // Clock.
  const hours = Math.floor(world.time);
  const mins = Math.floor((world.time - hours) * 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(clock, vw - 16, vh - 16);
  ctx.textAlign = 'left';
  // Mission objective.
  const m = world.mission;
  if (m) {
    const y = 120;
    ctx.fillStyle = 'rgba(8,10,16,0.8)';
    ctx.fillRect(16, y, 330, 56);
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${m.def.name} — ${m.def.giver}  ($${m.def.payout})`, 28, y + 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(stepLabel(m), 28, y + 42);
  }
  // Toasts.
  ctx.font = '14px sans-serif';
  let ty = vh - 120;
  for (const t of world.toasts.slice(-3)) {
    const w = ctx.measureText(t.text).width + 20;
    ctx.fillStyle = 'rgba(8,10,16,0.8)';
    ctx.fillRect(16, ty, w, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, 26, ty + 18);
    ty -= 32;
  }
  // Busted / wasted overlay.
  if (world.busted || world.wasted) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = world.busted ? '#2d7bff' : '#ff2d55';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.busted ? 'BUSTED' : 'WASTED', vw / 2, vh / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText('You will wake up at the hospital…', vw / 2, vh / 2 + 40);
    ctx.textAlign = 'left';
  }
  // Title screen.
  if (!world.started) {
    ctx.fillStyle = 'rgba(6,6,14,0.78)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('VICE HEAT', vw / 2, vh / 2 - 70);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('NEON BAY', vw / 2, vh / 2 - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    ctx.fillText('WASD move · Shift run · Space punch · F / click shoot · E enter car / shop', vw / 2, vh / 2 + 24);
    ctx.fillText('Steal cars, lose the cops, run the five missions. Start with $120.', vw / 2, vh / 2 + 52);
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER to start', vw / 2, vh / 2 + 100);
    ctx.textAlign = 'left';
  }
}

export function render(renderer, world) {
  const { ctx, vw, vh } = renderer;
  const p = world.player;
  const camX = Math.max(0, Math.min(WORLD_SIZE - vw, p.x - vw / 2));
  const camY = Math.max(0, Math.min(WORLD_SIZE - vh, p.y - vh / 2));
  const dark = darknessAt(world.time);

  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  ctx.translate(-camX, -camY);
  drawGround(ctx, world, camX, camY, vw, vh);
  drawBuildings(ctx, world, camX, camY, vw, vh, dark);
  // Shops and places.
  ctx.font = 'bold 12px sans-serif';
  for (const [key, place] of Object.entries(world.places)) {
    if (place.x < camX - 80 || place.x > camX + vw + 80 || place.y < camY - 80 || place.y > camY + vh + 80) continue;
    ctx.fillStyle = '#e8b93c';
    ctx.beginPath();
    ctx.arc(place.x, place.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.textAlign = 'center';
    ctx.fillText('◆', place.x, place.y + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(place.name, place.x, place.y - 16);
  }
  // Mission target marker.
  const m = world.mission;
  if (m) {
    const step = m.def.steps[m.step];
    if (step) {
      const target = stepTarget(world, m, step);
      if (target) drawMarker(ctx, target.x, target.y, step.key === 'checkpoints' ? `Checkpoint ${m.done + 1}/3` : null, world.playTime);
    }
  }
  if (world.fare) drawMarker(ctx, world.fare.x, world.fare.y, world.fare.phase === 'pickup' ? 'Fare' : 'Drop-off', world.playTime);
  // Entities: traffic and parked cars, then police, peds, player.
  for (const car of world.cars) {
    if (car.x < camX - 80 || car.x > camX + vw + 80 || car.y < camY - 80 || car.y > camY + vh + 80) continue;
    drawCarShape(ctx, car);
  }
  for (const cop of world.police) drawCarShape(ctx, cop);
  for (const ped of world.peds) {
    if (ped.x < camX - 40 || ped.x > camX + vw + 40 || ped.y < camY - 40 || ped.y > camY + vh + 40) continue;
    drawPedShape(ctx, ped);
  }
  for (const rival of world.rivals) {
    if (rival.x < camX - 40 || rival.x > camX + vw + 40 || rival.y < camY - 40 || rival.y > camY + vh + 40) continue;
    drawPedShape(ctx, rival);
  }
  drawPlayerShape(ctx, p, world);
  // Headlight cones at night while driving.
  if (dark > 0.25 && p.inCar) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffe95e';
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(26, -8);
    ctx.lineTo(300, -70);
    ctx.lineTo(300, 70);
    ctx.lineTo(26, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Night overlay.
  if (dark > 0) {
    ctx.fillStyle = `rgba(8,10,32,${dark})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  drawMinimap(ctx, world, vw, vh);
  drawHUD(ctx, world, vw, vh);
}
