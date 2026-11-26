// A small seeded random generator (mulberry32) and the smooth value noise the
// canyon is built from. The same seed always grows the same valley, which is
// what makes the screenshot scenes repeatable frame for frame.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic 2D lattice hash: the same (x, z, seed) always gives the same value. */
function lattice(x, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth noise in [-1, 1] at world scale; frequency is in cycles per metre. */
export function valueNoise(x, z, seed, frequency) {
  const fx = x * frequency;
  const fz = z * frequency;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const a = lattice(ix, iz, seed);
  const b = lattice(ix + 1, iz, seed);
  const c = lattice(ix, iz + 1, seed);
  const d = lattice(ix + 1, iz + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

/** Two octaves of the same noise, for ridges that read at more than one scale. */
export function ridgeNoise(x, z, seed) {
  return valueNoise(x, z, seed, 0.004) * 0.7 + valueNoise(x, z, seed + 7, 0.013) * 0.3;
}
