# MERPATI SENJA: Volcanic Island Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bangfadli121-arch/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bangfadli121-arch/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D flight game built for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057) ($500).

Fly an F-22 Raptor jet at golden hour over the volcanic
islands of Indonesia. Thread eight glowing rings in order, manage your fuel,
land on the island runway for a bonus and a refuel, and don't kiss the
terrain.

## How to play

Open `game/index.html` in a desktop browser (everything runs offline, no
network needed).

| Key | Action |
| --- | --- |
| W / S | Throttle up / down (Shift = full, Ctrl = idle) |
| ↑ / ↓ | Pitch |
| ← / → | Bank (turns come from the bank) |
| A / D | Rudder |
| R | Restart the sortie |
| P | Pause |
| T | Take off again after a landing |
| M | Mute |

**Rules:** each ring is worth **+100** and adds **+12 s** of time. Landing on
the runway is worth **+250** and refills the tank. Finishing all eight rings
is worth **+500**. Scraping terrain costs damage; a hard hit — or ditching in
the sea — ends the sortie. You have 4 minutes.

## What's inside

- `game/index.html` — page shell + import map (Three.js is vendored locally)
- `game/src/main.js` — game loop, camera, staging poses for screenshots
- `game/src/terrain.js` — procedural heightmap, volcanic islands, rice terraces, runway
- `game/src/sky.js` — sunset gradient sky, sun disc, clouds, volcano smoke
- `game/src/aircraft.js` — the F-22 Raptor jet (lofted fuselage, twin 2D nozzles, afterburner)
- `game/src/physics.js` — arcade 6-DOF flight model (lift ~ v², drag, throttle, banking turns)
- `game/src/rings.js` — the ring course, pass detection, scoring
- `game/src/hud.js` — 2D canvas HUD: compass tape, dials, attitude indicator, course map
- `game/src/audio.js` — procedural WebAudio engine (no audio files)
- `game/vendor/three.module.min.js` — Three.js 0.170.0, vendored

## Build

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/game, out/screenshots, out/dossier.json
```

MIT licensed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8y9pksda&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
