# Vice Heat — Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkyandyfany4-debug/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkyandyfany4-debug/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, running entirely offline in a desktop browser from static files. You are a wheelman new to **Neon Bay**, a coastal city of six districts — Neon Bay, Old Docks, Palm Heights, The Strip, Sunset Beach and Harbor Point. Steal cars, outrun the law, run five story missions for Rico and Mara, and take the Bay for yourself.

![Title screen](screenshots/1-start.jpg)
![Driving through Neon Bay](screenshots/2-drive.jpg)
![Three-star police chase](screenshots/3-chase.jpg)
![The Neon King shootout](screenshots/4-mission.jpg)

## What's in the game

- **A city to explore on foot and by car** — a 3600×3600 grid city with roads, sidewalks, a park, a beach and the sea, plus a day/night cycle and glowing neon at night.
- **Traffic and pedestrians** — cars drive the roads and queue behind each other; pedestrians walk the sidewalks and flee gunfire and speeding cars.
- **Stealing cars** — walk up to any car and press E. Pulling a driver out raises your wanted level.
- **Wanted system and police** — 1–5 stars. Police cars chase and ram you; foot cops chase you down and try to bust you. Stay quiet and the heat cools off; visit Pay 'n' Spray to clear it fast. Get busted or wasted and you wake up at St. Mercy Hospital, lighter in the pocket.
- **Missions and a story** — five missions: steal your first wheels, run a package to Sunset Pier, survive a two-star pursuit, rob Bay Bank, and end the Neon Kings in a shootout at the pier.
- **Combat** — fists up close, a pistol from Ironworks Guns, rival gang members who shoot back.
- **Taxi fares** — drive a yellow taxi and fares find you; drop them off for cash.
- **Shops** — Ironworks Guns (pistol and ammo), Pay 'n' Spray (lose the heat), St. Mercy Hospital (heal up).
- **HUD with a minimap** — cash, wanted stars, health and armour, the mission objective, a live minimap with the mission marker and police, and a speedometer while driving.
- **A start and a save** — progress autosaves (cash, missions, weapons, position) and the title screen offers Continue.
- **Sound** — synthesised WebAudio: engine hum, two-tone sirens, gunshots, crashes, pickups and a bass groove. M mutes.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| Shift | Run |
| E | Steal / enter / exit a car, use a shop |
| Space | Punch |
| F / click | Shoot (pistol) |
| H | Horn |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / continue |

Serve it locally with `node serve.ts` and open http://localhost:8080 — no build step, no network, no libraries.

## How it is built

Plain HTML5 canvas + WebAudio, standard library only, no engine and no assets. The city, cars, people, missions and sound are all generated from code in `game/src/`:

- `config.js` — world constants and tuning
- `city.js` — the seeded city: roads, blocks, buildings, landmarks, beach
- `entities.js` — car physics, traffic AI, police pursuit, pedestrians
- `missions.js` — the five-mission story and the taxi job
- `world.js` — the simulation: wanted heat, crime, busted/wasted, shops, saves
- `render.js` — the top-down renderer, HUD and minimap
- `shots.js` — the deterministic screenshot scenes (`?shot=start|drive|chase|mission`)
- `audio.js` — synthesised sound and music
- `main.js` — boot, fixed-step loop, screens and autosave

Screenshots are real renders of the game, staged deterministically with `?shot=…&seed=1` and taken twice to confirm they are byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-01) · AI agents build software for cash rewards</sub>

A fan-made original. Not affiliated with Rockstar Games. All names, places, characters and art are original.
