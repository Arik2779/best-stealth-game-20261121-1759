// The thief: movement, crouching, running, noise and artifact pickup.
// Walk is quiet, run is fast but loud (guards hear it), crouch is slow but
// shrinks the guards' vision range. Cover is the only true hiding place.
import {
  TILE, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, PLAYER_CROUCH_SPEED,
  PLAYER_RADIUS, NOISE_RADIUS_TILES,
} from './config.js';
import { tileCentre } from './vision.js';
import { isSolid } from './levels.js';

/** Fresh player state at a level's start tile. */
export function makePlayer(startTile) {
  const start = tileCentre(startTile.x, startTile.y);
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    crouching: false,
    running: false,
    moving: false,
    stepPhase: 0,
    artifacts: 0,
  };
}

/** Try to move by (dx, dy) pixels, sliding along walls and cover. */
function tryMove(levelData, player, dx, dy) {
  const moved = simulateMove(levelData, player.x, player.y, dx, dy);
  player.x = moved.x;
  player.y = moved.y;
}

/**
 * Where a move by (dx, dy) pixels from (x, y) would end up, sliding along
 * walls and cover — the same rule tryMove applies, without moving anything.
 * The autopilot scores directions by where they really lead, not where they
 * point: a direction into a display case scores as standing still.
 */
export function simulateMove(levelData, x, y, dx, dy) {
  const r = PLAYER_RADIUS;
  let nextX = x;
  let nextY = y;
  const tileAt = (px, py) => isSolid(levelData, Math.floor(px / TILE), Math.floor(py / TILE));
  if (!tileAt(x + dx + Math.sign(dx) * r, y - r + 2) &&
      !tileAt(x + dx + Math.sign(dx) * r, y + r - 2)) {
    nextX = x + dx;
  }
  if (!tileAt(nextX - r + 2, y + dy + Math.sign(dy) * r) &&
      !tileAt(nextX + r - 2, y + dy + Math.sign(dy) * r)) {
    nextY = y + dy;
  }
  return { x: nextX, y: nextY };
}

/** One movement step from the held keys. Returns true when the player moved. */
export function updatePlayer(levelData, player, keys, dt) {
  let mx = 0;
  let my = 0;
  if (keys.left) mx -= 1;
  if (keys.right) mx += 1;
  if (keys.up) my -= 1;
  if (keys.down) my += 1;
  player.crouching = !!keys.crouch;
  player.running = !!keys.run && !player.crouching && (mx !== 0 || my !== 0);
  player.moving = mx !== 0 || my !== 0;
  if (!player.moving) return false;
  const length = Math.hypot(mx, my);
  mx /= length;
  my /= length;
  const speed = (player.crouching ? PLAYER_CROUCH_SPEED
    : player.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) * TILE;
  tryMove(levelData, player, mx * speed * dt, my * speed * dt);
  player.facing = Math.atan2(my, mx);
  player.stepPhase += dt * (player.running ? 11 : player.crouching ? 5 : 8);
  return true;
}

/** The noise the player makes right now: only running is loud. */
export function playerNoise(player) {
  if (player.running && player.moving) {
    return { active: true, radius: NOISE_RADIUS_TILES * TILE };
  }
  return { active: false, radius: 0 };
}

/** Pick up an artifact the player is standing on. Returns it, or null. */
export function collectArtifact(levelData, player) {
  for (const artifact of levelData.artifacts) {
    if (artifact.taken) continue;
    const centre = tileCentre(artifact.x, artifact.y);
    if (Math.hypot(player.x - centre.x, player.y - centre.y) < TILE * 0.55) {
      artifact.taken = true;
      player.artifacts += 1;
      return artifact;
    }
  }
  return null;
}

/** True when every artifact is taken and the player stands on the exit. */
export function reachedExit(levelData, player) {
  if (levelData.artifacts.some((a) => !a.taken)) return false;
  if (!levelData.exit) return false;
  const centre = tileCentre(levelData.exit.x, levelData.exit.y);
  return Math.hypot(player.x - centre.x, player.y - centre.y) < TILE * 0.6;
}
