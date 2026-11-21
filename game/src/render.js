// Canvas drawing: the museum floor, cover, vision cones, guards, the thief,
// the exit, the HUD and every menu screen. One job: turn game state into
// a picture a judge can read at a glance.
import {
  VIEW_WIDTH, VIEW_HEIGHT, TILE, GRID_WIDTH, GRID_HEIGHT,
  PLAYER_RADIUS, GUARD_RADIUS, PALETTE, CONE_RANGE_TILES, CROUCH_CONE_RANGE_TILES,
} from './config.js';
import { conePolygon, tileCentre } from './vision.js';
import { GUARD_ALARM, GUARD_WARY } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL_CLEAR = 'level_clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const ORIGIN_X = (VIEW_WIDTH - GRID_WIDTH * TILE) / 2;
const ORIGIN_Y = 104;
const LEVEL_PIXEL_WIDTH = GRID_WIDTH * TILE;
const LEVEL_PIXEL_HEIGHT = GRID_HEIGHT * TILE;

let lightCanvas = null;

/** Draw the checkerboard marble floor. */
function drawFloor(ctx, levelData) {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const key = `${x},${y}`;
      if (levelData.walls.has(key)) continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorLight : PALETTE.floorDark;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = PALETTE.floorEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
}

/** Draw walls as dark blocks with a lit top edge. */
function drawWalls(ctx, levelData) {
  for (const key of levelData.walls) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(x * TILE, y * TILE, TILE, 5);
  }
}

/** Draw display cases (gold-topped) and statues (pale figures). */
function drawCover(ctx, levelData, time) {
  for (const key of levelData.cover) {
    const [x, y] = key.split(',').map(Number);
    const cx = x * TILE;
    const cy = y * TILE;
    const isStatue = levelData.coverKind?.get(key) === 'S';
    if (isStatue) {
      ctx.fillStyle = PALETTE.coverStatue;
      ctx.beginPath();
      ctx.arc(cx + TILE / 2, cy + TILE / 2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.coverStatueTop;
      ctx.beginPath();
      ctx.arc(cx + TILE / 2, cy + TILE / 2 - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.coverStatue;
      ctx.fillRect(cx + TILE / 2 - 10, cy + TILE - 12, 20, 8);
    } else {
      ctx.fillStyle = PALETTE.coverCase;
      ctx.fillRect(cx + 5, cy + 5, TILE - 10, TILE - 10);
      ctx.fillStyle = PALETTE.coverCaseTop;
      ctx.fillRect(cx + 9, cy + 9, TILE - 18, TILE - 18);
      const shimmer = 0.5 + 0.5 * Math.sin(time * 2 + x + y);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.10 + 0.12 * shimmer})`;
      ctx.fillRect(cx + 9, cy + 9, TILE - 18, 6);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 4.5, cy + 4.5, TILE - 9, TILE - 9);
  }
}

/** Draw one artifact: a bobbing gold diamond with a sparkle. */
function drawArtifacts(ctx, levelData, time) {
  for (const artifact of levelData.artifacts) {
    if (artifact.taken) continue;
    const centre = tileCentre(artifact.x, artifact.y);
    const bob = Math.sin(time * 3 + artifact.x) * 3;
    const pulse = 0.75 + 0.25 * Math.sin(time * 4 + artifact.y);
    ctx.save();
    ctx.translate(centre.x, centre.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.artifact;
    ctx.globalAlpha = pulse;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.restore();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.arc(centre.x + 8, centre.y - 10 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw the exit: a glowing green doorway, grey and barred while locked. */
function drawExit(ctx, levelData, time) {
  const centre = tileCentre(levelData.exit.x, levelData.exit.y);
  const open = levelData.artifacts.every((a) => a.taken);
  const glow = open ? 0.55 + 0.25 * Math.sin(time * 3) : 0.25;
  ctx.save();
  ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
  ctx.globalAlpha = glow;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = open ? '#b8ffdd' : '#93a3b5';
  ctx.lineWidth = 3;
  ctx.strokeRect(centre.x - 14, centre.y - 16, 28, 32);
  ctx.beginPath();
  ctx.moveTo(centre.x, centre.y - 16);
  ctx.lineTo(centre.x, centre.y + 16);
  ctx.stroke();
  ctx.fillStyle = open ? '#062b1a' : '#2b3542';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', centre.x, centre.y + 30);
  if (!open) {
    const left = levelData.artifacts.filter((a) => !a.taken).length;
    ctx.fillStyle = '#c7d0dd';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${left} relic${left === 1 ? '' : 's'} left`, centre.x, centre.y - 26);
  }
  ctx.restore();
}

/** Draw every guard's vision cone, coloured by how suspicious it is. */
function drawCones(ctx, guards, player) {
  for (const guard of guards) {
    const range = player.crouching ? CROUCH_CONE_RANGE_TILES : CONE_RANGE_TILES;
    const points = conePolygon(guard, range);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = guard.state === GUARD_ALARM ? PALETTE.coneAlarm
      : guard.suspicion >= 45 ? PALETTE.coneWary : PALETTE.coneCalm;
    ctx.fill();
    ctx.strokeStyle = guard.state === GUARD_ALARM ? 'rgba(255,90,78,0.8)'
      : 'rgba(255,214,90,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Night lighting: darkness everywhere except around the thief and the cones. */
function drawLighting(ctx, guards, player) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = LEVEL_PIXEL_WIDTH;
    lightCanvas.height = LEVEL_PIXEL_HEIGHT;
  }
  const lctx = lightCanvas.getContext('2d');
  lctx.clearRect(0, 0, LEVEL_PIXEL_WIDTH, LEVEL_PIXEL_HEIGHT);
  lctx.fillStyle = 'rgba(4, 5, 10, 0.30)';
  lctx.fillRect(0, 0, LEVEL_PIXEL_WIDTH, LEVEL_PIXEL_HEIGHT);
  lctx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, radius, strength) => {
    const g = lctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(x, y, radius, 0, Math.PI * 2);
    lctx.fill();
  };
  punch(player.x, player.y, 280, 0.92);
  for (const guard of guards) {
    const range = (player.crouching ? CROUCH_CONE_RANGE_TILES : CONE_RANGE_TILES) * TILE;
    punch(guard.x + Math.cos(guard.facing) * range * 0.55,
      guard.y + Math.sin(guard.facing) * range * 0.55, range * 0.9, 0.55);
  }
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0);
}

/** Draw one guard: red uniform, facing tick, "?" when wary, "!" on alarm. */
function drawGuard(ctx, guard, time) {
  const bob = Math.sin(guard.bob) * 1.5;
  ctx.save();
  ctx.translate(guard.x, guard.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, GUARD_RADIUS - 2, GUARD_RADIUS, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.guardBody;
  ctx.beginPath();
  ctx.arc(0, 0, GUARD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.guardTrim;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick: a torch beam stub showing where the guard looks.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(guard.facing) * GUARD_RADIUS, Math.sin(guard.facing) * GUARD_RADIUS);
  ctx.lineTo(Math.cos(guard.facing) * (GUARD_RADIUS + 10), Math.sin(guard.facing) * (GUARD_RADIUS + 10));
  ctx.stroke();
  // Suspicion arc above the head.
  if (guard.suspicion > 2) {
    ctx.strokeStyle = guard.suspicion >= 60 ? PALETTE.danger : PALETTE.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  const mark = guard.state === GUARD_ALARM ? '!' : guard.state === GUARD_WARY ? '?' : '';
  if (mark) {
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = guard.state === GUARD_ALARM ? PALETTE.danger : PALETTE.gold;
    ctx.fillText(mark, guard.x, guard.y - GUARD_RADIUS - 12 + bob);
  }
}

/** Draw the thief: green, smaller and dashed-ringed while crouched. */
function drawPlayer(ctx, player, time) {
  const radius = player.crouching ? PLAYER_RADIUS - 3 : PLAYER_RADIUS;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.running && player.moving) {
    const pulse = 0.4 + 0.3 * Math.sin(time * 10);
    ctx.strokeStyle = `rgba(255, 120, 90, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2 * TILE * (0.55 + 0.1 * Math.sin(time * 10)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, radius - 2, radius, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerBody;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerTrim;
  ctx.lineWidth = 2;
  if (player.crouching) ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#e8fff2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(player.facing) * radius, Math.sin(player.facing) * radius);
  ctx.lineTo(Math.cos(player.facing) * (radius + 8), Math.sin(player.facing) * (radius + 8));
  ctx.stroke();
  ctx.restore();
}

/** The HUD bar: title, level, relics, suspicion meter, alarm banner. */
function drawHud(ctx, game) {
  const { level, levelData, guards, player } = game;
  ctx.fillStyle = '#12141d';
  ctx.fillRect(0, 0, VIEW_WIDTH, 64);
  ctx.fillStyle = '#232838';
  ctx.fillRect(0, 63, VIEW_WIDTH, 1);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('NIGHT AT THE MUSEUM', 20, 26);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px sans-serif';
  ctx.fillText(level.name, 20, 48);
  // Relic diamonds.
  const total = levelData.artifacts.length;
  const taken = levelData.artifacts.filter((a) => a.taken).length;
  for (let i = 0; i < total; i += 1) {
    const x = 560 + i * 30;
    const y = 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < taken ? PALETTE.artifact : '#3a4152';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '13px sans-serif';
  ctx.fillText(`Relics ${taken}/${total}`, 560, 52);
  // Suspicion meter.
  const suspicion = guards.reduce((top, g) => Math.max(top, g.suspicion), 0);
  const alarmed = guards.some((g) => g.state === GUARD_ALARM);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('SUSPICION', 700, 26);
  ctx.fillStyle = '#232838';
  ctx.fillRect(700, 32, 220, 14);
  ctx.fillStyle = alarmed ? PALETTE.danger : suspicion >= 45 ? '#ff9a2e' : PALETTE.playerBody;
  ctx.fillRect(700, 32, 220 * (suspicion / 100), 14);
  ctx.strokeStyle = '#3a4152';
  ctx.lineWidth = 1;
  ctx.strokeRect(700.5, 32.5, 220, 14);
  ctx.fillStyle = PALETTE.hud;
  ctx.fillText(alarmed ? 'ALARM!' : suspicion >= 45 ? 'Wary…' : 'Hidden', 930, 44);
  // Controls hint, top right: one short line, clear of the suspicion label.
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · Shift run · C crouch · R restart · M mute', VIEW_WIDTH - 20, 26);
  ctx.textAlign = 'left';
}

/** Bottom hint line under the level. */
function drawFooter(ctx, text) {
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_WIDTH / 2, VIEW_HEIGHT - 24);
  ctx.textAlign = 'left';
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(5, 6, 12, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function bigText(ctx, text, y, size, colour) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.fillText(text, VIEW_WIDTH / 2, y);
  ctx.textAlign = 'left';
}

function smallText(ctx, text, y, size, colour) {
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.fillText(text, VIEW_WIDTH / 2, y);
  ctx.textAlign = 'left';
}

/** Draw the whole frame for the current screen. */
export function render(ctx, game, time) {
  const { levelData, guards, player, screen } = game;
  ctx.fillStyle = PALETTE.page;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawHud(ctx, game);
  ctx.save();
  ctx.translate(ORIGIN_X, ORIGIN_Y);
  drawFloor(ctx, levelData);
  drawArtifacts(ctx, levelData, time);
  drawExit(ctx, levelData, time);
  drawCover(ctx, levelData, time);
  drawWalls(ctx, levelData);
  drawLighting(ctx, guards, player);
  drawCones(ctx, guards, player);
  for (const guard of guards) drawGuard(ctx, guard, time);
  drawPlayer(ctx, player, time);
  ctx.restore();

  // Red edge flash on a near miss (suspicion just spiked).
  if (game.flash > 0) {
    ctx.strokeStyle = `rgba(255, 70, 60, ${Math.min(0.9, game.flash)})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW_WIDTH - 10, VIEW_HEIGHT - 10);
  }

  if (screen === SCREEN_TITLE) {
    overlay(ctx, 0.60);
    bigText(ctx, 'NIGHT AT THE MUSEUM', 250, 54, PALETTE.gold);
    smallText(ctx, 'A top-down stealth heist in three wings', 292, 20, PALETTE.hud);
    smallText(ctx, 'Sneak past the patrolling guards — their yellow cones are their eyes.', 360, 17, PALETTE.hudDim);
    smallText(ctx, 'Hide behind display cases and statues: cover blocks their sight.', 388, 17, PALETTE.hudDim);
    smallText(ctx, 'Steal every gold relic, then slip out the green EXIT unseen.', 416, 17, PALETTE.hudDim);
    smallText(ctx, 'If a guard’s suspicion fills, the alarm sounds — break line of sight to cool down.', 444, 17, PALETTE.hudDim);
    bigText(ctx, 'Press ENTER to begin', 530, 26, PALETTE.playerBody);
    smallText(ctx, 'WASD / arrows — move      Shift — run (loud!)      C — crouch (harder to spot)', 580, 16, PALETTE.hudDim);
    smallText(ctx, 'R — restart wing      M — mute', 606, 16, PALETTE.hudDim);
  } else if (screen === SCREEN_LEVEL_CLEAR) {
    overlay(ctx, 0.58);
    bigText(ctx, 'WING CLEARED', 300, 48, PALETTE.exit);
    smallText(ctx, `Every relic in ${game.level.name} is yours — and nobody saw a thing.`, 350, 19, PALETTE.hud);
    smallText(ctx, `Caught ${game.caughtCount} time${game.caughtCount === 1 ? '' : 's'} so far · ${game.levelIndex + 1} of ${game.totalLevels} wings done`, 384, 16, PALETTE.hudDim);
    bigText(ctx, 'Press ENTER for the next wing', 470, 26, PALETTE.playerBody);
  } else if (screen === SCREEN_CAUGHT) {
    overlay(ctx, 0.58);
    bigText(ctx, 'CAUGHT!', 300, 52, PALETTE.danger);
    smallText(ctx, 'A guard grabbed you in the gallery. The relics stay where they are.', 350, 19, PALETTE.hud);
    bigText(ctx, 'Press ENTER to try this wing again', 450, 26, PALETTE.playerBody);
  } else if (screen === SCREEN_WIN) {
    overlay(ctx, 0.62);
    bigText(ctx, 'THE CLEAN GETAWAY', 280, 52, PALETTE.gold);
    smallText(ctx, 'All three wings cleared. Every relic, zero alarms raised that stuck.', 330, 19, PALETTE.hud);
    smallText(ctx, `Caught ${game.caughtCount} time${game.caughtCount === 1 ? '' : 's'} along the way.`, 364, 16, PALETTE.hudDim);
    bigText(ctx, 'Press ENTER to play again', 450, 26, PALETTE.playerBody);
  } else {
    const hint = game.level.hint;
    drawFooter(ctx, hint);
  }
}
