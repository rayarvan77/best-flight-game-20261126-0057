// The autopilot: a steady hand that flies the course on its own. It steers
// the screenshot scenes (and the title screen's background flight) toward the
// next ring, then down onto the runway to land. It is deliberately simple —
// aim at the target, hold 55 m/s, flare over the strip — so the scenes it
// stages are flights a player could really make.
//
// The heading loop is a turn-rate controller, not a bare bank: it asks for
// the turn rate that closes the heading error, then banks only as much as
// that rate needs. Banking straight at the error weaves across the course;
// asking for a rate and easing off as the error closes flies it straight.
import { COURSE, PLANE } from './config.js';
import { groundHeight } from './terrain.js';

const GRAVITY = 9.81;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function createAutopilot(seed) {
  /** Stick input for this step, from the plane's state and the next target. */
  function steer(state) {
    const plane = state.plane;
    const ring = state.rings[state.nextRing];
    let targetX;
    let targetY;
    let targetZ;
    let landing = false;
    if (ring) {
      targetX = ring.x;
      targetY = ring.y;
      targetZ = ring.z;
    } else {
      // No rings left: line up on the runway from far out and come down a
      // gentle glide path to a fixed touchdown point, flaring to a slow sink
      // over the strip. The target is a point on the glide path just 150 m
      // ahead of the nose — aiming at a far point corrects altitude too
      // weakly, and the plane floats past the strip. Past the touchdown
      // point the target stays ahead, down the strip, never behind.
      landing = true;
      targetX = state.runway.x;
      const touchdownZ = state.runway.z0 + 200;
      const glideY = (z) => COURSE.runwayY + 10 + Math.max(0, touchdownZ - z) * 0.085;
      targetZ = plane.z + 150;
      targetY = plane.z < touchdownZ ? glideY(targetZ) : COURSE.runwayY + 8;
    }

    const dx = targetX - plane.x;
    const dz = targetZ - plane.z;
    const desiredHeading = Math.atan2(dx, dz);
    const headingError = wrapAngle(desiredHeading - plane.heading);
    // The turn rate that closes the error, capped at about 10 degrees a
    // second; the bank follows from the turn rate and the speed. The flight
    // model takes the stick in -1..1, so the bank in radians is divided by
    // the model's maximum bank to give the stick position.
    const desiredTurn = clamp(headingError * 0.9, -0.18, 0.18);
    const bankRad = clamp(Math.atan((desiredTurn * plane.speed) / GRAVITY), -0.65, 0.65);
    const roll = clamp(bankRad / PLANE.maxRoll, -1, 1);
    // Pitch toward the target's height, eased so the ride stays smooth.
    // The stick is -1..1 too: the pitch error in radians is divided by the
    // model's maximum pitch, so a stick of -0.2 really means -0.11 radians.
    const horizontal = Math.max(60, Math.sqrt(dx * dx + dz * dz));
    let desiredPitch = clamp(Math.atan2(targetY - plane.y, horizontal), -0.4, 0.4);
    if (landing) {
      const clearance = plane.y - groundHeight(plane.x, plane.z, seed);
      // Flare: low over the strip, trade the glide for a slow sink — about
      // 3 m/s at the wheels, inside the landing check's gentle limit. The
      // sink stays firm enough to actually reach the strip before it ends.
      if (clearance < 12) desiredPitch = -0.07;
      else if (clearance < 30) desiredPitch = Math.min(desiredPitch, -0.08);
      else desiredPitch = clamp(desiredPitch, -0.18, 0.05);
    }
    const pitch = clamp(((desiredPitch - plane.pitch) / PLANE.maxPitch) * 2.2, -1, 1);
    // Hold cruise speed, slower on final approach, with a gentle hand on
    // the throttle instead of banging it between idle and full.
    const wantSpeed = landing && plane.z > state.runway.z0 - 400 ? 42 : PLANE.cruiseSpeed;
    const throttle = clamp((wantSpeed - plane.speed) * 0.06, -1, 1);
    // Never fly into the ground: if the canyon floor is close below, climb.
    const ground = groundHeight(plane.x, plane.z + 120, seed);
    const clearance = plane.y - ground;
    const safePitch = clearance < 45 && !landing ? 1 : pitch;
    return { pitch: safePitch, roll, throttle, yaw: 0 };
  }

  return { steer };
}
