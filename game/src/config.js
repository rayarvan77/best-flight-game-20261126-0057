// Crimson Canyon — Ring Run: every tuning number and colour in one place.
// The world is metres, the sky is golden hour, and nothing here depends on
// the size of the browser window: the renderer scales to the canvas.
export const STEP = 1 / 60;

export const COURSE = {
  startX: 0,
  startY: 130,
  startZ: 0,
  // The river winds gently east and west as it runs north (+z).
  riverAmp: 190,
  riverFreq: 0.0016,
  // Rings sit on the river's line; the runway waits at the valley's end.
  ringCount: 8,
  ringFirstZ: 550,
  ringGapZ: 480,
  ringRadius: 26,
  runwayZ0: 4500,
  runwayZ1: 5200,
  runwayHalfWidth: 16,
  runwayY: 8,
  ceilingY: 620,
};

export const PLANE = {
  minSpeed: 24,
  stallSpeed: 30,
  cruiseSpeed: 55,
  maxSpeed: 102,
  // How fast the nose follows the stick, in radians per second.
  pitchRate: 0.9,
  rollRate: 1.6,
  maxPitch: 0.55,
  maxRoll: 1.05,
  // Degrees of heading change per second from the rudder keys alone.
  yawRate: 0.35,
  // Throttle slides 0..1 this fast when a key is held.
  throttleRate: 0.55,
  crashSink: 4.5,
  landSink: 5,
  landSpeed: 62,
};

export const SCORE = {
  ring: 100,
  landing: 250,
  // Time bonus starts at this many points and falls by this much per second.
  timeBonusStart: 600,
  timeBonusPerSecond: 2,
};

export const PALETTE = {
  skyTop: '#2e4a7a',
  skyMid: '#7d9cc4',
  skyHorizon: '#f7b267',
  sunCore: '#fff3c4',
  sunGlow: '#ffcf7d',
  cloud: 'rgba(255, 244, 224, 0.75)',
  ridgeFar: '#8a7f9e',
  ridgeNear: '#6b5f7d',
  rockHigh: '#9a7d63',
  rockMid: '#7d6a52',
  scrub: '#6f7d4a',
  sand: '#c2a878',
  water: '#3f7fa8',
  waterDeep: '#2c5f84',
  runway: '#3a3f46',
  runwayMark: '#f2ede2',
  ring: '#ffb703',
  ringPassed: '#7ddc7d',
  planeRed: '#c0392b',
  planeCream: '#f5efe0',
  planeGlass: '#9fd8ef',
  panel: '#23272e',
  panelEdge: '#3a4048',
  gaugeFace: '#10151c',
  gaugeLit: '#7fe7c4',
  gaugeAmber: '#ffb703',
  hudText: '#f4f7fa',
  hudDim: '#c9d4de',
  warnRed: '#ff5a4e',
  warnAmber: '#ffb703',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best (fastest) finished time is kept between visits. */
export const BEST_KEY = 'crimson-canyon-ring-run.best';
