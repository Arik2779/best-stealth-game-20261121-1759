// The three museum wings: tile maps plus guard patrol routes.
// Legend: '#' wall, '.' floor, 'C' display case (cover), 'S' statue (cover),
// 'A' artifact to steal, 'E' exit, 'P' where the thief starts.
// Cover blocks both movement and a guard's line of sight.
import { GRID_WIDTH, GRID_HEIGHT } from './config.js';

export const LEVELS = [
  {
    name: 'Level 1 — The Marble Hall',
    hint: 'Three relics, two guards. Walk slow, watch the cones.',
    guardSpeed: 1.0,
    map: [
      '####################',
      '#P....C......C.....#',
      '#.....C......C..A..#',
      '#..C.....C.........#',
      '#.....C.....C......#',
      '#.A....C.....C.....#',
      '#.....C.....C......#',
      '#..C.....C....C....#',
      '#.....C.....C......#',
      '#..C....A..C.......#',
      '#.....C.....C....E.#',
      '####################',
    ],
    guards: [
      { waypoints: [[10, 1], [10, 10]], pause: 1.0 },
      { waypoints: [[4, 10], [16, 10], [16, 1], [4, 1]], pause: 0.8 },
    ],
  },
  {
    name: 'Level 2 — The Gem Gallery',
    hint: 'Three guards, tighter lanes. Crouch (C) to shrink their cones.',
    guardSpeed: 1.25,
    map: [
      '####################',
      '#P...S....C....A...#',
      '#....S....C........#',
      '#.C.....C....S.....#',
      '#.C..A..C....S..C..#',
      '#.....C....C.......#',
      '#..S.....C....A....#',
      '#..S..C.....C..S...#',
      '#.....C.....C......#',
      '#.C.......C....S...#',
      '#....C.....S.....E.#',
      '####################',
    ],
    guards: [
      { waypoints: [[6, 1], [6, 10]], pause: 0.7 },
      { waypoints: [[13, 10], [13, 1]], pause: 0.7 },
      { waypoints: [[2, 5], [17, 5]], pause: 0.9 },
    ],
  },
  {
    name: 'Level 3 — The Vault Wing',
    hint: 'Four guards, four relics. Run only when no cone can see you.',
    guardSpeed: 1.5,
    map: [
      '####################',
      '#P..C....S....A....#',
      '#...C....S.........#',
      '#.S....C.....C..A..#',
      '#.S..A.C.....C.....#',
      '#.....C..S....C....#',
      '#..C.....S..A......#',
      '#..C..S.....C..S...#',
      '#....S..C.....C....#',
      '#.......C..S....C..#',
      '#....C.....C.....E.#',
      '####################',
    ],
    guards: [
      { waypoints: [[6, 1], [6, 10]], pause: 0.5 },
      { waypoints: [[14, 10], [14, 1]], pause: 0.5 },
      { waypoints: [[2, 8], [17, 8]], pause: 0.6 },
      { waypoints: [[17, 2], [2, 2], [2, 6], [17, 6]], pause: 0.6 },
    ],
  },
];

/** Parse one level map into walls, cover, artifacts, exit and player start. */
export function parseLevel(level) {
  const walls = new Set();
  const cover = new Set();
  const coverKind = new Map();
  const artifacts = [];
  let exit = null;
  let playerStart = null;
  for (let y = 0; y < level.map.length; y += 1) {
    const row = level.map[y];
    for (let x = 0; x < row.length; x += 1) {
      const key = `${x},${y}`;
      const cell = row[x];
      if (cell === '#') walls.add(key);
      else if (cell === 'C' || cell === 'S') {
        cover.add(key);
        coverKind.set(key, cell);
      } else if (cell === 'A') artifacts.push({ x, y, taken: false });
      else if (cell === 'E') exit = { x, y };
      else if (cell === 'P') playerStart = { x, y };
    }
  }
  return { walls, cover, coverKind, artifacts, exit, playerStart };
}

/** True when the tile at (x, y) blocks movement. */
export function isSolid(levelData, x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return true;
  return levelData.walls.has(`${x},${y}`) || levelData.cover.has(`${x},${y}`);
}

/** True when the tile at (x, y) blocks a guard's line of sight. */
export function blocksSight(levelData, x, y) {
  return isSolid(levelData, x, y);
}
