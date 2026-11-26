// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, crashed and landed. The title screen flies itself
// on autopilot behind the card, so the game is alive before the first key.
//
// ?seed=N fixes the canyon and the course. ?shot=start|play|cockpit|end
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CRASH, EVENT_LANDED, EVENT_RING } from './flight.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createInstruments } from './instruments.js';
import { createAutopilot } from './autopilot.js';
import { SCREEN_LANDED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas, seed);
const instruments = createInstruments();
const audio = createAudio();
const autopilot = createAutopilot(seed);

function readBest() {
  try {
    return Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  world.state.groundNow = world.groundAt();
  let painted = 0;
  function paint() {
    drawFrame(world.state, scene.screen, scene.camera, readBest(), 8);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Paint one frame: sky, terrain, course, aircraft, instruments, HUD, screen. */
function drawFrame(state, screen, camera, best, time) {
  const plane = state.plane;
  // A finished run gets the hero camera: high behind the plane, looking
  // down the strip, so the landing reads in the frame.
  const cam = screen === SCREEN_LANDED || screen === SCREEN_OVER
    ? renderer.landedCamera(plane)
    : camera === 'cockpit' ? renderer.cockpitCamera(plane) : renderer.chaseCamera(plane);
  const ctx = canvas.getContext('2d');
  const w = renderer.width;
  const h = renderer.height;
  ctx.save();
  // Roll the whole world with the bank; the HUD stays level.
  ctx.translate(w / 2, h * 0.52);
  ctx.rotate(-plane.roll * (camera === 'cockpit' ? 1 : 0.55));
  ctx.translate(-w / 2, -h * 0.52);
  renderer.drawSky(cam, plane.heading, time);
  renderer.drawTerrain(cam, plane);
  state.rings.forEach((ring, index) => renderer.drawRing(cam, ring, index, index === state.nextRing, time));
  renderer.drawRunway(cam, state.runway, time);
  ctx.restore();
  if (camera === 'chase') renderer.drawPlane(time, plane.roll);
  else instruments.drawCockpit(ctx, w, h, state, time);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
    renderer.drawNextRingPointer(cam, state);
  }
  instruments.drawHud(ctx, w, h, state, camera, time);
  if (screen === SCREEN_TITLE) instruments.drawTitle(ctx, w, h, best);
  else if (screen === SCREEN_PAUSED) instruments.drawPaused(ctx, w, h);
  else if (screen === SCREEN_OVER) instruments.drawCrashed(ctx, w, h, state);
  else if (screen === SCREEN_LANDED) instruments.drawLanded(ctx, w, h, state, best);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let camera = 'chase';
  let best = readBest();
  // A read-only handle for play-testing and debugging (never written to).
  window.__flight = {
    state: world.state,
    get screen() { return screen; },
    get camera() { return camera; },
  };
  let accumulator = 0;
  let last = performance.now();
  let hintUntil = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    hintUntil = performance.now() + 12000;
    announce('Flying. Eight rings, then land on the runway.');
  }

  function endRun(landed) {
    if (landed) {
      screen = SCREEN_LANDED;
      if (!best || world.state.elapsed < best) {
        best = world.state.elapsed;
        saveBest(best);
      }
      audio.fanfare();
      announce(`Landed. Score ${world.state.score}. Time ${world.state.elapsed.toFixed(1)} seconds.`);
    } else {
      screen = SCREEN_OVER;
      audio.crash();
      announce(`Crashed. ${world.state.crashReason} Score ${world.state.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CAMERA) {
      camera = camera === 'chase' ? 'cockpit' : 'chase';
      announce(camera === 'chase' ? 'Chase camera.' : 'Cockpit camera.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_LANDED)) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_LANDED)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title flies itself, so the canyon is alive behind the card.
      world.step(STEP, autopilot.steer(world.state));
      if (world.state.crashed || world.state.finished) world.reset();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const stick = input.stick();
    const events = world.step(STEP, stick);
    world.state.groundNow = world.groundAt();
    if (events & EVENT_RING) {
      audio.ring();
      announce(`Ring ${world.state.ringsPassed} of ${world.state.rings.length}.`);
    }
    if (events & EVENT_LANDED) endRun(true);
    else if (events & EVENT_CRASH) endRun(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += elapsed;
    handleActions();
    audio.update(world.state.plane.throttle, world.state.plane.speed, screen === SCREEN_PLAY);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    world.state.groundNow = world.groundAt();
    drawFrame(world.state, screen, camera, best, now / 1000);
    if (screen === SCREEN_PLAY && now < hintUntil) {
      const ctx = canvas.getContext('2d');
      instruments.drawHint(ctx, renderer.width, renderer.height, camera);
    }
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Crimson Canyon Ring Run. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
