// The story: five missions from Rico and Mara, plus a repeatable taxi job.
// A mission is a list of steps; the controller watches the world and advances
// the step when its condition is met. Text is written for the HUD objective line.
import { ECONOMY, MISSIONS } from './config.js';

function gotoStep(x, y, text, r = 70) {
  return { type: 'goto', x, y, r, text };
}

export function buildMissionList(city) {
  const s = city.shops;
  return [
    {
      ...MISSIONS[0],
      intro: 'Rico: "You need wheels, kid. Get to my garage, then take a car. Any car."',
      steps: [
        gotoStep(s.garage.x, s.garage.y, 'Go to Rico\'s Garage'),
        { type: 'enter-car', text: 'Steal a car — press E near one' },
        gotoStep(s.diner.x, s.diner.y, "Drive to Mara's Diner"),
      ],
    },
    {
      ...MISSIONS[1],
      intro: 'Rico: "Package at the Old Docks. Pick it up, run it to Sunset Pier. No cops."',
      steps: [
        gotoStep(s.docks.x, s.docks.y, 'Pick up the package at the Old Docks'),
        { type: 'pickup', x: s.docks.x, y: s.docks.y, r: 55, text: 'Grab the package' },
        gotoStep(s.meet.x, s.meet.y, 'Deliver the package to Sunset Pier'),
      ],
    },
    {
      ...MISSIONS[2],
      intro: 'Mara: "The heat is on you. Two stars. Stay free for 30 seconds and they lose you."',
      steps: [
        { type: 'wanted', stars: 2, text: 'The cops are on you — stay free!' },
        { type: 'survive', seconds: 30, text: 'Survive the heat: 30s' },
      ],
    },
    {
      ...MISSIONS[3],
      intro: 'Mara: "Bay Bank, noon. Grab the cash and get out. Three stars coming your way."',
      steps: [
        gotoStep(s.bank.x, s.bank.y, 'Get to Bay Bank'),
        { type: 'grab', x: s.bank.x, y: s.bank.y, r: 55, text: 'Grab the cash', wanted: 3 },
        gotoStep(s.garage.x, s.garage.y, "Escape to Rico's Garage"),
      ],
    },
    {
      ...MISSIONS[4],
      intro: 'Rico: "The Neon Kings want the Bay. Meet them at Sunset Pier and end it."',
      steps: [
        gotoStep(s.meet.x, s.meet.y, 'Go to the meet at Sunset Pier'),
        { type: 'shootout', x: s.meet.x, y: s.meet.y, count: 4, text: 'Take out the Neon Kings (4 left)' },
        gotoStep(s.garage.x, s.garage.y, "Get back to Rico's Garage"),
      ],
    },
  ];
}

export function createMissionController(city) {
  const list = buildMissionList(city);
  return {
    list,
    index: 0, // mission in progress; list.length means the story is done
    step: 0,
    timer: 0,
    rivalsLeft: 0,
    done: false,
    current() {
      return this.index < list.length ? list[this.index] : null;
    },
    currentStep() {
      const m = this.current();
      return m ? m.steps[this.step] : null;
    },
    objectiveText() {
      const step = this.currentStep();
      if (!step) return this.done ? 'Story complete — Neon Bay is yours.' : 'No active mission.';
      if (step.type === 'survive') return `Survive the heat: ${Math.ceil(this.timer)}s`;
      if (step.type === 'shootout') return `Take out the Neon Kings (${this.rivalsLeft} left)`;
      return step.text;
    },
    marker() {
      const step = this.currentStep();
      if (!step || step.x === undefined) return null;
      return { x: step.x, y: step.y };
    },
    /** Start the next mission (called from the title screen / after a payout). */
    startNext() {
      if (this.index >= list.length) return null;
      this.step = 0;
      this.timer = 0;
      this.rivalsLeft = 0;
      return this.current();
    },
    /**
     * Advance the mission from world events. `world` carries player/wanted/timers.
     * Returns an event string: 'step' | 'mission' | 'story' | null.
     */
    update(world, dt) {
      const mission = this.current();
      if (!mission) return null;
      const step = this.currentStep();
      if (!step) return null;
      const p = world.player;
      const near = (x, y, r) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return dx * dx + dy * dy < r * r;
      };
      const advance = () => {
        this.step += 1;
        this.timer = 0;
        if (this.step >= mission.steps.length) {
          world.cash += mission.pay;
          this.index += 1;
          this.step = 0;
          if (this.index >= list.length) {
            this.done = true;
            return 'story';
          }
          return 'mission';
        }
        return 'step';
      };
      switch (step.type) {
        case 'goto':
          if (near(step.x, step.y, step.r)) return advance();
          return null;
        case 'enter-car':
          if (p.inCar) return advance();
          return null;
        case 'pickup':
        case 'grab':
          if (near(step.x, step.y, step.r)) {
            if (step.wanted) world.setWanted(step.wanted);
            return advance();
          }
          return null;
        case 'wanted':
          world.setWanted(step.stars);
          return advance();
        case 'survive': {
          this.timer += dt;
          if (world.player.busted || world.player.wasted) return null;
          if (this.timer >= step.seconds) {
            world.setWanted(0);
            return advance();
          }
          return null;
        }
        case 'shootout':
          if (this.rivalsLeft <= 0 && world.rivalsSpawned) return advance();
          return null;
        default:
          return null;
      }
    },
  };
}

/** Taxi fares: only while the player drives a taxi. A fare is a passenger point,
 *  then a destination; paying out on arrival. */
export function createTaxi(rng, city) {
  return {
    rng, city,
    state: 'idle', // idle | to-passenger | to-destination
    px: 0, py: 0, dx: 0, dy: 0,
    wait: 6,
    fare: ECONOMY.taxiFare,
    marker() {
      if (this.state === 'to-passenger') return { x: this.px, y: this.py, label: 'FARE' };
      if (this.state === 'to-destination') return { x: this.dx, y: this.dy, label: 'DROP' };
      return null;
    },
    randomRoadPoint() {
      const rx = this.rng.pick(this.city.roadsX);
      const ry = this.rng.pick(this.city.roadsY);
      return this.rng.chance(0.5)
        ? { x: rx, y: this.rng.range(200, 3400) }
        : { x: this.rng.range(200, 3400), y: ry };
    },
    update(dt, player, world) {
      const drivingTaxi = player.inCar && player.inCar.name === 'Taxi';
      if (!drivingTaxi) {
        if (this.state !== 'idle') this.state = 'idle';
        return null;
      }
      const near = (x, y, r) => {
        const dx = player.x - x;
        const dy = player.y - y;
        return dx * dx + dy * dy < r * r;
      };
      if (this.state === 'idle') {
        this.wait -= dt;
        if (this.wait <= 0) {
          const p = this.randomRoadPoint();
          this.px = p.x;
          this.py = p.y;
          this.state = 'to-passenger';
        }
        return null;
      }
      if (this.state === 'to-passenger' && near(this.px, this.py, 70)) {
        const d = this.randomRoadPoint();
        this.dx = d.x;
        this.dy = d.y;
        this.state = 'to-destination';
        return 'picked-up';
      }
      if (this.state === 'to-destination' && near(this.dx, this.dy, 70)) {
        this.state = 'idle';
        this.wait = 8;
        world.cash += this.fare;
        return 'paid';
      }
      return null;
    },
  };
}
