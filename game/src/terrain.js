// The valley itself: a winding river canyon with flat ground where the
// runway sits, plus the course laid along it — eight rings, then the strip.
// Every function here is pure: height(x, z) is the same every time, so the
// renderer, the physics and the autopilot all agree about the ground.
import { COURSE } from './config.js';
import { ridgeNoise, valueNoise } from './random.js';

export function riverX(z) {
  return COURSE.riverAmp * Math.sin(z * COURSE.riverFreq) + 60 * Math.sin(z * 0.00043 + 1.7);
}

/** The ground height in metres at world (x, z). */
export function groundHeight(x, z, seed) {
  const d = Math.abs(x - riverX(z));
  // The riverbed, a flat sandy strip either side, then canyon walls that
  // climb steeply and keep climbing with ridged noise on top.
  const wall = Math.pow(smoothstep(140, 1150, d), 1.55);
  let h = -4 + 330 * wall;
  h += 46 * ridgeNoise(x, z, seed) * smoothstep(90, 700, d);
  h += 9 * valueNoise(x, z, seed + 31, 0.03) * smoothstep(30, 260, d);
  // The runway sits on a flattened shelf at the valley's end.
  const flat = runwayBlend(x, z);
  if (flat > 0) h = h * (1 - flat) + COURSE.runwayY * flat;
  return h;
}

/** 0 away from the strip, 1 on it — used to flatten the shelf and to test landings. */
export function runwayBlend(x, z) {
  let dz;
  if (z >= COURSE.runwayZ0 && z <= COURSE.runwayZ1) dz = 1;
  else {
    const dist = z < COURSE.runwayZ0 ? COURSE.runwayZ0 - z : z - COURSE.runwayZ1;
    dz = 1 - Math.min(1, dist / 260);
  }
  if (dz <= 0) return 0;
  const dx = 1 - smoothstep(COURSE.runwayHalfWidth + 30, COURSE.runwayHalfWidth + 190, Math.abs(x - riverX(COURSE.runwayZ0)));
  return Math.min(1, dz * dx);
}

function smoothstep(a, b, t) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** The course: ring centres along the river, then the runway threshold. */
export function buildCourse(seed) {
  const rings = [];
  for (let index = 0; index < COURSE.ringCount; index += 1) {
    const z = COURSE.ringFirstZ + index * COURSE.ringGapZ;
    // Rings drift gently off the river's line, never in a hard zigzag, so
    // the course is a smooth slalom a plane can actually fly.
    const x = riverX(z) + 30 * Math.sin(index * 1.3 + 0.5);
    // Rings step down toward the runway, so the last one leaves the pilot
    // low and lined up for the landing instead of high over the threshold.
    const y = 168 - 11 * index + 10 * Math.sin(index * 0.9 + 0.6) + valueNoise(index * 13, 5, seed, 0.1) * 8;
    rings.push({ x, y, z, radius: COURSE.ringRadius, passed: false });
  }
  const runway = {
    x: riverX(COURSE.runwayZ0),
    z0: COURSE.runwayZ0,
    z1: COURSE.runwayZ1,
    y: COURSE.runwayY,
    heading: 0,
  };
  return { rings, runway };
}

/** Is the point over water (the river, where the ground dips below the waterline)? */
export function isWater(x, z, seed) {
  return groundHeight(x, z, seed) < 1.5 && Math.abs(x - riverX(z)) < 60;
}
