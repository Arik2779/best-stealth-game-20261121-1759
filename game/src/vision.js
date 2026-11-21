// Line of sight and vision-cone math: what a guard can actually see.
// Walls and cover (display cases, statues) block sight; floor does not.
import { TILE, CONE_RANGE_TILES, CONE_HALF_ANGLE, CROUCH_CONE_RANGE_TILES } from './config.js';
import { blocksSight } from './levels.js';

/** Centre of a tile in pixels. */
export function tileCentre(tileX, tileY) {
  return { x: (tileX + 0.5) * TILE, y: (tileY + 0.5) * TILE };
}

/**
 * Step along the line from (x0, y0) to (x1, y1) in pixels; false when a
 * sight-blocking tile sits between the two points.
 */
export function hasLineOfSight(levelData, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / (TILE * 0.25)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tileX = Math.floor((x0 + dx * t) / TILE);
    const tileY = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(levelData, tileX, tileY)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * How visible the player is to one guard right now: 0 when out of the cone,
 * out of range or behind cover, up to 1 when close and dead centre.
 * Crouching shrinks the guard's effective range.
 */
export function visibilityToGuard(levelData, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  const range = (player.crouching ? CROUCH_CONE_RANGE_TILES : CONE_RANGE_TILES) * TILE;
  if (distance > range) return 0;
  const angleToPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angleToPlayer, guard.facing)) > CONE_HALF_ANGLE) return 0;
  if (!hasLineOfSight(levelData, guard.x, guard.y, player.x, player.y)) return 0;
  const closeness = 1 - distance / range;
  const centred = 1 - Math.abs(angleDifference(angleToPlayer, guard.facing)) / CONE_HALF_ANGLE;
  return Math.min(1, 0.35 + 0.65 * closeness * (0.5 + 0.5 * centred));
}

/** Points of the cone polygon, for drawing and for the "is the player in it" glow. */
export function conePolygon(guard, rangeTiles) {
  const range = rangeTiles * TILE;
  const points = [{ x: guard.x, y: guard.y }];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const a = guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / steps;
    points.push({ x: guard.x + Math.cos(a) * range, y: guard.y + Math.sin(a) * range });
  }
  return points;
}
