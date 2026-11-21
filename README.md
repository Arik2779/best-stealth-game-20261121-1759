# Night at the Museum — a stealth game

A top-down stealth heist that plays offline in a desktop browser from static
files. You are a thief in a dark museum after closing time: sneak past the
patrolling guards, steal every gold relic, and slip out the green EXIT unseen.

Built for the make.fun bounty
[best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759).

## How to play

Serve the `game/` folder with any static server (for example `node serve.ts`
from this repo, then open http://localhost:8080) and play with keyboard and
mouse. No network request is made; all art is drawn procedurally on canvas
and all sound is synthesised with the Web Audio API.

- **WASD / arrow keys** — move
- **Shift** — run (fast, but loud: guards hear your footsteps and turn)
- **C** — crouch (slow, but shrinks the guards' vision cones)
- **R** — restart the wing
- **M** — mute
- **Enter / click** — confirm on menus

## The rules

- Guards patrol fixed routes with visible yellow vision cones. A cone is a
  guard's eyes: step into one and its suspicion meter starts to fill.
- Display cases and statues are **cover**: they block a guard's line of sight
  completely. Hide behind them.
- Suspicion decays while you are hidden. If a guard's meter fills, the alarm
  sounds and every guard converges on where you were last seen — break line
  of sight and wait for it to cool down.
- If a guard grabs you, the wing restarts.
- The EXIT stays locked until every relic in the wing is stolen.

Three wings of rising difficulty: **The Marble Hall** (2 guards),
**The Gem Gallery** (3 guards), **The Vault Wing** (4 guards).

## Structure

The game's own source is split into files with one clear job each:

- `game/src/config.js` — constants: speeds, vision, palette
- `game/src/levels.js` — the three wings: tile maps and patrol routes
- `game/src/vision.js` — line of sight and vision-cone math
- `game/src/guards.js` — patrol, suspicion, alarm, chase and recovery
- `game/src/player.js` — movement, crouch/run, noise, relic pickup
- `game/src/input.js` — keyboard and mouse input
- `game/src/audio.js` — synthesised footsteps, alert sting, chimes
- `game/src/render.js` — canvas drawing: floor, cover, cones, HUD, screens
- `game/src/shots.js` — the `?shot=start|play|end` screenshot scenes
- `game/src/main.js` — state machine and fixed-step game loop

## License

MIT — see `LICENSE`.
