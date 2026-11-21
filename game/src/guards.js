// Guard behaviour: patrol waypoints, suspicion, alarm, chase and recovery.
// A guard's suspicion rises while the thief is in its cone and in line of
// sight, decays while hidden, and at 100 raises the alarm: every guard
// converges on the last seen spot. Break line of sight and the alarm cools;
// get caught and the level restarts.
import {
  TILE, STEP, GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, SUSPICION_DECAY_PER_SECOND,
  SUSPICION_FULL_SECONDS_CLOSE, ALARM_SECONDS, NOISE_SUSPICION_PER_SECOND,
} from './config.js';
import { visibilityToGuard, tileCentre } from './vision.js';
import { isSolid } from './levels.js';

export const GUARD_CALM = 'calm';
export const GUARD_WARY = 'wary';
export const GUARD_ALARM = 'alarm';

/** Build the guard objects for a level from its patrol definitions. */
export function makeGuards(level) {
  return level.guards.map((def) => {
    const start = tileCentre(def.waypoints[0][0], def.waypoints[0][1]);
    return {
      x: start.x,
      y: start.y,
      facing: 0,
      waypoints: def.waypoints.map(([wx, wy]) => tileCentre(wx, wy)),
      waypointIndex: 1 % def.waypoints.length,
      pauseLeft: def.pause ?? 0.8,
      pauseAtWaypoint: def.pause ?? 0.8,
      speed: GUARD_PATROL_SPEED * (level.guardSpeed ?? 1),
      suspicion: 0,
      state: GUARD_CALM,
      alarmLeft: 0,
      lastSeen: null,
      heardAt: null,
      bob: Math.random() * Math.PI * 2,
    };
  });
}

function moveToward(guard, targetX, targetY, speed, dt) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * TILE * dt);
  guard.x += (dx / distance) * step;
  guard.y += (dy / distance) * step;
  guard.facing = Math.atan2(dy, dx);
  return distance - step < 1;
}

/** One guard's patrol step: walk to the next waypoint, pause, turn, repeat. */
function patrolStep(guard, dt) {
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    if (guard.pauseLeft <= 0) {
      const next = guard.waypoints[guard.waypointIndex];
      guard.facing = Math.atan2(next.y - guard.y, next.x - guard.x);
    }
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (moveToward(guard, target.x, target.y, guard.speed, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = guard.pauseAtWaypoint;
  }
}

/** Chase step: run at the last seen position, then give up and resume patrol. */
function chaseStep(guard, dt) {
  if (!guard.lastSeen) return;
  if (moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD_CHASE_SPEED, dt)) {
    guard.lastSeen = null;
  }
}

/**
 * Update every guard for one step. Returns an event string for the game:
 * 'alarm' when a guard's suspicion first hits 100, '' otherwise.
 */
export function updateGuards(levelData, guards, player, dt, noise) {
  let event = '';
  for (const guard of guards) {
    guard.bob += dt * 6;
    const visibility = visibilityToGuard(levelData, guard, player);
    if (visibility > 0) {
      const rate = (100 / SUSPICION_FULL_SECONDS_CLOSE) * visibility;
      guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      if (guard.suspicion >= 100 && guard.state !== GUARD_ALARM) {
        guard.state = GUARD_ALARM;
        guard.alarmLeft = ALARM_SECONDS;
        event = 'alarm';
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY_PER_SECOND * dt);
    }
    if (guard.state === GUARD_WARY && guard.suspicion < 25) guard.state = GUARD_CALM;
    else if (guard.state === GUARD_CALM && guard.suspicion >= 45) guard.state = GUARD_WARY;

    // A loud noise turns the guard toward it and raises suspicion a little.
    if (noise && noise.active) {
      const d = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (d < noise.radius) {
        guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
        guard.suspicion = Math.min(100, guard.suspicion + NOISE_SUSPICION_PER_SECOND * dt);
        guard.heardAt = { x: player.x, y: player.y };
        if (guard.suspicion >= 45 && guard.state === GUARD_CALM) guard.state = GUARD_WARY;
      }
    }

    if (guard.state === GUARD_ALARM) {
      guard.alarmLeft -= dt;
      if (guard.alarmLeft <= 0) {
        guard.state = guard.suspicion >= 45 ? GUARD_WARY : GUARD_CALM;
        guard.lastSeen = null;
      } else {
        // Every alarmed guard hunts the freshest last-seen spot.
        const spot = guards.find((g) => g.lastSeen)?.lastSeen ?? guard.lastSeen;
        if (spot) {
          const saved = guard.lastSeen;
          guard.lastSeen = spot;
          chaseStep(guard, dt);
          guard.lastSeen = saved;
        }
      }
    } else if (guard.lastSeen && guard.suspicion >= 45) {
      chaseStep(guard, dt);
    } else {
      patrolStep(guard, dt);
    }
  }
  return event;
}

/** Raise the alarm on every guard at once (a guard just spotted the thief). */
export function raiseAlarm(guards, spot) {
  for (const guard of guards) {
    guard.state = GUARD_ALARM;
    guard.alarmLeft = ALARM_SECONDS;
    guard.suspicion = 100;
    guard.lastSeen = { x: spot.x, y: spot.y };
  }
}

/** True when any guard is close enough to grab the thief. */
export function guardCaughtPlayer(guards, player) {
  return guards.some((guard) => {
    const d = Math.hypot(player.x - guard.x, player.y - guard.y);
    const close = d < 0.75 * TILE;
    return close && (guard.state === GUARD_ALARM || guard.suspicion >= 60 || d < 0.45 * TILE);
  });
}

/** The highest suspicion among the guards, for the HUD meter. */
export function maxSuspicion(guards) {
  return guards.reduce((top, guard) => Math.max(top, guard.suspicion), 0);
}

/** True when any guard is alarmed. */
export function anyAlarmed(guards) {
  return guards.some((guard) => guard.state === GUARD_ALARM);
}
