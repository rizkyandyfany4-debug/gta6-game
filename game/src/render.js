// Canvas renderer: the city from above, the cars and people on it, and the HUD
// (cash, wanted stars, health, minimap, objective, speed). Everything is drawn
// from the world state — no images, no assets, just shapes and type.
import { WORLD, PLAYER, CAR, VIEW } from './config.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const GROUND = '#33373f';
const ROAD = '#1d1f26';
const SIDEWALK = '#454b58';
const PARK = '#2f6b3a';
const SAND = '#d9bd7f';
const WATER = '#1d6fb8';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };

  function daylight(timeOfDay) {
    // 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
    const d = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
    return 0.25 + d * 0.75;
  }

  function drawGround(world, view) {
    const { city } = world;
    const { x: cx, y: cy } = camera;
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, view.w, view.h);
    // Park.
    ctx.fillStyle = PARK;
    ctx.beginPath();
    ctx.arc(city.park.x - cx, city.park.y - cy, city.park.r, 0, Math.PI * 2);
    ctx.fill();
    // Beach and water on the east edge.
    ctx.fillStyle = SAND;
    ctx.fillRect(WORLD.beachX - cx, -cy, WORLD.size - WORLD.beachX, WORLD.size);
    ctx.fillStyle = WATER;
    ctx.fillRect(WORLD.waterX - cx, -cy, WORLD.size - WORLD.waterX, WORLD.size);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < WORLD.size; y += 90) {
      const wobble = Math.sin(world.time * 1.2 + y * 0.05) * 6;
      ctx.beginPath();
      ctx.moveTo(WORLD.waterX - cx + wobble, y - cy);
      ctx.lineTo(WORLD.waterX - cx + 40 + wobble, y - cy);
      ctx.stroke();
    }
    // Sidewalks then roads.
    ctx.fillStyle = SIDEWALK;
    for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2 - WORLD.sidewalk - cx, -cy, WORLD.roadWidth + WORLD.sidewalk * 2, WORLD.size);
    for (const ry of city.roadsY) ctx.fillRect(-cx, ry - WORLD.roadWidth / 2 - WORLD.sidewalk - cy, WORLD.size, WORLD.roadWidth + WORLD.sidewalk * 2);
    ctx.fillStyle = ROAD;
    for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2 - cx, -cy, WORLD.roadWidth, WORLD.size);
    for (const ry of city.roadsY) ctx.fillRect(-cx, ry - WORLD.roadWidth / 2 - cy, WORLD.size, WORLD.roadWidth);
    // Centre dashes and crosswalks.
    ctx.fillStyle = '#d8b93a';
    for (const rx of city.roadsX) {
      for (let y = 0; y < WORLD.size; y += 56) ctx.fillRect(rx - 2 - cx, y - cy, 4, 26);
    }
    for (const ry of city.roadsY) {
      for (let x = 0; x < WORLD.size; x += 56) ctx.fillRect(x - cx, ry - 2 - cy, 26, 4);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of city.roadsX) {
      for (const ry of city.roadsY) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(rx - 40 + i * 16 - cx, ry - WORLD.roadWidth / 2 - 8 - cy, 8, 6);
          ctx.fillRect(rx - 40 + i * 16 - cx, ry + WORLD.roadWidth / 2 + 2 - cy, 8, 6);
        }
      }
    }
  }

  function drawBuildings(world) {
    const { city } = world;
    const { x: cx, y: cy } = camera;
    for (const b of city.buildings) {
      const bx = b.x - cx;
      const by = b.y - cy;
      if (bx > VIEW.width + 80 || by > VIEW.height + 80 || bx + b.w < -80 || by + b.h < -80) continue;
      // Fake height: a dark offset shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx + 6, by + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
      // Roof details: a lighter inner slab and vents.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx + 8, by + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(bx + 14 + i * 46, by + 14 + j * 46, 18, 12);
        }
      }
      if (b.landmark && b.name) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, bx + b.w / 2, by + b.h / 2 + 4);
      }
    }
    // Palms.
    for (const palm of city.palms) {
      const px = palm.x - cx;
      const py = palm.y - cy;
      if (px < -40 || px > VIEW.width + 40 || py < -40 || py > VIEW.height + 40) continue;
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = '#2f8f4a';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(a) * 9 * palm.s, py + Math.sin(a) * 9 * palm.s, 10 * palm.s, 4 * palm.s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Neon signs glow at night.
    const night = 1 - daylight(world.timeOfDay);
    for (const sign of city.signs) {
      const sx = sign.x - cx;
      const sy = sign.y - cy;
      if (sx < -60 || sx > VIEW.width + 60 || sy < -30 || sy > VIEW.height + 30) continue;
      ctx.globalAlpha = 0.45 + night * 0.55;
      ctx.fillStyle = sign.color;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sign.text, sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  function drawCarShape(car, isPlayer) {
    const { x: cx, y: cy } = camera;
    ctx.save();
    ctx.translate(car.x - cx, car.y - cy);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Wheels.
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(CAR.length / 2 - 20, -CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(-CAR.length / 2 + 6, CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(CAR.length / 2 - 20, CAR.width / 2 - 3, 14, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-6, -CAR.width / 2, 12, CAR.width);
      // Light bar, flashing with the siren phase.
      const red = Math.floor(car.sirenPhase * 2) % 2 === 0;
      ctx.fillStyle = red ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-8, -CAR.width / 2 - 2, 7, 5);
      ctx.fillStyle = red ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(1, -CAR.width / 2 - 2, 7, 5);
    }
    if (car.name === 'Taxi') {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(-CAR.length / 2 + 8 + i * 10, -3, 5, 6);
    }
    // Windshield and roof.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(CAR.length / 2 - 20, -CAR.width / 2 + 5, 10, CAR.width - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-8, -CAR.width / 2 + 5, 18, CAR.width - 10);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 4, 3, 5);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 5);
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, isPlayer, isCop) {
    const { x: cx, y: cy } = camera;
    ctx.save();
    ctx.translate(x - cx, y - cy);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2ee6a8';
      ctx.fillRect(10, -2, 8, 4);
    }
    if (isCop) {
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(-8, -8, 16, 5);
    }
    ctx.restore();
  }

  function drawMarker(world) {
    const marker = world.missions.marker() || world.taxi.marker();
    if (!marker) return;
    const { x: cx, y: cy } = camera;
    const bob = Math.sin(world.time * 4) * 6;
    const mx = marker.x - cx;
    const my = marker.y - cy;
    if (mx < -40 || mx > VIEW.width + 40 || my < -40 || my > VIEW.height + 40) {
      // Off-screen: an edge arrow pointing at it.
      const ang = Math.atan2(marker.y - world.player.y, marker.x - world.player.x);
      const ex = VIEW.width / 2 + Math.cos(ang) * (VIEW.width / 2 - 40);
      const ey = VIEW.height / 2 + Math.sin(ang) * (VIEW.height / 2 - 40);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(mx, my - 46 + bob);
    ctx.lineTo(mx - 12, my - 70 + bob);
    ctx.lineTo(mx + 12, my - 70 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,58,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, 26 + Math.sin(world.time * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    if (marker.label) {
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(marker.label, mx, my - 76 + bob);
    }
  }

  function drawMinimap(world) {
    const size = 168;
    const ox = VIEW.width - size - 16;
    const oy = 16;
    const scale = size / WORLD.size;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,16,0.82)';
    ctx.fillRect(ox - 4, oy - 4, size + 8, size + 8);
    ctx.strokeStyle = '#5a6272';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 4, oy - 4, size + 8, size + 8);
    ctx.beginPath();
    ctx.rect(ox, oy, size, size);
    ctx.clip();
    ctx.fillStyle = '#2c313c';
    ctx.fillRect(ox, oy, size, size);
    // Water + beach.
    ctx.fillStyle = '#1d6fb8';
    ctx.fillRect(ox + WORLD.waterX * scale, oy, size, size);
    ctx.fillStyle = '#d9bd7f';
    ctx.fillRect(ox + WORLD.beachX * scale, oy, (WORLD.waterX - WORLD.beachX) * scale, size);
    // Roads.
    ctx.fillStyle = '#565d6b';
    for (const rx of world.city.roadsX) ctx.fillRect(ox + rx * scale - 1, oy, 2, size);
    for (const ry of world.city.roadsY) ctx.fillRect(ox, oy + ry * scale - 1, size, 2);
    // Mission marker.
    const marker = world.missions.marker() || world.taxi.marker();
    if (marker) {
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(ox + marker.x * scale, oy + marker.y * scale, 4 + Math.sin(world.time * 5) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police (flashing), player (white).
    const flash = Math.floor(world.time * 3) % 2 === 0;
    for (const car of world.cars) {
      if (car.kind !== 'police') continue;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(ox + car.x * scale - 2, oy + car.y * scale - 2, 4, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ox + world.player.x * scale, oy + world.player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world, screen) {
    const p = world.player;
    // Cash + wanted + district + clock, top-left.
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#2ee6a8';
    ctx.fillText(`$${world.cash.toLocaleString('en-US')}`, 18, 44);
    ctx.font = 'bold 22px sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < world.wanted ? '#ffd23a' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 18 + i * 26, 76);
    }
    ctx.fillStyle = '#cfd6e4';
    ctx.font = '15px sans-serif';
    const hours = Math.floor(world.timeOfDay * 24);
    const mins = Math.floor((world.timeOfDay * 24 - hours) * 60);
    ctx.fillText(`${districtAt(p.x, p.y)}  •  ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, 18, 100);
    // Health + armour, bottom-left.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(18, VIEW.height - 58, 220, 40);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(26, VIEW.height - 48, 204, 10);
    ctx.fillStyle = p.health > 30 ? '#2ee66a' : '#ff4a3a';
    ctx.fillRect(26, VIEW.height - 48, 204 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(26, VIEW.height - 32, 204, 8);
    ctx.fillStyle = '#3a86d8';
    ctx.fillRect(26, VIEW.height - 32, 204 * Math.max(0, p.armor / 100), 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HEALTH', 26, VIEW.height - 64);
    // Mission panel, bottom-centre.
    const mission = world.missions.current();
    ctx.textAlign = 'center';
    if (mission) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const text = world.missions.objectiveText();
      const w = Math.max(420, ctx.measureText(text).width + 40);
      ctx.fillRect(VIEW.width / 2 - w / 2, VIEW.height - 66, w, 48);
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${mission.title}  •  ${mission.giver}`, VIEW.width / 2, VIEW.height - 46);
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      ctx.fillText(text, VIEW.width / 2, VIEW.height - 26);
    } else if (world.missions.done) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(VIEW.width / 2 - 220, VIEW.height - 66, 440, 48);
      ctx.fillStyle = '#2ee6a8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('STORY COMPLETE — Neon Bay is yours.', VIEW.width / 2, VIEW.height - 36);
    }
    // Speed + weapon, bottom-right.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.12);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`${mph}`, VIEW.width - 18, VIEW.height - 30);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#cfd6e4';
      ctx.fillText(`mph  •  ${p.inCar.name}`, VIEW.width - 18, VIEW.height - 12);
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(p.hasPistol ? `PISTOL  •  ${p.ammo} rounds` : 'FISTS  •  buy a pistol at Ironworks Guns', VIEW.width - 18, VIEW.height - 30);
    }
    ctx.textAlign = 'left';
  }

  function promptText(world) {
    const p = world.player;
    if (p.inCar) return 'E — Get out    H — Horn    M — Mute';
    const shops = world.city.shops;
    const near = (place, r = 52) => {
      const dx = p.x - place.x;
      const dy = p.y - place.y;
      return dx * dx + dy * dy < r * r;
    };
    if (near(shops.gunshop)) {
      if (!p.hasPistol) return `E — Buy pistol $${ECONOMY_PISTOL}`;
      return `E — Buy ammo $${ECONOMY_AMMO} (24 rounds)`;
    }
    if (near(shops.spray)) return world.wanted > 0 ? `E — Pay 'n' Spray $${ECONOMY_SPRAY} (lose the heat)` : "Pay 'n' Spray — no heat on you";
    if (near(shops.hospital)) return p.health < 100 ? 'E — Heal $100' : 'St. Mercy Hospital';
    let best = null;
    let bestD = 56 * 56;
    for (const car of world.cars) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) return best.driver ? `E — Steal the ${best.name}` : `E — Drive the ${best.name}`;
    if (world.taxi.state === 'to-passenger') return 'Taxi fare waiting — drive a taxi to pick it up';
    return 'WASD — Move    Shift — Run    E — Enter car    F — Shoot    P — Pause';
  }

  function drawWorld(world) {
    const p = world.player;
    camera.x = Math.max(0, Math.min(WORLD.size - VIEW.width, p.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.size - VIEW.height, p.y - VIEW.height / 2));
    drawGround(world, VIEW);
    drawBuildings(world);
    // Pickups.
    for (const pk of world.pickups) {
      const px = pk.x - camera.x;
      const py = pk.y - camera.y + Math.sin(pk.bob * 3) * 3;
      ctx.fillStyle = pk.kind === 'cash' ? '#2ee66a' : pk.kind === 'health' ? '#fff' : pk.kind === 'ammo' ? '#ffd23a' : '#3a86d8';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : 'V', px, py + 4);
    }
    // Cars (police last so their lights sit on top).
    for (const car of world.cars) {
      if (car.kind === 'police') continue;
      drawCarShape(car, car === p.inCar);
    }
    for (const car of world.cars) {
      if (car.kind === 'police') drawCarShape(car, false);
    }
    // People.
    for (const ped of world.peds) {
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x - camera.x, ped.y - camera.y);
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 6, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.color, false, false);
    }
    for (const cop of world.cops) drawPerson(cop.x, cop.y, cop.angle, '#1c2733', '#e8b48a', false, true);
    for (const rival of world.rivals) {
      if (rival.state === 'down') continue;
      drawPerson(rival.x, rival.y, rival.angle, '#ff2e88', '#e8b48a', false, false);
      ctx.fillStyle = '#ff2e2e';
      ctx.fillRect(rival.x - camera.x - 12, rival.y - camera.y - 24, 24, 4);
      ctx.fillStyle = '#3a0d0d';
      ctx.fillRect(rival.x - camera.x - 12, rival.y - camera.y - 24, 24 * (1 - Math.max(0, rival.health) / 60), 4);
    }
    // Player on foot.
    if (!p.inCar) drawPerson(p.x, p.y, p.angle, '#2ee6a8', '#e8b48a', true, false);
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of world.bullets) {
      ctx.fillRect(b.x - camera.x - 2, b.y - camera.y - 2, 4, 4);
    }
    drawMarker(world);
    // Night tint.
    const night = 1 - daylight(world.timeOfDay);
    if (night > 0.12) {
      ctx.fillStyle = `rgba(8,10,38,${(night * 0.34).toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    drawMinimap(world);
    drawHud(world, SCREEN_PLAY);
    // Prompt line.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px sans-serif';
    ctx.fillText(promptText(world), VIEW.width / 2, VIEW.height - 76);
    ctx.textAlign = 'left';
  }

  function drawTitle(world, save, best) {
    drawWorldBackdrop(world);
    ctx.fillStyle = 'rgba(8,8,18,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 96px sans-serif';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 34;
    ctx.fillText('VICE HEAT', VIEW.width / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2ee6ff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('— NEON BAY —', VIEW.width / 2, 232);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('An open-world crime story. Steal cars, outrun the law, run the Bay.', VIEW.width / 2, 276);
    ctx.fillStyle = '#cfd6e4';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive  •  E steal & enter cars  •  F shoot  •  Space punch', VIEW.width / 2, 316);
    ctx.fillText('Shift run  •  H horn  •  P pause  •  M mute  •  progress saves automatically', VIEW.width / 2, 340);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 24px sans-serif';
    const blink = Math.floor(world.time * 2) % 2 === 0;
    if (blink) ctx.fillText(save ? 'ENTER — Continue your story' : 'ENTER — Start the story', VIEW.width / 2, 420);
    if (save) {
      ctx.fillStyle = '#cfd6e4';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Save: $${save.cash}  •  ${save.missionsDone} mission${save.missionsDone === 1 ? '' : 's'} done  •  N — New game`, VIEW.width / 2, 452);
    }
    if (best > 0) {
      ctx.fillStyle = '#8a93a6';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Most cash held: $${best}`, VIEW.width / 2, 482);
    }
    ctx.fillStyle = '#8a93a6';
    ctx.font = '13px sans-serif';
    ctx.fillText('A fan-made original. Not affiliated with Rockstar Games. All names, places and art are original.', VIEW.width / 2, VIEW.height - 24);
    ctx.textAlign = 'left';
  }

  // The title screen shows the living city behind the menu.
  function drawWorldBackdrop(world) {
    const p = world.player;
    const keep = { x: p.x, y: p.y };
    p.x = 1500 + Math.sin(world.time * 0.05) * 500;
    p.y = 1500 + Math.cos(world.time * 0.04) * 400;
    camera.x = Math.max(0, Math.min(WORLD.size - VIEW.width, p.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.size - VIEW.height, p.y - VIEW.height / 2));
    drawGround(world, VIEW);
    drawBuildings(world);
    p.x = keep.x;
    p.y = keep.y;
  }

  function drawPaused(world) {
    drawWorld(world);
    ctx.fillStyle = 'rgba(8,8,18,0.7)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfd6e4';
    ctx.fillText('P — Resume    M — Mute    Progress saves automatically', VIEW.width / 2, 344);
    ctx.textAlign = 'left';
  }

  function drawOver(world, kind) {
    drawWorld(world);
    ctx.fillStyle = kind === 'wasted' ? 'rgba(40,4,4,0.78)' : 'rgba(4,8,40,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'wasted' ? '#ff4a3a' : '#3a86d8';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', VIEW.width / 2, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(kind === 'wasted' ? 'The Bay chewed you up. The hospital patched you up.' : 'The law caught up. You lost some cash — and the heat.', VIEW.width / 2, 362);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 22px sans-serif';
    if (Math.floor(world.time * 2) % 2 === 0) ctx.fillText('ENTER — Back to the streets', VIEW.width / 2, 420);
    ctx.textAlign = 'left';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return {
    draw(world, screen, save, best, banner) {
      if (screen === SCREEN_TITLE) drawTitle(world, save, best);
      else if (screen === SCREEN_PAUSED) drawPaused(world);
      else if (screen === SCREEN_OVER) drawOver(world, world.over);
      else drawWorld(world);
      if (banner && screen === SCREEN_PLAY) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(VIEW.width / 2 - 360, 130, 720, 64);
        ctx.fillStyle = '#ffd23a';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(banner.title, VIEW.width / 2, 156);
        ctx.fillStyle = '#fff';
        ctx.font = '15px sans-serif';
        ctx.fillText(banner.text, VIEW.width / 2, 180);
        ctx.textAlign = 'left';
      }
    },
  };
}

// Prices used by the HUD prompt line (kept here so render stays self-contained).
const ECONOMY_PISTOL = 500;
const ECONOMY_AMMO = 120;
const ECONOMY_SPRAY = 200;
