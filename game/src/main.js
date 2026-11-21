// Game wiring: the state machine (title → play → cleared/caught → win),
// the fixed-step loop, and the ?shot= scenes for screenshots.
// Owns no drawing and no rules: it calls player.js, guards.js and render.js.
import { VIEW_WIDTH, VIEW_HEIGHT, STEP } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { makePlayer, updatePlayer, playerNoise, collectArtifact, reachedExit } from './player.js';
import { makeGuards, updateGuards, guardCaughtPlayer, raiseAlarm } from './guards.js';
import { makeKeys, attachInput } from './input.js';
import {
  makeAudio, unlockAudio, toggleMute, playFootstep, playAlertSting,
  playPickup, playWin, playCaught,
} from './audio.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL_CLEAR, SCREEN_CAUGHT, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const game = {
  levelIndex: 0,
  level: LEVELS[0],
  levelData: null,
  guards: [],
  player: null,
  screen: SCREEN_TITLE,
  keys: makeKeys(),
  audio: makeAudio(),
  time: 0,
  flash: 0,
  caughtCount: 0,
  totalLevels: LEVELS.length,
  shotMode: null,
};

/** (Re)build the current wing: map, guards and thief from scratch. */
game.resetLevel = function resetLevel(index) {
  game.levelIndex = index;
  game.level = LEVELS[index];
  game.levelData = parseLevel(game.level);
  game.guards = makeGuards(game.level);
  game.player = makePlayer(game.levelData.playerStart);
  game.screen = SCREEN_PLAY;
  game.flash = 0;
  announce(`Wing ${index + 1}: ${game.level.name}. Steal every relic, then reach the exit.`);
};

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

/** One fixed simulation step while playing. */
game.step = function step(dt) {
  if (game.screen !== SCREEN_PLAY) return;
  game.time += dt;
  const wasAlarmed = game.guards.some((g) => g.state === 'alarm');
  const moved = updatePlayer(game.levelData, game.player, game.keys, dt);
  if (moved) playFootstep(game.audio, game.player.running);
  const noise = playerNoise(game.player);
  const event = updateGuards(game.levelData, game.guards, game.player, dt, noise);
  if (event === 'alarm') {
    playAlertSting(game.audio);
    game.flash = 1;
    announce('Alarm! A guard spotted you. Break line of sight!');
  } else if (!wasAlarmed && game.guards.some((g) => g.state === 'alarm')) {
    playAlertSting(game.audio);
    game.flash = 1;
  }
  const topSuspicion = game.guards.reduce((top, g) => Math.max(top, g.suspicion), 0);
  if (topSuspicion >= 60 && game.flash <= 0.05) game.flash = 0.6;
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.4);
  const picked = collectArtifact(game.levelData, game.player);
  if (picked) {
    playPickup(game.audio);
    announce(`Relic taken: ${game.player.artifacts} of ${game.levelData.artifacts.length}.`);
  }
  if (reachedExit(game.levelData, game.player)) {
    playWin(game.audio);
    if (game.levelIndex + 1 >= LEVELS.length) {
      game.screen = SCREEN_WIN;
      announce('The clean getaway! All wings cleared.');
    } else {
      game.screen = SCREEN_LEVEL_CLEAR;
      announce('Wing cleared! Press Enter for the next wing.');
    }
    return;
  }
  if (guardCaughtPlayer(game.guards, game.player)) {
    playCaught(game.audio);
    game.caughtCount += 1;
    game.screen = SCREEN_CAUGHT;
    announce('Caught! Press Enter to try the wing again.');
  }
};

/** What Enter / a click does on each screen. */
function confirm() {
  unlockAudio(game.audio);
  if (game.screen === SCREEN_TITLE) {
    game.resetLevel(0);
  } else if (game.screen === SCREEN_LEVEL_CLEAR) {
    game.resetLevel(game.levelIndex + 1);
  } else if (game.screen === SCREEN_CAUGHT) {
    game.resetLevel(game.levelIndex);
  } else if (game.screen === SCREEN_WIN) {
    game.caughtCount = 0;
    game.resetLevel(0);
  }
}

function onAnyKey() {
  unlockAudio(game.audio);
}

attachInput(game.keys, confirm, onAnyKey);

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  while (accumulator >= STEP) {
    if (game.keys.restart && game.screen === SCREEN_PLAY) {
      game.resetLevel(game.levelIndex);
      game.keys.restart = false;
    }
    if (game.keys.mute) {
      toggleMute(game.audio);
      game.keys.mute = false;
    }
    // A staged screenshot scene (?shot=) holds its frame: the autopilot has
    // already played the rules forward to it, and a live loop would let the
    // guards catch a thief who is no longer steering.
    if (!game.shotMode) game.step(STEP);
    accumulator -= STEP;
  }
  render(ctx, game, game.time);
  requestAnimationFrame(frame);
}

// Boot: a fresh wing behind the title screen, or a staged screenshot scene.
game.resetLevel(0);
game.screen = SCREEN_TITLE;
// Exposed for local play-testing only (read the state from the console).
window.__game = game;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.shotMode = shot;
  stageShot(shot, game);
}
requestAnimationFrame(frame);
