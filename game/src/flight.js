// The flight model and the rules, with no drawing and no browser in it: the
// plane's position, speed, pitch and bank, the rings, the runway, crashes and
// landings. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react — chime, thud, fanfare — without the world
// knowing about sound or screens.
import { COURSE, PLANE, SCORE, STEP } from './config.js';
import { buildCourse, groundHeight, riverX } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_STALL = 8;

const GRAVITY = 9.81;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function createWorld(seed) {
  const course = buildCourse(seed);
  const plane = {
    x: COURSE.startX,
    y: COURSE.startY,
    z: COURSE.startZ,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 42,
    throttle: 0.55,
    verticalSpeed: 0,
  };
  const state = {
    plane,
    rings: course.rings,
    runway: course.runway,
    ringsPassed: 0,
    score: 0,
    elapsed: 0,
    finished: false,
    crashed: false,
    crashReason: '',
    stalled: false,
    nextRing: 0,
    // Signed distance to the next ring's plane, for crossing detection.
    ringSide: 0,
  };

  function reset() {
    plane.x = COURSE.startX;
    plane.y = COURSE.startY;
    plane.z = COURSE.startZ;
    plane.heading = 0;
    plane.pitch = 0;
    plane.roll = 0;
    plane.speed = 42;
    plane.throttle = 0.55;
    plane.verticalSpeed = 0;
    for (const ring of state.rings) ring.passed = false;
    state.ringsPassed = 0;
    state.score = 0;
    state.elapsed = 0;
    state.finished = false;
    state.crashed = false;
    state.crashReason = '';
    state.stalled = false;
    state.nextRing = 0;
    state.ringSide = ringPlaneSide();
  }

  /** Signed distance from the plane to the next ring's plane (its normal faces the course). */
  function ringPlaneSide() {
    const ring = state.rings[state.nextRing];
    if (!ring) return 0;
    const nx = Math.sin(0);
    const nz = Math.cos(0);
    return (plane.x - ring.x) * nx + (plane.z - ring.z) * nz;
  }

  function groundAt() {
    return groundHeight(plane.x, plane.z, seed);
  }

  function step(dt, input) {
    if (state.finished || state.crashed) return 0;
    let events = 0;
    state.elapsed += dt;

    // Throttle slides toward where the pilot holds it.
    plane.throttle = clamp(plane.throttle + input.throttle * PLANE.throttleRate * dt, 0, 1);
    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += (targetSpeed - plane.speed) * 0.32 * dt * 4;

    // Pitch and bank follow the stick; the plane gently levels itself when
    // the stick is centred, as a trainer does.
    const targetPitch = clamp(input.pitch * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
    plane.pitch += clamp(targetPitch - plane.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
    plane.pitch *= 1 - 0.12 * dt;
    const targetRoll = clamp(input.roll * PLANE.maxRoll, -PLANE.maxRoll, PLANE.maxRoll);
    plane.roll += clamp(targetRoll - plane.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
    plane.roll *= 1 - 0.25 * dt;

    // A banked plane turns: the heading rate follows the bank and the speed.
    // Banking right (positive roll) turns the nose right, toward higher heading.
    plane.heading += (GRAVITY * Math.tan(plane.roll) / Math.max(plane.speed, 20)) * dt;
    plane.heading += input.yaw * PLANE.yawRate * dt;

    // Lift falls away below stall speed and the nose drops.
    const stalled = plane.speed < PLANE.stallSpeed;
    if (stalled && !state.stalled) events |= EVENT_STALL;
    state.stalled = stalled;
    let verticalSpeed = plane.speed * Math.sin(plane.pitch);
    if (stalled) verticalSpeed -= (PLANE.stallSpeed - plane.speed) * 0.55;
    plane.verticalSpeed = verticalSpeed;

    const fx = Math.sin(plane.heading);
    const fz = Math.cos(plane.heading);
    plane.x += fx * plane.speed * dt;
    plane.z += fz * plane.speed * dt;
    plane.y += verticalSpeed * dt;
    if (plane.y > COURSE.ceilingY) plane.y = COURSE.ceilingY;

    // Ring crossings: the plane must pass through the hoop, not beside it.
    // Crossing the ring's plane off-centre misses it outright — the pilot
    // gets one shot at each ring, so a miss never turns into circling back.
    const ring = state.rings[state.nextRing];
    if (ring) {
      const side = ringPlaneSide();
      if (state.ringSide < 0 && side >= 0) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        const dz = plane.z - ring.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < ring.radius * 0.98) {
          ring.passed = true;
          state.ringsPassed += 1;
          state.score += SCORE.ring;
          state.nextRing += 1;
          events |= EVENT_RING;
        } else {
          state.nextRing += 1;
        }
        state.ringSide = ringPlaneSide();
      } else {
        state.ringSide = side;
      }
      // A ring left far behind without being flown through is simply missed.
      if (plane.z > ring.z + 120 && !ring.passed) {
        state.nextRing += 1;
        state.ringSide = ringPlaneSide();
      }
    }

    // The ground decides the ending: a gentle touchdown on the strip is a
    // landing, anything else at ground level is a crash.
    const ground = groundAt();
    if (plane.y <= ground + 1.2) {
      const onStrip = Math.abs(plane.x - state.runway.x) < COURSE.runwayHalfWidth
        && plane.z > state.runway.z0 && plane.z < state.runway.z1;
      const aligned = Math.abs(wrapAngle(plane.heading - state.runway.heading)) < 0.35;
      const gentle = plane.verticalSpeed > -PLANE.landSink && plane.speed < PLANE.landSpeed;
      plane.y = ground + 1.2;
      if (onStrip && aligned && gentle) {
        state.finished = true;
        state.score += SCORE.landing + Math.max(0, Math.round(SCORE.timeBonusStart - state.elapsed * SCORE.timeBonusPerSecond));
        events |= EVENT_LANDED;
      } else {
        state.crashed = true;
        const inRiver = ground < 1.5 && Math.abs(plane.x - riverX(plane.z)) < 60;
        state.crashReason = onStrip ? 'You came down too hard on the runway.'
          : inRiver ? 'You ditched in the river.'
            : 'You hit the canyon wall.';
        events |= EVENT_CRASH;
      }
    }
    return events;
  }

  reset();
  return { state, plane, reset, step, groundAt };
}
