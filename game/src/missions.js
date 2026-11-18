// VICE HEAT: Neon Bay — the five story missions.
// Rico (Old Docks) and Mara (Neon Bay) hand out the work. Each mission is
// a small state machine: a list of steps, each with a target point and a
// short instruction, checked every tick until the mission pays out.

import { MISSION_PAYOUTS } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    giver: 'Rico',
    payout: MISSION_PAYOUTS[0],
    intro: "Rico: 'Fresh meat. Steal the red sports car by the docks and bring it to my garage. No heat on this one — I cleared it.'",
    steps: [
      { type: 'enterCar', label: 'Steal the red sports car at the docks', key: 'targetCar' },
      { type: 'reach', label: "Drive it to Rico's Garage", key: 'garage', radius: 90 },
    ],
  },
  {
    id: 2,
    name: 'The Drop',
    giver: 'Mara',
    payout: MISSION_PAYOUTS[1],
    intro: "Mara: 'A package is waiting at the Strip. Grab it on foot, then drop it at Harbor Point. Cops will be watching — keep it smooth.'",
    steps: [
      { type: 'reach', label: 'Pick up the package at The Strip', key: 'strip', radius: 60, onFoot: true },
      { type: 'reach', label: 'Deliver the package to Harbor Point', key: 'harbor', radius: 80, heat: 1 },
    ],
  },
  {
    id: 3,
    name: 'Hot Pursuit',
    giver: 'Rico',
    payout: MISSION_PAYOUTS[2],
    intro: "Rico: 'You made the news, kid. Three stars on your tail — lose them for 30 seconds, then get to the safehouse at Palm Heights.'",
    steps: [
      { type: 'survive', label: 'Survive the heat: 30 seconds', key: 'survive', seconds: 30, heat: 3 },
      { type: 'reach', label: 'Reach the Palm Heights safehouse', key: 'safehouse', radius: 90 },
    ],
  },
  {
    id: 4,
    name: 'The Getaway',
    giver: 'Mara',
    payout: MISSION_PAYOUTS[3],
    intro: "Mara: 'The crew needs a driver. Take the sports car and hit all three checkpoints before the timer runs out — 90 seconds.'",
    steps: [
      { type: 'enterCar', label: 'Take the sports car at Sunset Beach', key: 'getawayCar' },
      { type: 'checkpoints', label: 'Hit the checkpoints', key: 'checkpoints', seconds: 90 },
    ],
  },
  {
    id: 5,
    name: 'Neon King',
    giver: 'Rico & Mara',
    payout: MISSION_PAYOUTS[4],
    intro: "Rico: 'Last job. The Vipers own the Strip tonight — put five of them down, then meet Mara at her office. Neon Bay is ours after this.'",
    steps: [
      { type: 'defeat', label: 'Take down 5 Vipers on The Strip', key: 'rivals', count: 5 },
      { type: 'reach', label: "Meet Mara at her office", key: 'maraOffice', radius: 80 },
    ],
  },
];

export function startMissionState(index) {
  const def = MISSIONS[index];
  return {
    index,
    def,
    step: 0,
    timer: 0,
    done: 0, // progress counter for defeat / checkpoint steps
    started: false,
  };
}

// Where a mission's named key lives in the world. The world fills these in
// when the mission starts (positions come from the city places).
export function stepTarget(world, mission, step) {
  const p = world.places;
  switch (step.key) {
    case 'garage': return { x: p.ricoGarage.x, y: p.ricoGarage.y };
    case 'strip': return { x: p.strip.x, y: p.strip.y };
    case 'harbor': return { x: p.harbor.x, y: p.harbor.y };
    case 'safehouse': return { x: 2100, y: 450 };
    case 'maraOffice': return { x: p.maraOffice.x, y: p.maraOffice.y };
    case 'targetCar': return world.missionCar ? { x: world.missionCar.x, y: world.missionCar.y } : null;
    case 'getawayCar': return world.missionCar ? { x: world.missionCar.x, y: world.missionCar.y } : null;
    case 'checkpoints': return world.checkpoints?.[mission.done] ?? null;
    case 'rivals': return null;
    case 'survive': return null;
    default: return null;
  }
}

export function stepLabel(mission) {
  const step = mission.def.steps[mission.step];
  if (!step) return 'Mission complete';
  if (step.type === 'survive') return `${step.label} — ${Math.ceil(mission.timer)}s left`;
  if (step.type === 'defeat') return `${step.label} (${mission.done}/${step.count})`;
  if (step.type === 'checkpoints') return `${step.label} (${mission.done}/3) — ${Math.ceil(mission.timer)}s left`;
  return step.label;
}
