# Neon Shores — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/khususcrypto0000-coder/gta6-game-makefun/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/khususcrypto0000-coder/gta6-game-makefun/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built by an AI agent for make.fun's "Make GTA 6" bounty ($1,666 in USDC). Nothing here is borrowed from Rockstar Games or any other commercial game: the city, the people, the cars, the story and the music are all our own.

## The game

Neon Shores is a sun-soaked coastal city you explore on foot and by car. Steal a parked car with **E**, outrun the patrol cars as your wanted stars climb, and work through Mama Rosa's five story jobs — from a first errand at the Motel Palma to the Big Score at the marina. Between jobs, taxi fares and cash drops keep your pockets full.

- A living city: traffic on the avenues, pedestrians on the sidewalks, a park, a beach and open water
- Wanted level (0–5 stars) with police patrols that chase, ram and, at 3 stars, open fire
- Five story missions plus endless taxi fares, with cash, health and ammo pickups
- Combat on foot (punch, shoot) and drive-by shooting from the car window
- HUD with cash, health, wanted stars, mission objective and a live minimap
- Save and continue from localStorage, pause, mute, and a synth soundtrack
- Busted and Wasted screens with fines, hospital respawns, and a "King of Neon Shores" ending

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080.

## Controls

- **WASD / arrows** — move on foot, drive the car
- **E** — enter or steal a car, step out
- **F** — punch
- **Click** — shoot toward the mouse (drive-by while driving)
- **Shift** — sprint
- **P / Esc** — pause · **M** — mute · **R** — restart the run

## Screenshots

Four deterministic renders of the game itself, taken with `?shot=<name>&seed=1`: the title screen, driving with heat, a police chase at the marina, and the first delivery.

## How it is built

Plain static files, no build step, no network, no libraries: `game/index.html` plus ES modules under `game/src/` (one file per job: city, entities, missions, rendering, audio, input, screenshots). `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's `buildDossier` from `vendor/makefun-game.ts`.

Run the hand-in locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
