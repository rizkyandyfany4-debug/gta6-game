# VICE HEAT: Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkyandyfany4-debug/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkyandyfany4-debug/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down 2D open-world crime game in a single coastal city — HTML5 canvas
plus WebAudio, Node 22 standard library only, no dependencies, no network
calls from the game itself.

## The city

Neon Bay is a 3600×3600 coastal grid with six districts — Neon Bay, Old
Docks, Palm Heights, The Strip, Sunset Beach and Harbor Point — sand and open
water along the east edge, and a full day/night cycle. Traffic crawls the
road grid, pedestrians stroll the sidewalks and flee from gunfire, and the
police come after you when the heat is on.

## How to play

- **WASD** move, **Shift** run, **Space** punch, **F** or mouse click to fire
  the pistol, **E** to steal a car or use a shop.
- **Driving:** W accelerate, S brake/reverse, A/D steer. Steal any parked car.
- **Wanted:** 1–5 stars. Crimes raise it, police cars chase and ram you.
  Drive through **Pay 'n' Spray** ($200) to clear it.
- **BUSTED** (caught on foot) or **WASTED** (health hits zero) sends you to
  the hospital minus a fine.
- **Story:** five missions from Rico and Mara — First Wheels ($400), The Drop
  ($650), Hot Pursuit ($900), The Getaway ($1,400) and Neon King ($2,500).
- **Taxi fares** pay $90 a ride while you cruise between missions. Shops sell
  ammo, food and fresh threads. Progress autosaves to localStorage.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/dossier.json from game/ and screenshots/
```

## Screenshots

The four shots are staged deterministically through the game's own
`?shot=…&seed=1` scenes (see `shots.json`): start, driving, a five-star
police chase, and mission 1 at the docks.
