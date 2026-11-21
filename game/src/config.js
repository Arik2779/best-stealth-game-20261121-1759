// Shared constants for Night at the Museum: canvas size, tile size, speeds,
// detection numbers and the palette. One job: the numbers every other file reads.
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 800;
export const TILE = 48;
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 12;
export const HUD_HEIGHT = 64;

// Player movement, in tiles per second.
export const PLAYER_WALK_SPEED = 3.4;
export const PLAYER_RUN_SPEED = 5.4;
export const PLAYER_CROUCH_SPEED = 1.9;
export const PLAYER_RADIUS = 13;

// Guard movement, in tiles per second.
export const GUARD_PATROL_SPEED = 1.55;
export const GUARD_CHASE_SPEED = 2.9;
export const GUARD_RADIUS = 14;

// Vision: cone range in tiles, half-angle in radians, suspicion 0..100.
export const CONE_RANGE_TILES = 5.2;
export const CONE_HALF_ANGLE = 0.61;
export const CROUCH_CONE_RANGE_TILES = 3.1;
export const SUSPICION_FULL_SECONDS_CLOSE = 1.1;
export const SUSPICION_DECAY_PER_SECOND = 26;
export const ALARM_SECONDS = 4.5;
export const CAUGHT_DISTANCE_TILES = 0.75;
export const NOISE_RADIUS_TILES = 3.2;
export const NOISE_SUSPICION_PER_SECOND = 22;

// Fixed simulation step used by the game loop and the screenshot scenes.
export const STEP = 1 / 60;

export const PALETTE = {
  page: '#0b0d12',
  floorLight: '#454b5e',
  floorDark: '#3d4252',
  floorEdge: '#2b2f3c',
  wall: '#1c1f2a',
  wallTop: '#4a5068',
  coverCase: '#7d6a3f',
  coverCaseTop: '#c9a94f',
  coverStatue: '#8f97ad',
  coverStatueTop: '#d7deef',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneWary: 'rgba(255, 160, 40, 0.34)',
  coneAlarm: 'rgba(255, 70, 60, 0.42)',
  guardBody: '#c94f43',
  guardTrim: '#f2e6c9',
  playerBody: '#3fae7a',
  playerTrim: '#e8fff2',
  artifact: '#ffd94a',
  exit: '#39d98a',
  exitLocked: '#5c6b7a',
  hud: '#e8ecf4',
  hudDim: '#9aa3b5',
  danger: '#ff5a4e',
  gold: '#ffd94a',
};
