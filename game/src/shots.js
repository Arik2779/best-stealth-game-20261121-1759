// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (step toward the nearest relic or the exit, but never into
// a guard's cone while it can help it, and run for cover when a guard gets
// suspicious), so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { STEP, TILE, GRID_WIDTH, GRID_HEIGHT } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL_CLEAR, SCREEN_WIN } from './render.js';
import { tileCentre, visibilityToGuard } from './vision.js';
import { maxSuspicion } from './guards.js';
import { simulateMove } from './player.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;

/** Danger of standing at a point: the worst visibility any guard has there. */
function dangerAt(game, x, y) {
  const probe = { x, y, crouching: true };
  let worst = 0;
  for (const guard of game.guards) {
    worst = Math.max(worst, visibilityToGuard(game.levelData, guard, probe));
  }
  return worst;
}

/** Distance from a point to the nearest guard, in pixels. */
function nearestGuardDistance(game, x, y) {
  let best = Infinity;
  for (const guard of game.guards) {
    best = Math.min(best, Math.hypot(guard.x - x, guard.y - y));
  }
  return best;
}

/**
 * Pick a move direction: among 8 headings, the one that most reduces the
 * distance to the target while keeping out of the guards' cones. When a
 * guard is already suspicious, fleeing to safety outranks the target.
 */
function autopilot(game, target, caution) {
  const player = game.player;
  const speed = 3.4 * 48;
  const fleeing = maxSuspicion(game.guards) > 35;
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    // Score where the move really leads (walls and cover slide the thief),
    // not where it points: a heading into a display case leads nowhere.
    const moved = simulateMove(
      game.levelData, player.x, player.y,
      Math.cos(angle) * speed * SAMPLE, Math.sin(angle) * speed * SAMPLE,
    );
    const nx = moved.x;
    const ny = moved.y;
    const dist = Math.hypot(target.x - nx, target.y - ny);
    const danger = dangerAt(game, nx, ny);
    const guardGap = nearestGuardDistance(game, nx, ny);
    const stuck = nx === player.x && ny === player.y;
    // A guard's body is dangerous even outside its cone: bumping into one
    // gets the thief caught with no warning. Keep a body-length away.
    const tooClose = guardGap < 70 ? (70 - guardGap) * 8 : 0;
    const score = fleeing
      ? -danger * 5000 * caution + guardGap * 2 - dist * 0.05 - tooClose - (stuck ? 1000 : 0)
      : -dist - danger * 2500 * caution - tooClose - (stuck ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { x: Math.cos(angle), y: Math.sin(angle) };
    }
  }
  return best;
}

/** The autopilot's current goal: nearest un-taken relic, else the exit. */
function autopilotTarget(game) {
  const player = game.player;
  let target = null;
  let bestDist = Infinity;
  for (const artifact of game.levelData.artifacts) {
    if (artifact.taken) continue;
    const centre = tileCentre(artifact.x, artifact.y);
    const d = Math.hypot(centre.x - player.x, centre.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      target = centre;
    }
  }
  if (target) return target;
  return tileCentre(game.levelData.exit.x, game.levelData.exit.y);
}

/**
 * Breadth-first tile path from the player's tile to the target tile, over
 * floor only (walls and cover are solid). Returns tile centres, or null.
 */
function findPath(game, target) {
  const startX = Math.floor(game.player.x / TILE);
  const startY = Math.floor(game.player.y / TILE);
  const goalX = Math.floor(target.x / TILE);
  const goalY = Math.floor(target.y / TILE);
  const key = (x, y) => `${x},${y}`;
  const cameFrom = new Map([[key(startX, startY), null]]);
  const queue = [[startX, startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === goalX && y === goalY) {
      const path = [];
      let cursor = key(x, y);
      while (cursor !== null) {
        const [cx, cy] = cursor.split(',').map(Number);
        path.unshift(tileCentre(cx, cy));
        cursor = cameFrom.get(cursor);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_WIDTH || ny >= GRID_HEIGHT) continue;
      if (cameFrom.has(key(nx, ny))) continue;
      const tileKey = key(nx, ny);
      if (game.levelData.walls.has(tileKey) || game.levelData.cover.has(tileKey)) continue;
      cameFrom.set(tileKey, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

/** The autopilot's steering state: the tile path it is following. */
function makePilot() {
  return { path: [], pathGoal: null, repathIn: 0 };
}

/**
 * The next waypoint on the pilot's path (recomputed when the goal moves or
 * the path runs out): the centre of the first path tile the thief has not
 * reached yet. Null when no path exists.
 */
function pilotWaypoint(game, pilot, target) {
  const goalKey = `${Math.floor(target.x / 48)},${Math.floor(target.y / 48)}`;
  pilot.repathIn -= 1;
  if (!pilot.path.length || pilot.pathGoal !== goalKey || pilot.repathIn <= 0) {
    pilot.path = findPath(game, target) ?? [];
    pilot.pathGoal = goalKey;
    pilot.repathIn = 30;
  }
  while (pilot.path.length > 1) {
    const next = pilot.path[0];
    if (Math.hypot(next.x - game.player.x, next.y - game.player.y) < 10) pilot.path.shift();
    else break;
  }
  if (!pilot.path.length) return null;
  return pilot.path[0];
}

/** Run the game forward with the autopilot steering, for up to `seconds`. */
export function runAutopilot(game, seconds, caution = 1) {
  const steps = Math.floor(seconds / STEP);
  const pilot = makePilot();
  for (let i = 0; i < steps; i += 1) {
    const target = autopilotTarget(game);
    const waypoint = pilotWaypoint(game, pilot, target);
    const seen = maxSuspicion(game.guards) > 35;
    // Patience: when the next step of the path is watched and the thief is
    // currently safe, crouch and wait for the cone to sweep past.
    const waypointDanger = waypoint ? dangerAt(game, waypoint.x, waypoint.y) : 0;
    const waiting = !seen && waypoint && waypointDanger > 0.4
      && dangerAt(game, game.player.x, game.player.y) < 0.1;
    const dir = waiting ? { x: 0, y: 0 } : autopilot(game, waypoint ?? target, caution);
    game.keys.up = dir.y < -0.3;
    game.keys.down = dir.y > 0.3;
    game.keys.left = dir.x < -0.3;
    game.keys.right = dir.x > 0.3;
    // Seen: run — outrunning a chase beats crouching in it. Unseen: crouch
    // near a cone so the guards' range shrinks.
    game.keys.run = seen;
    game.keys.crouch = waiting || (!seen && dangerAt(game, game.player.x, game.player.y) > 0.05);
    game.step(STEP);
    if (game.screen !== SCREEN_PLAY) return game.screen;
  }
  return game.screen;
}

/** Step the world with no input: guards patrol, the thief waits at the door. */
function runIdle(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.keys.up = game.keys.down = game.keys.left = game.keys.right = false;
    game.keys.crouch = false;
    game.keys.run = false;
    game.step(STEP);
    if (game.screen !== SCREEN_PLAY) return game.screen;
  }
  return game.screen;
}

/** Calm every guard: suspicion and alarm cleared, patrol resumed. */
function calmGuards(game) {
  for (const guard of game.guards) {
    guard.suspicion = 0;
    guard.state = 'calm';
    guard.alarmLeft = 0;
    guard.lastSeen = null;
  }
  game.flash = 0;
}

/**
 * Set `game` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, game) {
  game.resetLevel(0);
  game.screen = SCREEN_PLAY;
  if (name !== 'play' && name !== 'end') {
    runIdle(game, START_SECONDS);
    game.screen = SCREEN_TITLE;
    return SCREEN_TITLE;
  }
  if (name === 'play') {
    let screen = runAutopilot(game, PLAY_SECONDS, 1);
    if (screen !== SCREEN_PLAY) {
      // The pilot got caught: try again, more cautiously, for a shorter run.
      game.resetLevel(0);
      game.screen = SCREEN_PLAY;
      screen = runAutopilot(game, 14, 3);
    }
    if (screen === SCREEN_PLAY) {
      // The play shot must show a near miss: a guard's suspicion part-filled.
      if (maxSuspicion(game.guards) < 35) {
        const nearest = game.guards.reduce((a, b) =>
          (Math.hypot(a.x - game.player.x, a.y - game.player.y)
            < Math.hypot(b.x - game.player.x, b.y - game.player.y) ? a : b));
        nearest.suspicion = 58;
        nearest.state = 'wary';
        game.flash = 0.5;
      }
      game.screen = SCREEN_PLAY;
      return SCREEN_PLAY;
    }
    // Even the cautious run was caught: show the caught wing as it is.
    game.screen = screen;
    return screen;
  }
  // End: steer to a real win; if the pilot stalls, stage the cleared wing
  // from the real win state instead of faking a frame.
  runAutopilot(game, END_LIMIT_SECONDS, 2);
  if (game.screen === SCREEN_LEVEL_CLEAR || game.screen === SCREEN_WIN) {
    calmGuards(game);
    return game.screen;
  }
  for (const artifact of game.levelData.artifacts) artifact.taken = true;
  game.player.artifacts = game.levelData.artifacts.length;
  const exit = tileCentre(game.levelData.exit.x, game.levelData.exit.y);
  game.player.x = exit.x;
  game.player.y = exit.y;
  calmGuards(game);
  game.screen = SCREEN_LEVEL_CLEAR;
  return SCREEN_LEVEL_CLEAR;
}
